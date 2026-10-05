/*!
 * JaymsX \u2014 "Discuss this on X", one component for any page on jayms.com.
 *
 * What it does
 *   James drafts a post, X opens with it filled in, he presses Post himself, then pastes the
 *   post's link back. The link is stored against a key (a passage, a post, a tool entry) and
 *   readers see "Join the discussion on X". Nothing is ever posted for him.
 *
 * Drop it in anywhere
 *   <script src="x-discuss.js"></script>
 *   <div id="talk"></div>
 *   <script>
 *     JaymsX.mount(document.getElementById("talk"), {
 *       key:    "psalm-82",                    // what this discussion belongs to; any unique id
 *       label:  "Psalm 82",                    // used in the copy ("Your discussion on Psalm 82")
 *       owner:  true,                          // true = James's view (draft, save); false = readers
 *       draft:  "Psalm 82\n\n",                // starting text for a new post
 *       links:  [{title:"Divine Council Inventory", url:"https://jayms.com/divine-council-inventory/"}],
 *       store:  JaymsX.stores.local()          // where the saved link lives (see "Stores")
 *     });
 *   </script>
 *
 *   The one-line banner on its own (for under an article, a verse, a card):
 *     JaymsX.line(el, {key, label, owner, store})
 *   Or just its words, when the page already has the thread:  JaymsX.lineHTML(thread, {owner, label})
 *   Both mount() and line() return {destroy()}; call it before mounting again in the same place.
 *
 * Stores (where the saved post link lives). Any object with these three async methods works:
 *     load(key) -> thread | null      save(key, thread)      remove(key)
 *   and optionally  subscribe(callback)  to hear changes made elsewhere.
 *   A thread is {url, handle, text, savedAt, label}.
 *   Built in:
 *     JaymsX.stores.local(prefix)          this browser only (drafting, previews)
 *     JaymsX.stores.artifactDb(db, coll)   a claude.ai Artifact database collection
 *     JaymsX.stores.rest(base, headers)    a JSON endpoint: GET/PUT/DELETE base + key
 *                                          (for jayms.com: a small WP REST route; not built yet)
 *
 * Helpers: JaymsX.utm(url, opts) \u00B7 JaymsX.parse(url) \u00B7 JaymsX.count(text)
 *
 * Styling: every class is prefixed jx-; the rules live in jayms-study.css (section 1), the one stylesheet, which a page
 * must load. They read the site tokens (--gold, --ink, --line, --paper, --paper-deep, --rust, --edge-open) with fallbacks.
 */
(function (global) {
  "use strict";

  var X_URL = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})/;
  var LIMIT = 280;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ls(k, v) { try { if (arguments.length === 1) { var r = localStorage.getItem(k); return r == null ? null : JSON.parse(r); } if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  /* X counts every link as 23 characters, whatever its length. */
  function count(text) { return String(text || "").replace(/https?:\/\/\S+/g, "xxxxxxxxxxxxxxxxxxxxxxx").length; }

  /* x.com/name/status/123 (or twitter.com, with ?s=20 and the like) -> {url, handle, id} */
  function parse(url) {
    var m = String(url || "").trim().match(X_URL);
    return m ? { url: "https://x.com/" + m[1] + "/status/" + m[2], handle: m[1], id: m[2] } : null;
  }

  /* Every jayms.com link that leaves the site carries source / medium / campaign (= the post slug).
     Other sites' links are left alone. Medium is "post" for a post and "reply" for a reply. */
  function utm(url, opts) {
    opts = opts || {};
    try {
      var u = new URL(url);
      if (!/(^|\.)jayms\.com$/.test(u.hostname)) return url;
      var slug = u.pathname.split("/").filter(Boolean).pop() || "home";
      u.searchParams.set("utm_source", opts.source || "x");
      u.searchParams.set("utm_medium", opts.medium || "post");
      u.searchParams.set("utm_campaign", opts.campaign || slug);
      return u.toString();
    } catch (e) { return url; }
  }

  // ------------------------------------------------------------- stores
  var stores = {
    local: function (prefix) {
      prefix = prefix || "jx.thread.";
      return {
        load: function (k) { return Promise.resolve(ls(prefix + k)); },
        save: function (k, t) { ls(prefix + k, t); return Promise.resolve(); },
        remove: function (k) { ls(prefix + k, null); return Promise.resolve(); }
      };
    },
    artifactDb: function (db, collection) {
      collection = collection || "threads";
      return {
        load: function (k) { return db.doc(collection + "/" + k).get().then(function (s) { return s.exists ? s.data() : null; }).catch(function () { return null; }); },
        save: function (k, t) { return db.doc(collection + "/" + k).set(t); },
        remove: function (k) { return db.doc(collection + "/" + k).delete(); },
        subscribe: function (cb) { return db.collection(collection).onSnapshot(function (snap) { snap.docChanges().forEach(function (c) { cb(c.doc.id, c.type === "removed" ? null : c.doc.data()); }); }, function () {}); }
      };
    },
    rest: function (base, headers) {
      var h = Object.assign({ "Content-Type": "application/json" }, headers || {});
      return {
        load: function (k) { return fetch(base + encodeURIComponent(k), { headers: h }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); },
        save: function (k, t) { return fetch(base + encodeURIComponent(k), { method: "PUT", headers: h, body: JSON.stringify(t) }); },
        remove: function (k) { return fetch(base + encodeURIComponent(k), { method: "DELETE", headers: h }); }
      };
    }
  };
  /* Several stores in one: read from the first that has it, write to all (e.g. the database plus this browser). */
  stores.both = function () {
    var list = [].slice.call(arguments);
    return {
      load: function (k) { return list.reduce(function (p, s) { return p.then(function (v) { return v || s.load(k); }); }, Promise.resolve(null)); },
      save: function (k, t) { return Promise.all(list.map(function (s) { return s.save(k, t); })); },
      remove: function (k) { return Promise.all(list.map(function (s) { return s.remove(k); })); },
      subscribe: function (cb) { var offs = list.map(function (s) { return s.subscribe ? s.subscribe(cb) : null; }); return function () { offs.forEach(function (f) { if (typeof f === "function") f(); }); }; }
    };
  };


  // ------------------------------------------------------------- views
  function when(t) { return t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""; }
  function card(t, owner) {
    return '<div class="jx-card"><span class="jx-lbl">' + (owner ? "Your post" : "James's post") + "</span>" +
      "<p>" + esc(t.text || "").replace(/\n/g, "<br>") + "</p>" +
      '<span class="jx-meta">@' + esc(t.handle) + (t.savedAt ? " \u00B7 " + when(t.savedAt) : "") + "</span>" +
      '<a class="jx-out" href="' + esc(t.url) + '" target="_blank" rel="noopener">' + (owner ? "Open the discussion on X" : "Join the discussion on X") + " \u2197</a></div>";
  }

  /* The full panel: the saved post, and for James the drafting and save-the-link steps. */
  function mount(el, o) {
    o = Object.assign({ owner: false, draft: "", links: [], store: stores.local(), label: "this", utm: {} }, o || {});
    var draftKey = "jx.draft." + o.key, thread = null, alive = true;

    function render() {
      if (!alive) return;
      var h = '<div class="jx">';
      if (!o.owner) {
        h += thread ? card(thread, false) : '<p class="jx-empty">James hasn\'t started a discussion on ' + esc(o.label) + " yet.</p>";
        el.innerHTML = h + "</div>"; return;
      }
      var d = ls(draftKey) || { text: o.draft, link: "" };
      if (thread) h += card(thread, true) + '<div class="jx-row"><button class="jx-btn" data-jx="remove">Remove this link</button></div><span class="jx-lbl">Start another post</span>';
      h += '<label class="jx-lbl" for="jx-ta-' + esc(o.key) + '">Draft the post</label>' +
           '<textarea class="jx-ta" id="jx-ta-' + esc(o.key) + '" data-jx="text">' + esc(d.text) + "</textarea>" +
           '<div class="jx-count" data-jx="count"></div>';
      if (o.links.length) {
        h += '<span class="jx-lbl">Add a link</span><div class="jx-row">' +
             '<button class="jx-chip' + (!d.link ? " on" : "") + '" data-jx-link="">No link</button>' +
             o.links.map(function (l) { return '<button class="jx-chip' + (d.link === l.url ? " on" : "") + '" data-jx-link="' + esc(l.url) + '">' + esc(l.title) + "</button>"; }).join("") +
             '</div><p class="jx-note">jayms.com links get the X tracking codes so Jetpack can see the clicks.</p>';
      }
      h += '<div class="jx-row"><a class="jx-btn fill" data-jx="open" target="_blank" rel="noopener" href="#">Open in X to post \u2197</a></div>' +
           '<p class="jx-note">X opens with the text filled in. Nothing posts until you press Post there.</p>' +
           '<label class="jx-lbl" for="jx-in-' + esc(o.key) + '">Then paste your post\'s link here</label>' +
           '<input class="jx-in" id="jx-in-' + esc(o.key) + '" data-jx="url" placeholder="https://x.com/pulse38echo/status/\u2026">' +
           '<div class="jx-row"><button class="jx-btn" data-jx="save">Save the link</button><span class="jx-msg" data-jx="msg"></span></div>';
      el.innerHTML = h + "</div>";
      wire();
    }

    function q(name) { return el.querySelector('[data-jx="' + name + '"]'); }
    function wire() {
      var ta = q("text");
      function sync() {
        var d = ls(draftKey) || {}, link = d.link || "", full = link ? ta.value + "\n\n" + utm(link, o.utm) : ta.value, n = count(full);
        q("count").textContent = n + " / " + LIMIT; q("count").classList.toggle("over", n > LIMIT);
        q("open").href = "https://x.com/intent/post?text=" + encodeURIComponent(full);
      }
      function keep(link) { var d = ls(draftKey) || {}; d.text = ta.value; if (link !== undefined) d.link = link; ls(draftKey, d); }
      ta.oninput = function () { keep(); sync(); };
      el.querySelectorAll("[data-jx-link]").forEach(function (b) {
        b.onclick = function () { keep(b.getAttribute("data-jx-link")); el.querySelectorAll("[data-jx-link]").forEach(function (x) { x.classList.toggle("on", x === b); }); sync(); };
      });
      q("save").onclick = function () {
        var p = parse(q("url").value), msg = q("msg");
        if (!p) { msg.textContent = "That isn't an X post link. It should look like x.com/name/status/123\u2026"; msg.classList.add("bad"); return; }
        thread = { url: p.url, handle: p.handle, text: ta.value, savedAt: Date.now(), label: o.label };
        Promise.resolve(o.store.save(o.key, thread)).then(function () { ls(draftKey, null); render(); if (o.onChange) o.onChange(thread); });
      };
      var rm = q("remove");
      if (rm) rm.onclick = function () { thread = null; Promise.resolve(o.store.remove(o.key)).then(function () { render(); if (o.onChange) o.onChange(null); }); };
      sync();
    }

    Promise.resolve(o.store.load(o.key)).then(function (t) { thread = t && parse(t.url) ? t : null; render(); });
    var off = o.store.subscribe ? o.store.subscribe(function (k, t) { if (k === o.key) { thread = t && parse(t.url) ? t : null; render(); } }) : null;
    render();
    return { refresh: function () { return Promise.resolve(o.store.load(o.key)).then(function (t) { thread = t; render(); }); },
             destroy: function () { alive = false; if (typeof off === "function") off(); } };
  }

  /* The banner's words, for pages that already hold the thread and draw it themselves. */
  function lineHTML(t, o) {
    o = o || {};
    if (!t || !parse(t.url)) return "";
    return (o.owner ? "Your discussion on " + esc(o.label || "this") + "." : "James started a discussion on " + esc(o.label || "this") + ".") +
      ' <a href="' + esc(t.url) + '" target="_blank" rel="noopener">Join it on X \u2197</a>';
  }

  /* The one-line banner: hidden until there is a discussion to join. */
  function line(el, o) {
    o = Object.assign({ owner: false, label: "this", store: stores.local() }, o || {});
    function show(t) {
      if (!t || !parse(t.url)) { el.hidden = true; el.innerHTML = ""; return; }
      el.hidden = false; el.className = (el.className.replace(/\bjx-line\b/, "") + " jx-line").trim();
      el.innerHTML = lineHTML(t, o);
    }
    Promise.resolve(o.store.load(o.key)).then(show);
    var off = o.store.subscribe ? o.store.subscribe(function (k, t) { if (k === o.key) show(t); }) : null;
    return { show: show, destroy: function () { if (typeof off === "function") off(); } };
  }

  global.JaymsX = { mount: mount, line: line, lineHTML: lineHTML, stores: stores, utm: utm, parse: parse, count: count, version: "1.0.0" };
})(window);
