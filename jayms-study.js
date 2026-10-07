/*!
 * JaymsStudy \u2014 the Bible tool panels as components. Any one of them goes on any page.
 *
 *   <link rel="stylesheet" href="jayms-study.css">      (the app's own stylesheet; nothing from the website's CSS)
 *   <script src="jayms-study.js"></script>
 *   <div id="council"></div>
 *   <script>
 *     const c = new JaymsStudy.Council(document.getElementById("council"), { ref: "Psalm 82" });
 *     c.setRef("Genesis 6:1-4");     // follow another passage
 *     c.destroy();                   // take it off the page
 *   </script>
 *
 * The panels (class name \u00B7 dock id)
 *   Council \u00B7 council       Divine Council Index entries for the passage, and the ones that read with them
 *   Gods \u00B7 gods             Gods of the Bible figures named in it
 *   FactBook \u00B7 facts        Fact Book people and places in it
 *   Posts \u00B7 posts           jayms.com posts that cite it            (option alsoRefs: [...] adds other passages)
 *   Library \u00B7 corpus        Corpus Atlas texts tied to it
 *   Vault \u00B7 vault           Obsidian notes that cite it             (owner only; it shows vault paths)
 *   Chats \u00B7 chats           past Claude chats that cite it
 *   Words \u00B7 word            Word Study entries for its Hebrew/Greek words   (option word: "h430")
 *   Verse \u00B7 verse           one verse: interlinear cards, DSS readings, glossary, translation differences   (option verse: {book,c,v})
 *   Interleave \u00B7 outline    the interlinear for the whole passage, with a fixed word drawer and "where it sits"
 *   AskClaude \u00B7 claude      ask Claude about the passage by James's rules file  (options ask, context, instructions)
 *   CrossRefs \u00B7 xref        cross-references from OpenBible + Tyndale + Biblica, strongest first, read in place
 *   BibleProject \u00B7 bp       LSB audio per chapter, the BibleProject guide, videos/articles/podcasts on the chapter
 *   Shelf \u00B7 shelf           Logos commentaries, study Bibles (+ open notes), maps, DDD, courses, his authors
 *   ShelfConfig \u00B7 config    rank authors; order/hide commentaries and study Bibles (emits shelfcfg)
 *   Vocab \u00B7 vocab           the vocabulary deck          Ideas \u00B7 ideas      logged post ideas
 *   LogosQueue \u00B7 logos      searches to run in Logos     PlanBuilder \u00B7 planner   build a reading plan
 *   WrapUp \u00B7 wrap           the day's four outputs       Review \u00B7 review   spaced review of vocab + past quizzes
 *   Discuss \u00B7 x             the X discussion (wraps JaymsX from x-discuss.js)
 *   Developer guide: docs/DEVELOPER.md (files, data sources, builds, publishing, how to add a panel, troubleshooting).
 *
 * Every panel
 *   new Panel(el, options) \u00B7 .setRef(ref) \u00B7 .set(options) \u00B7 .destroy()
 *   options.ref        the passage, e.g. "Psalm 82", "Daniel 10:13, 20-21"
 *   options.on         { word: fn, meta: fn, passage: fn, ... }: what the page does with each message a panel sends.
 *                      The full list is JaymsStudy.events. A single options.onWord / onMeta callback also works,
 *                      and every message is also a bubbling DOM event "jst:<name>".
 *   Panel.meta         {id, label, name, icon}, for a host's toolbar
 *   Panel.count(data)  a badge number from the passage's data, or null
 *   It also fires DOM events on its element: "jst:word", "jst:meta".
 *
 * Data (one place, cached, shared by every panel on the page)
 *   JaymsStudy.config({ base: "", site: "https://jayms.com/bible-study-tools-2/" })
 *   base + index/<book>.json (what cites each chapter and verse) \u00B7 index/_<tool>.json (shared entries) \u00B7 text/<book>.json
 *   \u00B7 interlinear/<book>-<n>.json (ten chapters each) \u00B7 outline/<book>.json \u00B7 differences-map.json. All English verse numbering.
 *   Needs jayms-ref.js loaded first.
 *   Built by scripts/build-data.py and the other scripts/build-*.py (see docs/DEVELOPER.md \u00A73). On jayms.com, base points at the jayms-tool-data repo.
 */
(function (global) {
  "use strict";

  // ------------------------------------------------------------------ config + helpers
  var CFG = { base: "", site: "https://jayms.com/bible-study-tools-2/", corpus: "https://corpusatlas.netlify.app/",
              /* the live tool data the jayms.com tools themselves read (the alpha tool runner's $base): edits there show up here with no rebuild */
              toolData: "https://raw.githubusercontent.com/sixcore-droid/jayms-tool-data/main/",
              /* jayms.com's own data (posts, glossary terms): same-origin once the workstation is on jayms.com */
              siteData: "https://jayms.com/wp-json/wp/v2/",
              /* the public site's per-book files come in ten-chapter pieces (see bookFile) */
              chunks: !!global.JAYMS_PUBLIC,
              /* maps show in the panel where outside images are allowed (the site, its GitHub copy, James's Mac);
                 elsewhere (claude.ai's sandbox) a map title opens it in a new tab */
              onlineMaps: /(^|\.)jayms\.com$|\.github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname),
              /* the podcast relay (Podcast Index needs a secret and refuses browsers): the site's snippet 254, or the local server */
              podcastAPI: global.JAYMS_PUBLIC ? location.origin + "/wp-json/jayms-bsa/v1/podcasts"
                        : /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? location.origin + "/api/podcasts" : null,
              /* the art relay: the Art Institute's image server turns browsers away, so the site's snippet 254 or the local server fetches the picture */
              artAPI: global.JAYMS_PUBLIC ? location.origin + "/wp-json/jayms-bsa/v1/art"
                        : /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? location.origin + "/api/art" : null };
  function config(o) { Object.assign(CFG, o || {}); return CFG; }
  /* Every link goes to the exact page, never a guess. Each pattern was checked against jayms.com:
     an entry has its own page at <tool>/<id>/; the Interleaved Bible opens a passage with #read=Book|Ref. */
  var TOOL = { council: "divine-council-index", gods: "gods-of-the-bible", facts: "bible-entity-explorer", words: "bible-word-study-tool",
               diffs: "bible-translation-differences", ib: "bible-interactive-outline" };
  function entryURL(tool, id) { return id ? CFG.site + TOOL[tool] + "/" + encodeURIComponent(String(id).toLowerCase()) + "/" : ""; }
  function ibBookKey(book) { return bookRow(book).ib; }
  /* q = {book, c1, v1, c2, v2}; lastVerse = the chapter's real last verse when v2 means "to the end" */
  function ibURL(q, lastVerse) {
    if (!q) return "";
    var v2 = q.v2 === 999 ? lastVerse : q.v2;
    if (!v2) return ibBookURL(q.book);
    var ref = q.book + " " + q.c1 + ":" + q.v1 + (q.c2 !== q.c1 ? "-" + q.c2 + ":" + v2 : (v2 !== q.v1 ? "-" + v2 : ""));
    return CFG.site + TOOL.ib + "/?book=" + bookSlug(q.book) + "#read=" + encodeURIComponent(ibBookKey(q.book)) + "|" + encodeURIComponent(ref);
  }
  function ibBookURL(book) { return CFG.site + TOOL.ib + "/?book=" + bookSlug(book) + "#book=" + encodeURIComponent(ibBookKey(book)); }

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var md = function (t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>"); };
  var box = function (v, h, body) { return '<div class="box v-' + v + '">' + (h ? "<h3>" + h + "</h3>" : "") + body + "</div>"; };
  var outlink = function (href, txt) { return href ? '<a class="out" href="' + esc(href) + '" target="_blank" rel="noopener">' + txt + " \u2197</a>" : ""; };
  var none = function (t) { return '<p class="empty">' + t + "</p>"; };
  var slug = function (ref) { return String(ref).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); };
  var plainLetters = function (s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036F]/g, ""); };
  /* Greek in English letters only: the interlinear carries a transliteration for Hebrew but not for Greek. */
  var GR = { "\u03B1": "a", "\u03B2": "b", "\u03B3": "g", "\u03B4": "d", "\u03B5": "e", "\u03B6": "z", "\u03B7": "e", "\u03B8": "th", "\u03B9": "i", "\u03BA": "k", "\u03BB": "l", "\u03BC": "m", "\u03BD": "n", "\u03BE": "x", "\u03BF": "o", "\u03C0": "p", "\u03C1": "r", "\u03C2": "s", "\u03C3": "s", "\u03C4": "t", "\u03C5": "u", "\u03C6": "ph", "\u03C7": "ch", "\u03C8": "ps", "\u03C9": "o" };
  function greekLetters(t) {
    var d = String(t || "").normalize("NFD").toLowerCase(), rough = /\u0314/.test(d);
    d = d.replace(/[\u0300-\u036F]/g, "").replace(/\u03B3([\u03B3\u03BA\u03BE\u03C7])/g, "n$1");
    var out = d.replace(/[\u03B1-\u03C9]/g, function (c) { return GR[c] || c; }).replace(/[^a-z]/g, "");
    return (rough && /^[aeiou]/.test(out) ? "h" : "") + out;
  }
  var HE = { "\u05D0": "'", "\u05D1": "b", "\u05D2": "g", "\u05D3": "d", "\u05D4": "h", "\u05D5": "w", "\u05D6": "z", "\u05D7": "ch", "\u05D8": "t", "\u05D9": "y", "\u05DA": "k", "\u05DB": "k", "\u05DC": "l", "\u05DD": "m", "\u05DE": "m", "\u05DF": "n", "\u05E0": "n", "\u05E1": "s", "\u05E2": "'", "\u05E3": "p", "\u05E4": "p", "\u05E5": "ts", "\u05E6": "ts", "\u05E7": "q", "\u05E8": "r", "\u05E9": "sh", "\u05EA": "t" };
  /* Hebrew in English letters, vowels included: consonant by consonant with its points.
     Plain spelling, as the site prints it: no macrons, shva sounded only after a word's first letter, a yod or vav that
     only carries a vowel stays silent, shureq is u, holam on vav is o, shin dot sh, sin dot s. */
  var SOFT = { "\u05D1": "v", "\u05DB": "kh", "\u05DA": "kh", "\u05E4": "f", "\u05E3": "f" };
  var HV = { "\u05B0": "e", "\u05B1": "e", "\u05B2": "a", "\u05B3": "o", "\u05B4": "i", "\u05B5": "e", "\u05B6": "e", "\u05B7": "a", "\u05B8": "a", "\u05B9": "o", "\u05BA": "o", "\u05BB": "u", "\u05C7": "o" };
  function hebrewLetters(t) {
    var d = String(t || "").normalize("NFD").replace(/[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C3-\u05C6]/g, ""), out = "", n = 0, m;
    var re = /([\u05D0-\u05EA])([\u05B0-\u05BC\u05C1\u05C2\u05C7]*)/g;
    while ((m = re.exec(d))) {
      var c = m[1], marks = m[2], v = "", hasDagesh = marks.indexOf("\u05BC") > -1;
      for (var k = 0; k < marks.length; k++) if (HV[marks[k]] !== undefined) v = HV[marks[k]];
      var cons = HE[c] || "";
      if (!hasDagesh && SOFT[c]) cons = SOFT[c];                                     // b k p soften to v kh f
      var doubled = hasDagesh && n > 0 && /[aeiou]$/.test(out) && !/[\u05D0\u05D4\u05D7\u05E2\u05E8\u05D5\u05D9]/.test(c);
      if (marks.indexOf("\u05B0") > -1 && n !== 0 && !doubled) v = "";             // silent shva inside a word
      if (c === "\u05E9") cons = marks.indexOf("\u05C2") > -1 ? "s" : "sh";
      if (c === "\u05D5" && hasDagesh && !v && n > 0) { out += "u"; n++; continue; }  // shureq
      if (c === "\u05D5" && marks.indexOf("\u05B9") > -1 && n > 0) { out += "o"; n++; continue; } // holam male
      if (c === "\u05D9" && !v && n > 0 && /[ie]$/.test(out)) { n++; continue; }      // yod carrying hiriq or tsere
      if (c === "\u05D0" && !v && re.lastIndex >= d.length) { n++; continue; }     // final silent alef
      if (c === "\u05D0" || c === "\u05E2") cons = "";                               // alef and ayin: plain spelling, no apostrophe
      out += (doubled && cons.length === 1 ? cons : "") + cons + v; n++;
    }
    return out.replace(/^'/, "").replace(/[^a-z']/g, "");
  }
  function latin(w) {
    if (w.translit) return plainLetters(w.translit);
    var k = strongKey(w.strong).toLowerCase();
    if (WORDS[k] && WORDS[k].t && !/[\u0590-\u05FF\u0370-\u03FF]/.test(WORDS[k].t)) return WORDS[k].t;
    if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(w.text || "")) return greekLetters(w.text);
    if (/[\u0590-\u05FF]/.test(w.text || "")) return hebrewLetters(w.text);
    return plainLetters(w.lemma || w.text);
  }
  var strongKey = function (k) { k = String(k == null ? "" : k); return /^\d/.test(k) ? "G" + k : k; };
  /* References: everything goes through JaymsRef (jayms-ref.js), the one reference module. */
  var R = global.JaymsRef;
  function bookRow(b) { return R.book(b) || { name: b, slug: String(b).toLowerCase().replace(/\s+/g, "-"), il: String(b).toLowerCase().replace(/\s+/g, ""), ib: b, chapters: 0 }; }
  function bookSlug(b) { return bookRow(b).slug; }
  function withSlug(s) { return Object.assign({}, s, { slug: bookSlug(s.book) }); }
  function parseRef(t) { var x = R.parse(t)[0]; return x ? withSlug(x) : null; }
  var overlap = R.overlap;

  // ------------------------------------------------------------------ data (shared cache)
  var cache = {};
  function getJSON(path) {
    if (!(path in cache)) cache[path] = fetch(CFG.base + path).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return cache[path];
  }
  /* a book's text/, study/ or index/ data. The public site splits each book into ten-chapter pieces (<book>-<n>.json, made by
     scripts/build-public.py) so a passage downloads only the pieces it touches; the pieces are merged back into the whole-book
     shape, so every caller reads the same structure either way. James's copies keep one file per book (the Artifact file limit). */
  function deepMerge(a, b) {
    Object.keys(b).forEach(function (k) {
      var x = a[k], y = b[k];
      if (Array.isArray(y)) { var seen = {}, out = (Array.isArray(x) ? x : []).slice(); out.forEach(function (e) { seen[JSON.stringify(e)] = 1; });
        y.forEach(function (e) { var j = JSON.stringify(e); if (!seen[j]) { seen[j] = 1; out.push(e); } }); a[k] = out; }
      else if (y && typeof y === "object") a[k] = deepMerge(x && typeof x === "object" && !Array.isArray(x) ? x : {}, y);
      else a[k] = y;
    });
    return a;
  }
  function bookFile(dir, book, segs) {
    if (!CFG.chunks) return getJSON(dir + "/" + bookSlug(book) + ".json");
    var ns = {};
    (segs || []).forEach(function (s) { if (s.book !== book) return; for (var c = s.c1; c <= s.c2; c++) ns[Math.floor((c - 1) / 10)] = 1; });
    var list = Object.keys(ns); if (!list.length) list = ["0"];
    return Promise.all(list.map(function (n) { return getJSON(dir + "/" + bookSlug(book) + "-" + n + ".json"); })).then(function (parts) {
      var ok = parts.filter(Boolean); return ok.length ? ok.reduce(function (m, p) { return deepMerge(m, p); }, {}) : null;
    });
  }
  var WORDS = {};                         // Strong's key -> entry, filled from each book's lexicon
  /* a Hebrew word's name for readers: Strong's spells samekh "c" (cod, cabib, checed) and the divine name "Yehovah";
     shown as sod, sabib, chesed and Yahweh (as the LSB has it). "ch" (chet) is left alone. The Word Study data isn't changed. */
  function wordName(k, t) {
    k = String(k || "").toLowerCase(); t = String(t || "");
    if (k === "h3068" || k === "h3069") return "Yahweh";
    return k.charAt(0) === "h" ? t.replace(/c(?!h)/g, "s").replace(/C(?!h)/g, "S") : t;
  }
  var PEEK = {};                          // ref -> assembled passage data (sync access for badges)
  var SHARED = ["council", "gods", "posts", "vault", "chats", "library"];
  /* the public build (window.JAYMS_PUBLIC) has no vault or chats files: they are James's private notes */
  function shared() { var keys = SHARED.filter(function (k) { return !(global.JAYMS_PUBLIC && (k === "vault" || k === "chats")); });
    return Promise.all(keys.map(function (k) { return getJSON("index/_" + k + ".json"); })).then(function (a) { var o = {}; SHARED.forEach(function (k) { o[k] = {}; }); keys.forEach(function (k, i) { o[k] = a[i] || {}; }); return o; }); }
  function bookIndex(b, segs) {
    return bookFile("index", b, segs).then(function (ix) {
      if (ix && !ix.__words) { ix.__words = 1; Object.keys(ix.lex || {}).forEach(function (k) { if (!WORDS[k]) WORDS[k] = Object.assign({ k: k }, ix.lex[k], { t: wordName(k, ix.lex[k].t) }); }); }
      return ix;
    });
  }
  /* rows filed under a chapter look like [id, c1, v1, c2, v2, ...extra]; keep the ones inside the passage */
  function hits(ixs, segs, kind) {
    var out = [];
    segs.forEach(function (s) {
      var ix = ixs[s.book]; if (!ix && !LV.ok[kind]) return;
      for (var c = s.c1; c <= s.c2; c++) {
        chRows(ix, s.book, c, kind).forEach(function (r) {
          /* a row spanning chapters is filed under each; count it once, at the first chapter it shares with the passage */
          if (c !== Math.max(r[1], s.c1)) return;
          if (overlap({ book: s.book, c1: r[1], v1: r[2], c2: r[3], v2: r[4] }, s)) out.push(r);
        });
      }
    });
    return out;
  }
  function tally(rows) { var n = {}, order = []; rows.forEach(function (r) { if (!n[r[0]]) { n[r[0]] = 0; order.push(r[0]); } n[r[0]]++; }); return order.map(function (id) { return { id: id, n: n[id] }; }).sort(function (a, b) { return b.n - a.n; }); }
  /* Assemble everything the panels show for one passage, from the book indexes and the shared entries. */
  function assemble(ref, segs, ixs, sh0) {
    var d = { ref: ref, segs: segs.map(withSlug) }, sh = Object.assign({}, sh0);
    ["council", "gods", "posts"].forEach(function (k) { if (LV.ok[k]) sh[k] = LV.shared[k]; });
    var cRows = hits(ixs, segs, "council"), mains = [];
    cRows.forEach(function (r) { if (mains.indexOf(r[0]) < 0) mains.push(r[0]); });
    var rel = []; mains.forEach(function (id) { ((sh.council[id] || {}).related || []).forEach(function (x) { if (mains.indexOf(x) < 0 && rel.indexOf(x) < 0) rel.push(x); }); });
    d.council = mains.map(function (id) { return Object.assign({ id: id, main: true }, sh.council[id]); })
      .concat(rel.slice(0, 4).map(function (id) { return Object.assign({ id: id, main: false }, sh.council[id]); })).filter(function (e) { return e.title; });
    var g = []; hits(ixs, segs, "gods").forEach(function (r) { if (g.indexOf(r[0]) < 0) g.push(r[0]); });
    d.gods = g.slice(0, 8).map(function (id) { return Object.assign({ id: id }, sh.gods[id]); });
    d.facts = tally(hits(ixs, segs, "facts")).slice(0, 15).map(function (t) {
      var e; segs.some(function (s) { return (e = LV.ok.facts ? (LV.facts[s.book] || {})[t.id] : (ixs[s.book] && ixs[s.book].facts[t.id])); }); return e ? Object.assign({ id: t.id }, e) : null; }).filter(Boolean);
    d.posts = tally(hits(ixs, segs, "posts")).map(function (t) { var p = sh.posts[t.id]; return p ? Object.assign({ id: +t.id, cites: t.n }, p) : null; }).filter(Boolean);
    var vRows = hits(ixs, segs, "vault"), snip = {}; vRows.forEach(function (r) { if (!snip[r[0]]) snip[r[0]] = r[5]; });
    d.vault = tally(vRows).slice(0, 8).map(function (t) { var v = sh.vault[t.id] || { t: t.id, path: t.id }; return { t: v.t, path: v.path, hits: t.n, hit: snip[t.id] || "" }; });
    d.chats = tally(hits(ixs, segs, "chats")).slice(0, 6).map(function (t) { var c = sh.chats[t.id]; return c ? Object.assign({ hits: t.n }, c) : null; }).filter(Boolean);
    var lib = {}, libOrder = []; hits(ixs, segs, "library").forEach(function (r) { if (!lib[r[0]]) { lib[r[0]] = r[5]; libOrder.push(r[0]); } });
    d.library = libOrder.slice(0, 8).map(function (t) { return Object.assign({}, sh.library[t] || { t: t }, { why: lib[t] }); });
    var wfirst = {}, notes = {}, wnotes = {};
    segs.forEach(function (s) {
      var ix = ixs[s.book]; if (!ix) return;
      for (var c = s.c1; c <= s.c2; c++) {
        var ch = ix.chapters[c] || {};
        chRows(ix, s.book, c, "words").forEach(function (r) {
          var vs = r.slice(1).filter(function (v) { return R.contains([s], s.book, c, v); }); if (!vs.length) return;
          var at = c * 1000 + Math.min.apply(null, vs);
          if (!(r[0] in wfirst) || at < wfirst[r[0]]) wfirst[r[0]] = at;
        });
        Object.keys(ch.notes || {}).forEach(function (v) { if (R.contains([s], s.book, c, +v)) notes[c + ":" + v] = ch.notes[v]; });
        Object.assign(wnotes, ch.wordNotes || {});
      }
    });
    /* the passage's words in the order they first appear in it */
    var wk = Object.keys(wfirst).sort(function (a, b) { return wfirst[a] - wfirst[b]; });
    d.words = wk.slice(0, 40).map(function (k) { return Object.assign({ k: k }, WORDS[k] || { t: k, s: k.toUpperCase() }, wnotes[k] ? { note: wnotes[k] } : {}); });
    Object.keys(wnotes).forEach(function (k) { if (WORDS[k]) WORDS[k].note = wnotes[k]; });
    d.verseNotes = notes;
    return d;
  }
  /* ------------------------------------------------------------------ the live layer
     Everything that exists on jayms.com is read from there: the Divine Council Index, Gods of the Bible, the Fact Book,
     Word Study and Translation Differences (the tool data files the jayms.com tools read), the outlines, the posts and the glossary.
     It is turned into exactly the rows the build writes (book -> chapter -> kind -> [id, c1, v1, c2, v2]) plus the entry details,
     so the panels never know where their data came from. A source that can't be reached falls back to the copy the build made
     from that same source; only the Bible text, the interlinear, and James's own vault, chats and Logos shelf are local by design. */
  var LV = { ok: {}, ch: {}, shared: { council: {}, gods: {}, posts: {} }, facts: {}, ws: null, diffs: null };
  /* live data (jayms.com REST, the tool-data repo) is kept in the browser's Cache Storage for LIVE_TTL, so a visit doesn't
     re-download every post each time; an older copy is used if the network fails. No Cache Storage (some sandboxes): straight fetch. */
  var LIVE_TTL = (global.JAYMS_PUBLIC ? 6 * 3600 : 300) * 1000, LIVE_CACHE = "jst-live-1";   // the site: 6 hours; James's desk: 5 minutes, so his edits show
  function getLive(url, ttl) {
    ttl = ttl || LIVE_TTL;
    var net = function () { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); };
    var store = null;
    try { if (global.caches && global.isSecureContext) store = global.caches.open(LIVE_CACHE); } catch (e) {}
    if (!store) return net().then(JSON.parse);
    return store.then(function (c) {
      return c.match(url).then(function (hit) {
        var age = hit ? Date.now() - Number(hit.headers.get("x-saved") || 0) : Infinity;
        if (hit && age < ttl) return hit.text();
        return net().then(function (t) { c.put(url, new Response(t, { headers: { "x-saved": String(Date.now()) } })).catch(function () {}); return t; })
          .catch(function (e) { if (hit) return hit.text(); throw e; });
      });
    }, function () { return net(); }).then(JSON.parse);
  }
  /* jayms.com refuses quick back-to-back requests (429), so paged reads go one at a time, spaced, with a few retries */
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function getPaged(base) {
    var all = [];
    var one = function (n, tries) {
      return getLive(base + "&page=" + n).catch(function (e) { if (tries >= 4) throw e; return wait(1500 * (tries + 1)).then(function () { return one(n, tries + 1); }); });
    };
    var page = function (n) { return one(n, 0).then(function (rows) { all = all.concat(rows); return rows.length === 100 ? wait(700).then(function () { return page(n + 1); }) : all; }); };
    return page(1);
  }
  function lvPut(kind, s, row) {
    var b = R.book(s.book); if (!b) return;
    for (var c = s.c1; c <= Math.min(s.c2, b.chapters); c++) { var bc = (LV.ch[s.book] = LV.ch[s.book] || {}), k = (bc[c] = bc[c] || {}); (k[kind] = k[kind] || []).push(row); }
  }
  function rng(s) { return [s.c1, s.v1, s.c2, s.v2]; }
  var plain = function (x) { return String(x || "").replace(/\*\*|\*/g, "").replace(/\s+/g, " ").trim(); };
  var LIVE_SOURCES = {
    council: function () { return getLive(CFG.toolData + "divine-council-alpha.json").then(function (D) {
      var grp = {}; (D.filters || []).forEach(function (f) { if (f.field === "group") (f.options || []).forEach(function (o) { grp[o.k] = o.n; }); });
      var CAT = { explicit: "Explicit", implied: "Implied", contested: "Contested" };
      (D.entries || []).forEach(function (e) {
        LV.shared.council[e.id] = { title: e.title, cat: CAT[e.category] || "", group: grp[e.group] || "", summary: plain(e.summary), plain: e.plain || "", prob: plain(e.prob), res: plain(e.res), related: e.related || [] };
        R.parse(e.bibleRef || e.title).forEach(function (s) { lvPut("council", s, [e.id].concat(rng(s))); });
      });
    }); },
    gods: function () { return getLive(CFG.toolData + "gods-of-the-bible-alpha.json").then(function (D) {
      (D.entries || []).forEach(function (e) {
        LV.shared.gods[e.id] = { title: e.title, summary: plain(e.summary), plain: e.plain || "" };
        var seen = {};
        [e.bibleRef || ""].concat(e.refs || []).forEach(function (r) { R.parse(r).forEach(function (s) { var k = s.book + rng(s).join(","); if (!seen[k]) { seen[k] = 1; lvPut("gods", s, [e.id].concat(rng(s))); } }); });
      });
    }); },
    facts: function () { return getLive(CFG.toolData + "fact-book-alpha.json").then(function (D) {
      var card = D.card || {}, lab = card.labelField || "title", main = card.mainField || "summary";
      (D.entries || []).forEach(function (e) {
        var refs = e.refs || []; if (typeof refs === "string") refs = [refs];
        var st = splitTitle(e[lab] || e.title), books = {};
        refs.forEach(function (r) { R.parse(r).forEach(function (s) { lvPut("facts", s, [e.id].concat(rng(s))); books[s.book] = 1; }); });
        Object.keys(books).forEach(function (b) { (LV.facts[b] = LV.facts[b] || {})[e.id] = { title: st.name, about: st.about, kind: String(e.kind || "").replace(/^./, function (c) { return c.toUpperCase(); }), note: plain(e[main] || e.dictNote) }; });
      });
    }); },
    words: function () { return getLive(CFG.toolData + "word-study-alpha.json").then(function (D) {
      var by = {}; (D.entries || []).forEach(function (e) { by[String(e.strong).toUpperCase()] = e; });
      LV.ws = by;
      Object.keys(by).forEach(function (k) { var e = by[k];
        WORDS[k.toLowerCase()] = Object.assign(WORDS[k.toLowerCase()] || {}, { k: k.toLowerCase(), t: wordName(k, e.title), s: e.strong, gloss: e.gloss || "", count: (e.count || 0).toLocaleString("en-US"), def: e.def || "", spread: e.spread || "" }); });
    }); },
    diffs: function () { return getLive(CFG.toolData + "translation-differences-alpha.json").then(function (D) {
      var main = (D.card || {}).mainField || "summary";
      LV.diffs = (D.entries || []).map(function (e) { return { id: e.id, ref: e.bibleRef || e.title, lemma: e.lemma || "", lang: e.lang || "", family: e.family || "", gist: plain(e[main]), slug: e.id }; });
    }); },
    posts: function () {
      return getPaged(CFG.siteData + "posts?per_page=100&_fields=id,title,link,date,excerpt,content").then(function (rows) {
        var un = function (h) { var t = document.createElement("textarea"); t.innerHTML = h; return t.value; };
        rows.forEach(function (p) {
          var text = un(String(p.content.rendered).replace(/<[^>]+>/g, " ")), hit = false;
          R.refsIn(text).forEach(function (x) { lvPut("posts", x.seg, [p.id].concat(rng(x.seg))); hit = true; });
          if (hit) LV.shared.posts[String(p.id)] = { title: un(p.title.rendered), url: p.link, date: String(p.date).slice(0, 10), excerpt: plain(un(String(p.excerpt.rendered).replace(/<[^>]+>/g, ""))) };
        });
      });
    }
  };
  var LIVE_ALL = null;
  /* said once, under a panel whose source couldn't be reached */
  function liveNote() { return "jayms.com couldn't be reached from here, so this is the copy the workstation was last built with. On jayms.com it reads the live data."; }
  /* load every live source once; each one that loads replaces its built copy, the rest keep the built copy */
  function liveAll() {
    if (LIVE_ALL) return LIVE_ALL;
    if (CFG.liveOff) { Object.keys(LIVE_SOURCES).forEach(function (k) { LV.ok[k] = false; }); return (LIVE_ALL = Promise.resolve(LV.ok)); }
    return (LIVE_ALL = Promise.all(Object.keys(LIVE_SOURCES).map(function (k) {
      return LIVE_SOURCES[k]().then(function () { LV.ok[k] = true; }).catch(function () { LV.ok[k] = false; });
    })).then(function () { return LV.ok; }));
  }
  /* the rows of one kind in one chapter: live when that source loaded, else the build's */
  function chRows(ix, book, c, kind) {
    /* words: every content word in the chapter, kept when Word Study has it (live Word Study, or the built lexicon) */
    if (kind === "words" && ix && ((ix.chapters[c] || {}).cand)) return ix.chapters[c].cand.filter(function (r) { return LV.ok.words ? LV.ws[r[0].toUpperCase()] : (ix.lex || {})[r[0]]; });
    if (LV.ok[kind]) return ((LV.ch[book] || {})[c] || {})[kind] || [];
    return (((ix && ix.chapters[c]) || {})[kind]) || [];
  }

  var GLOSS = null, GLOSS_WAIT = [];                       // jayms.com glossary (glossary.json), once loaded
  function foldWord(w) { return String(w || "").normalize("NFD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, ""); }
  /* the glossary entries whose spelling matches this word exactly (folded: case, accents and marks ignored) */
  /* lang comes from the Strong's number (H = hebrew or Aramaic, G = greek) so a Hebrew word never lands on an Ugaritic or Greek entry spelled alike */
  function langOf(strong) { var c = String(strong || "").charAt(0).toUpperCase(); return c === "H" ? "hebrew" : c === "G" ? "greek" : ""; }
  function glossFor(word, strong) {
    if (!GLOSS) return []; var lang = langOf(strong);
    return (GLOSS.keys[foldWord(word)] || []).map(function (i) { return GLOSS.terms[i]; }).filter(function (g) { return lang && (g.lang === lang || (lang === "hebrew" && g.lang === "aramaic")); });
  }
  function glossBox(word, strong) {
    return glossFor(word, strong).map(function (g) { return box("explain", "In my glossary", "<p><b>" + esc(g.t) + "</b>" + (g.x ? " " + esc(g.x) : "") + "</p>" + outlink(g.url, "Glossary entry")); }).join("");
  }
  /* a title that repeats itself in brackets ("Seir (Seir)") reads as just the name */
  /* "Joseph (Jacob's son living at the time of the Patriarchs)" -> name "Joseph", about "Jacob's son ..."; an "about" that only repeats the name is dropped */
  function splitTitle(t) {
    var m = String(t || "").match(/^(.*?)\s*\((.*)\)\s*$/);
    if (!m) return { name: String(t || ""), about: "" };
    return { name: m[1], about: foldWord(m[1]) === foldWord(m[2]) ? "" : m[2] };
  }

  var SHELF = null;
  var SHELF_TAB = "com";                  // the Shelf tab James last picked: com | sb | other
  var XREFN = {}, NOTEN = {};
  var NOTE_SRC = {
    T: { code: "T", name: "Tyndale Open Study Notes", short: "Tyndale", url: "https://tyndaleopenresources.com/", licence: "CC BY-SA 4.0" },
    B: { code: "B", name: "Biblica Study Notes", short: "Biblica", url: "https://github.com/BibleAquifer/BiblicaStudyNotes", licence: "CC BY-SA 4.0" }
  };
  /* a note's light markup to HTML: blank-line paragraphs, "- " list items, *emphasis*, {{Ref|label}} as a button that opens the verse */
  function noteHTML(t) {
    return String(t).split(/\n\n+/).map(function (para) {
      var lines = para.split("\n").filter(function (l) { return l.trim(); });
      var inline = function (x) {
        return esc(x).replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\{\{([^|}]+)\|([^}]*)\}\}/g, function (m, r, lab) { return '<button class="jst-ref" data-jst-go="' + r + '" title="Open ' + r + '">' + lab + "</button>"; });
      };
      if (lines.every(function (l) { return /^- /.test(l); })) return '<ul class="jst-notelist">' + lines.map(function (l) { return "<li>" + inline(l.slice(2)) + "</li>"; }).join("") + "</ul>";
      return "<p>" + lines.map(function (l) { return inline(l.replace(/^- /, "")); }).join("<br>") + "</p>";
    }).join("");
  }
  var data = {
    words: WORDS,
    /* the glossary: the built copy at once (so marks show immediately), replaced by the live jayms.com glossary when that arrives;
       panels that want the swap pass onLive */
    glossary: function (onLive) {
      if (onLive) GLOSS_WAIT.push(onLive);
      if (cache.__gloss) return cache.__gloss;
      data.glossaryLive().then(function (g) { if (g) { GLOSS = g; var w = GLOSS_WAIT.splice(0); w.forEach(function (fn) { try { fn(); } catch (e) {} }); } });
      return (cache.__gloss = getJSON("glossary.json").then(function (d) { if (!GLOSS || !GLOSS.live) GLOSS = d || { terms: [], keys: {} }; return GLOSS; }));
    },
    glossaryLive: function () {
      if (cache.__glossLive) return cache.__glossLive;
      if (CFG.liveOff) return (cache.__glossLive = Promise.resolve(null));
      var page = function () { return getPaged(CFG.siteData + "jayms_term?per_page=100&orderby=id&order=asc&_fields=id,slug,link,title,excerpt,meta"); };
      var un = function (h) { var t = document.createElement("textarea"); t.innerHTML = String(h || "").replace(/<[^>]+>/g, ""); return t.value.replace(/\s+/g, " ").trim(); };
      return (cache.__glossLive = page().then(function (rows) {
        var terms = [], keys = {};
        rows.forEach(function (x) {
          var m = x.meta || {}, t = { t: un(x.title && x.title.rendered), url: x.link, lang: m._jayms_language || "", tr: m._jayms_transliteration || "", x: un(x.excerpt && x.excerpt.rendered).slice(0, 240) };
          var i = terms.length; terms.push(t);
          [foldWord(String(x.slug).replace(/-/g, "")), foldWord(t.t), foldWord(t.tr)].filter(function (k, j, a) { return k.length >= 2 && a.indexOf(k) === j; })
            .forEach(function (k) { (keys[k] = keys[k] || []).push(i); });
        });
        return { terms: terms, keys: keys, live: true };
      }).catch(function () { return null; }));
    },
    dss: function () { return getJSON("dss.json").then(function (d) { DSSD = d; return d; }); },
    hg: function () { return getJSON("hebrew-greek.json"); },   // the Hebrew & Greek mode's marks (scripts/build-hebrew-greek.py)
    /* what the dock buttons count from, loaded once after the first paint (small files; the panels load their own full data) */
    counts: function () { return Promise.all([data.names(), data.maps().catch(function () {}), data.dss().catch(function () {}),
      getJSON("art-refs.json").then(function (d) { ARTREFS = d || []; }).catch(function () { ARTREFS = []; }),
      getJSON("relics.json").then(function (d) { RELREFS = ((d && d.relics) || []).map(function (x) { return x.refs; }); }).catch(function () { RELREFS = []; })]); },
    bibleproject: function () { return getJSON("bibleproject.json"); },
    lsbAudio: function () { return getJSON("lsb-audio.json"); },
    /* Michael S. Heiser Foundation articles by the chapters they cite (scripts/fetch-heiser.py) */
    /* STEPBible's people and places (scripts/build-names.py): family lines and map positions for the Fact Book panel */
    names: function () { return getJSON("names.json").then(function (d) { NAMESD = d; return d; }).catch(function () { return null; }); },
    heiser: function () { return getJSON("heiser.json").catch(function () { return null; }); },
    /* a podcast's episodes through the relay, kept in the browser for 12 hours: {episodes:[{t, link, date, dur, audio, desc}]} */
    podcast: function (feed) {
      if (!CFG.podcastAPI) return Promise.resolve(null);
      var k = "__pod" + feed;
      return cache[k] || (cache[k] = getLive(CFG.podcastAPI + "?feed=" + feed, 12 * 3600 * 1000).catch(function () { cache[k] = null; return null; }));
    },
    maps: function () { return getJSON("maps.json").then(function (m) { MAPIDX = m || []; MAPIDX.forEach(function (x) { MAPBY[x.id] = x; }); return MAPIDX; }); },
    library: function () { return getJSON("shelf.json").then(function (d) { return { lib: (d && d.lib) || [], studyBibles: (d && d.studyBibles) || [], atlases: (d && d.atlases) || [] }; }); },
    /* James's Obsidian BOOKS vault, by author (scripts/build-vault-books.py); desk only, so the site gets null */
    vaultBooks: function () { return global.JAYMS_PUBLIC ? Promise.resolve(null) : getJSON("vault-books.json").catch(function () { return null; }); },
    shelf: function () { return getJSON("shelf.json").then(function (d) { return (SHELF = (d && d.books) || {}); }); },
    /* everything the panels show for a passage, by reference: "Psalm 82", "Daniel 10:13, 20-21" */
    passage: function (ref) {
      var key = R.key(ref);
      if (cache["p:" + key]) return cache["p:" + key];
      var segs = R.parse(ref);
      var books = []; segs.forEach(function (s) { if (books.indexOf(s.book) < 0) books.push(s.book); });
      /* wait for the live sources (or 8 seconds, then use the built copy for any still loading) */
      var live = Promise.race([liveAll(), new Promise(function (ok) { setTimeout(ok, 8000); })]);
      return (cache["p:" + key] = Promise.all([shared()].concat(books.map(function (b) { return bookIndex(b, segs); }), [live])).then(function (a) {
        var ixs = {}; books.forEach(function (b, i) { if (a[i + 1]) ixs[b] = a[i + 1]; });
        var d = segs.length ? assemble(ref, segs, ixs, a[0]) : { ref: ref, missing: true, segs: [], council: [], gods: [], facts: [], posts: [], vault: [], chats: [], library: [], words: [], verseNotes: {} };
        PEEK[ref] = d; return d;
      }));
    },
    peek: function (ref) { return PEEK[ref]; },
    segs: function (ref) { return R.parse(ref).map(withSlug); },
    /* the passage's text in every version the data has: [{book, c, v, texts: {LSB: "...", NET: "..."}, para}] */
    text: function (ref) {
      var segs = R.parse(ref), books = []; segs.forEach(function (s) { if (books.indexOf(s.book) < 0) books.push(s.book); });
      return Promise.all(books.map(function (b) { return bookFile("text", b, segs); })).then(function (files) {
        var tx = {}, pa = {}; books.forEach(function (b, i) { tx[b] = (files[i] && files[i].versions) || {}; pa[b] = (files[i] && files[i].para) || {}; });
        var rows = [];
        segs.forEach(function (s) {
          var vs = tx[s.book];
          for (var c = s.c1; c <= s.c2; c++) {
            var nums = {}; Object.keys(vs).forEach(function (ver) { Object.keys((vs[ver] || {})[c] || {}).forEach(function (v) { nums[v] = 1; }); });
            Object.keys(nums).map(Number).sort(function (a, b) { return a - b; }).forEach(function (v) {
              if (!R.contains([s], s.book, c, v)) return;
              var t = {}; Object.keys(vs).forEach(function (ver) { var x = ((vs[ver] || {})[c] || {})[v]; if (x) t[ver] = x; });
              rows.push({ book: s.book, c: c, v: v, texts: t, para: (pa[s.book][c] || []).indexOf(v) > -1 });   // para: a paragraph starts here (Reading view)
            });
          }
        });
        return rows;
      });
    },
    /* packed ten chapters a file, each word a list in the order of the pack's "_k" (scripts/pack-interlinear.py); expanded once,
       here, back into {text, gloss, strong ...} objects so every panel reads words the same way */
    interlinear: function (book, c) { return getJSON("interlinear/" + bookRow(book).il + "-" + Math.floor((c - 1) / 10) + ".json").then(function (d) {
      if (d && d._k) { var k = d._k; delete d._k;
        Object.keys(d).forEach(function (ch) { var vs = d[ch].verses; Object.keys(vs).forEach(function (v) { vs[v].words = vs[v].words.map(function (w) {
          var o = {}; for (var i = 0; i < k.length; i++) o[k[i]] = i < w.length ? w[i] : ""; return o; }); }); }); }
      return (d && d[c]) || null; }); },
    live: liveAll,
    liveStatus: function () { return LV.ok; },
    xref: function (ref) {
      var segs = data.segs(ref), books = [];
      segs.forEach(function (q) { if (books.indexOf(q.book) < 0) books.push(q.book); });
      return Promise.all(books.map(function (b) { return bookFile("study", b, segs); })).then(function (files) {
        var by = {}, out = [];
        var add = function (tref, votes, src, lab) {
          var ts = R.parse(tref); if (!ts.length || ts.some(function (a) { return segs.some(function (b) { return R.overlap(a, b); }); })) return;
          var key = R.format(ts), x = by[key];
          /* a study note naming part of a passage OpenBible already lists (John 10:34 inside John 10:34-36) is the same link */
          if (!x && src !== "OpenBible") x = out.filter(function (y) { return R.parse(y.ref).some(function (a) { return ts.some(function (b) { return R.overlap(a, b); }); }); })[0];
          if (!x) { var bk = R.book(ts[0].book); x = by[key] = { ref: key, votes: 0, from: [], src: [], book: ts[0].book, order: bk ? bk.order : 99, c: ts[0].c1, v: ts[0].v1 }; out.push(x); }
          x.votes = Math.max(x.votes, votes); if (x.src.indexOf(src) < 0) x.src.push(src);
          if (lab && x.from.indexOf(lab) < 0) x.from.push(lab);
        };
        segs.forEach(function (q) {
          var f = files[books.indexOf(q.book)], v = (f && f.x) || {};
          Object.keys(v).forEach(function (cv) {
            var p = cv.split(":"), c = +p[0], vv = +p[1];
            if (!R.contains([q], q.book, c, vv)) return;
            v[cv].forEach(function (t) { add(t[0], t[1], "OpenBible", segs.length > 1 || q.c1 !== q.c2 ? c + ":" + vv : String(vv)); });
          });
        });
        /* the verses the study Bible notes on this passage point to: two more sources beside OpenBible */
        segs.forEach(function (q) {
          var f = files[books.indexOf(q.book)];
          ((f && f.n) || []).forEach(function (n) {
            if (!R.overlap({ book: q.book, c1: n[0], v1: n[1], c2: n[2], v2: n[3] }, q)) return;
            var src = NOTE_SRC[n[4]].short, lab = n[0] === n[2] && n[1] === n[3] ? (q.c1 !== q.c2 ? n[0] + ":" : "") + n[1] : null;
            String(n[5]).replace(/\{\{([^|}]+)\|[^}]*\}\}/g, function (m, r) { add(r, 0, src, lab); return m; });
          });
        });
        /* more sources agreeing first, then readers' votes */
        out.sort(function (a, b) { return (b.src.length - a.src.length) || (b.votes - a.votes); });
        XREFN[ref] = out.length;
        return out;
      });
    },
    /* study Bible notes on a passage: [{c1, v1, c2, v2, src:{name, short, url, licence}, text}], in verse order */
    notes: function (ref) {
      var segs = data.segs(ref), books = [];
      segs.forEach(function (q) { if (books.indexOf(q.book) < 0) books.push(q.book); });
      return Promise.all(books.map(function (b) { return bookFile("study", b, segs); })).then(function (files) {
        var out = [];
        segs.forEach(function (q) {
          ((files[books.indexOf(q.book)] || {}).n || []).forEach(function (n) {
            if (R.overlap({ book: q.book, c1: n[0], v1: n[1], c2: n[2], v2: n[3] }, q)) out.push({ book: q.book, c1: n[0], v1: n[1], c2: n[2], v2: n[3], src: NOTE_SRC[n[4]], text: n[5] });
          });
        });
        NOTEN[ref] = out.length;
        return out;
      });
    },
    /* Church Fathers on the passage: excerpts in study/<book>.json "f" (scripts/build-fathers.py), [c, v1, v2, author, year, excerpt] */
    fathers: function (ref) {
      var segs = data.segs(ref), books = [];
      segs.forEach(function (q) { if (books.indexOf(q.book) < 0) books.push(q.book); });
      return Promise.all(books.map(function (b) { return bookFile("study", b, segs); })).then(function (files) {
        var out = [];
        segs.forEach(function (q) {
          ((files[books.indexOf(q.book)] || {}).f || []).forEach(function (f) {
            if (R.overlap({ book: q.book, c1: f[0], v1: f[1], c2: f[0], v2: f[2] }, q)) out.push({ book: q.book, c: f[0], v1: f[1], v2: f[2], by: f[3], year: f[4], text: f[5] });
          });
        });
        return out;
      });
    },
    /* the Aramaic Targums in English on the passage: study/<book>.json "t" {"c:v": [[label, text]]}, "tsrc" (scripts/build-targums.py) */
    targum: function (ref) {
      var segs = data.segs(ref), books = [];
      segs.forEach(function (q) { if (books.indexOf(q.book) < 0) books.push(q.book); });
      return Promise.all(books.map(function (b) { return bookFile("study", b, segs); })).then(function (files) {
        var rows = [], src = {};
        segs.forEach(function (q) {
          var F = files[books.indexOf(q.book)] || {}, T = F.t || {};
          Object.keys(F.tsrc || {}).forEach(function (k) { src[k] = F.tsrc[k]; });
          Object.keys(T).forEach(function (cv) {
            var c = +cv.split(":")[0], v = +cv.split(":")[1];
            if (R.overlap({ book: q.book, c1: c, v1: v, c2: c, v2: v }, q)) rows.push({ book: q.book, c: c, v: v, items: T[cv] });
          });
        });
        rows.sort(function (a, b) { return a.c - b.c || a.v - b.v; });
        return { rows: rows, src: src };
      });
    },
    /* the book's outline: live from the tool data's outline folder, the built copy if that can't load */
    outline: function (book) {
      var k = "__ol" + bookSlug(book);
      return cache[k] || (cache[k] = getLive(CFG.toolData + "outline/" + bookSlug(book) + ".json").catch(function () { return getJSON("outline/" + bookSlug(book) + ".json"); }));
    },
    diffs: function () {
      if (cache.__diffs) return cache.__diffs;
      /* live Translation Differences entries (via the live layer), the built map if that source didn't load */
      return (cache.__diffs = liveAll().then(function () { return LV.ok.diffs ? LV.diffs : getJSON("differences-map.json"); }).then(function (list) {
        list = list || []; var byV = {}, byS = {};
        list.forEach(function (x) {
          var m = String(x.ref).match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?[a-d]?$/);
          if (m) { var b = m[1] === "Psalms" ? "Psalm" : m[1];
            if (m[3]) { for (var v = +m[3]; v <= (m[4] ? +m[4] : +m[3]); v++) (byV[b + "|" + m[2] + ":" + v] = byV[b + "|" + m[2] + ":" + v] || []).push(x); }
            else (byV[b + "|" + m[2]] = byV[b + "|" + m[2]] || []).push(x); }
          (String(x.lemma).match(/\b[HG]\d{1,5}\b/g) || []).forEach(function (sn) { (byS[sn] = byS[sn] || []).push(x); });
        });
        return { list: list, byVerse: byV, byStrong: byS,
          /* a word is marked only when an entry is about the word in general, or about this exact verse */
          forWord: function (sk, book, c, v) {
            var re = new RegExp("^" + (book === "Psalm" ? "Psalms?" : book) + "\\s+" + c + ":" + v + "(?!\\d)");
            return (byS[sk] || []).filter(function (x) { return !/\d/.test(x.ref) || re.test(x.ref); });
          } };
      }));
    },
    /* every verse in a passage, with its interlinear words */
    verses: function (ref) {
      var segs = data.segs(ref), jobs = [];
      segs.forEach(function (q) { for (var c = q.c1; c <= q.c2; c++) jobs.push({ q: q, c: c }); });
      return Promise.all(jobs.map(function (j) { return data.interlinear(j.q.book, j.c); })).then(function (chs) {
        var out = [];
        chs.forEach(function (d, i) {
          if (!d) return; var q = jobs[i].q, c = jobs[i].c;
          Object.keys(d.verses).map(Number).sort(function (a, b) { return a - b; })
            .filter(function (v) { return (c > q.c1 || v >= q.v1) && (c < q.c2 || v <= q.v2); })
            .forEach(function (v) { out.push({ book: q.book, c: c, v: v, words: d.verses[v].words || [], net: d.verses[v].netFallback || "" }); });
        });
        return out;
      });
    }
  };

  // ------------------------------------------------------------------ styles (the per-panel bits; the shared look is jayms-study.css)

  // ------------------------------------------------------------------ the messages a panel can send its page
  /* Every panel reports back through emit(name, detail), and a page listens one of three ways:
       options.on = { word: fn, passage: fn, ... }   one handler object for every panel (what the workstation does)
       options.onWord / onMeta / ...                 a single callback (still works)
       el.addEventListener("jst:word", ...)          a DOM event that bubbles, for pages that prefer events
     The names, and what each detail carries: */
  var EVENTS = {
    meta:    "the panel's heading changed            {kick, title, wide, split}",
    word:    "open this word in Word Study            \"h430\" (Strong's key)",
    verse:   "open this verse's tools                 {book, c, v}",
    passage: "open this passage in the reader          {ref}",
    note:    "add this text to the passage's notes     {ref, text}",
    vocab:   "add this word to the vocabulary deck     {k, word, strong, gloss, ref}",
    vocabRemove: "drop a word from the vocabulary deck    {k}",
    idea:    "log a post idea                          {title, ref, text, answerId}",
    plan:       "save a reading plan (plans/<id>.json shape) {id, name, description, start, days:[{day, title, note, readings:[{ref, role, why}]}]}",
    planRemove: "delete a plan James made                 {id}",
    wrap:       "a wrap-up finished or changed             {id, title, refs, parts:{key:text}, at}",
    review:     "a flashcard was answered                 {k, knew, box, due, at}",
    shelfcfg:   "a shelf setting changed                  {key: authors|commentaries|studyBibles, value}",
    ideaSet:    "change a logged idea                     {id, written?, title?}",
    ideaRemove: "drop a logged idea                       {id}",
    mark:    "show this Hebrew & Greek mark            \"john-1-1\" (mark id)",
    logos:   "queue Logos searches                     {queries:[...], ref, answerId}",
    logosDone:   "mark a queued Logos block done or not    {id, done}",
    logosRemove: "drop a queued Logos block                {id}",
    answer:  "a Claude answer finished                 {id, ref, question, text, parsed, at}",
    thread:  "the X discussion changed                 {thread|null}"
  };

  // ------------------------------------------------------------------ base class
  function Panel(el, opts) {
    this.el = el; this.o = Object.assign({}, this.constructor.defaults || {}, opts || {});
    this.alive = true; this.st = {};
    el.classList.add("jst");
    var self = this;
    this._click = function (e) { self.click(e); };
    el.addEventListener("click", this._click);
    this.load();
  }
  Panel.prototype = {
    load: function () {
      var self = this, ref = this.o.ref, token = (this._tok = {});
      this.paint({ kick: this.constructor.meta.name, title: "Loading\u2026", body: none("Gathering this passage's material.") });
      return data.passage(ref).then(function (d) {
        if (!self.alive || self._tok !== token) return;
        self.d = d; return self.prepare ? self.prepare() : null;
      }).then(function () { if (self.alive && self._tok === token) self.paint(); });
    },
    prepare: null,
    paint: function (v) {
      if (!this.alive) return;
      var ready = !v; v = v || this.view();
      this.el.classList.toggle("jst-split", !!v.split);
      var keep = this.el.querySelector(".ilscroll"); keep = keep ? keep.scrollTop : 0;
      this.el.innerHTML = v.body;
      var sc = this.el.querySelector(".ilscroll"); if (sc) sc.scrollTop = keep;
      this.meta = { kick: v.kick, title: v.title, wide: !!v.wide, split: !!v.split };
      this.emit("meta", this.meta);
      if (ready && this.after) this.after();
    },
    view: function () { return { kick: "", title: "", body: "" }; },
    /* "+ Vocab" for any panel: v = {k, word, strong, gloss}; options.inVocab(k) says whether it is already in */
    vocabBtn: function (v) {
      if (this.o.owner === false) return "";   // readers (Read along) have no deck
      var has = !!(this.o.inVocab && v.k && this.o.inVocab(v.k));
      return '<button class="btn' + (has ? " on" : "") + '" data-jst-vocab="' + esc(JSON.stringify(v)) + '"' + (has ? " disabled" : "") + ">" + (has ? "\u2713 Vocab" : "+ Vocab") + "</button>";
    },
    click: function (e) {
      var go = e.target.closest("[data-jst-go]");
      if (go && this.el.contains(go)) { e.stopPropagation(); this.emit("passage", { ref: go.getAttribute("data-jst-go") }); return; }
      var vb = e.target.closest("[data-jst-vocab]");
      if (vb && this.el.contains(vb)) { e.stopPropagation(); var v = JSON.parse(vb.getAttribute("data-jst-vocab")); v.ref = this.o.ref; this.emit("vocab", v); vb.disabled = true; vb.classList.add("on"); vb.textContent = "\u2713 Vocab"; return; }
      var w = e.target.closest("[data-jst-word]");
      if (w && this.el.contains(w)) { e.stopPropagation(); this.word(w.getAttribute("data-jst-word"), w); }
    },
    word: function (k, el) {
      var full = el && el.getAttribute("data-wfull");
      if (full && !WORDS[k]) { try { var o = JSON.parse(full); o.k = k; WORDS[k] = o; } catch (e) {} }
      this.emit("word", k);
    },
    emit: function (name, detail) {
      var o = this.o, cb = "on" + name.charAt(0).toUpperCase() + name.slice(1), out;
      if (o.on && typeof o.on[name] === "function") out = o.on[name](detail, this);
      else if (typeof o[cb] === "function") out = o[cb](detail, this);
      this.el.dispatchEvent(new CustomEvent("jst:" + name, { detail: detail, bubbles: true }));
      return out;
    },
    setRef: function (ref) { if (ref === this.o.ref) return; this.o.ref = ref; this.st = {}; this.load(); },
    set: function (o) { Object.assign(this.o, o || {}); if (this.d) this.paint(); },
    refresh: function () { if (this.d) this.paint(); },
    /* leaving a panel stops a Claude answer still being written, unless the panel finishes in the background (keepRunning: the wrap-up) */
    destroy: function () { if (this.st && this.st.ctl && !this.keepRunning) try { this.st.ctl.abort(); } catch (e) {}
      this.alive = false; this.el.removeEventListener("click", this._click); this.el.classList.remove("jst", "jst-split"); this.el.innerHTML = ""; }
  };
  /* define(name, meta, proto, defaults, count) -> a Panel subclass */
  function define(name, meta, proto, defaults, count) {
    function P(el, opts) { Panel.call(this, el, opts); }
    P.prototype = Object.create(Panel.prototype); P.prototype.constructor = P;
    Object.assign(P.prototype, proto);
    P.meta = meta; P.defaults = defaults || {}; P.count = count || function () { return null; };
    api[name] = P; api.panels[meta.id] = P;
    return P;
  }

  var ICON = {
    verse: '<svg viewBox="0 0 24 24"><path d="M4 5h16M4 10h10M4 15h16M4 20h10"/></svg>',
    outline: '<svg viewBox="0 0 24 24"><path d="M4 5h6M4 12h6M4 19h6"/><path d="M14 5h6M14 9h4M14 12h6M14 16h4M14 19h6"/></svg>',
    word: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="M15 15l5 5M7.5 10h5"/></svg>',
    council: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="2.5"/><circle cx="5" cy="13" r="2"/><circle cx="19" cy="13" r="2"/><circle cx="8.5" cy="19" r="2"/><circle cx="15.5" cy="19" r="2"/></svg>',
    gods: '<svg viewBox="0 0 24 24"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>',
    facts: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    posts: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10v4H7zM7 15h10M7 18h6"/></svg>',
    corpus: '<svg viewBox="0 0 24 24"><path d="M4 4v16M8 4v16M12 6l3 14M17 4l3 16"/></svg>',
    vault: '<svg viewBox="0 0 24 24"><path d="M12 2l7 5-2 12-5 3-5-3-2-12z"/><path d="M12 2v20M5 7l7 5 7-5"/></svg>',
    chats: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    claude: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M5 4l14 16M19 4L5 20"/></svg>',
    logos: '<svg viewBox="0 0 24 24"><path d="M4 5h11a5 5 0 0 1 0 10H9v4H4z"/><path d="M9 9h6"/></svg>'
  };
  var api = { events: EVENTS, parseAnswer: function (t) { return parseAnswer(t); }, config: config, data: data, util: { esc: esc, md: md, box: box, outlink: outlink, none: none, slug: slug, parseRef: parseRef, overlap: overlap, bookRow: bookRow, strongKey: strongKey },
              Panel: Panel, define: define, panels: {}, icons: ICON, version: "1.0.0" };
  var L = function (self, k) { return (self.d && self.d[k]) || []; };

  // ------------------------------------------------------------------ Council
  define("Council", { id: "council", label: "Council", name: "Divine Council Index", icon: ICON.council }, {
    view: function () {
      var all = L(this, "council"), mains = all.filter(function (e) { return e.main; }), rest = all.filter(function (e) { return !e.main; });
      if (!mains.length) return { kick: "Divine Council Index", title: "The council in this text", body: none("The Divine Council Index has no entry on " + esc(this.o.ref) + ".") + outlink(CFG.site + "divine-council-index/", "Open the Divine Council Index") };
      var h = "";
      mains.forEach(function (m) {
        h += '<div class="item"><span class="when">' + esc(m.cat) + " \u00B7 " + esc(m.group) + '</span><span class="tt">' + esc(m.title) + "</span></div>";
        if (m.plain) h += '<div class="box plain"><p class="u-m0">' + md(m.plain) + "</p></div>";
        if (m.prob) h += box("explain", "The problem", "<p>" + esc(m.prob) + "</p>");
        if (m.res) h += box("explain", "What this reading resolves", "<p>" + esc(m.res) + "</p>");
        h += outlink(entryURL("council", m.id), "Full entry");
      });
      if (rest.length) h += '<div class="lbl">Reads with</div>' + rest.map(function (e) { return box("apparatus", "", '<div class="item"><span class="when">' + esc(e.cat) + '</span><span class="tt">' + esc(e.title) + '</span><span class="sub">' + esc(e.summary) + "</span>" + outlink(entryURL("council", e.id), "Entry") + "</div>"); }).join("");
      return { kick: "Divine Council Index \u00B7 " + mains.length + " entr" + (mains.length > 1 ? "ies" : "y") + " for this passage", title: "The council in this text", body: h };
    }
  }, {}, function (d) { return d ? (d.council || []).filter(function (e) { return e.main; }).length : null; });

  // ------------------------------------------------------------------ Gods
  define("Gods", { id: "gods", label: "Gods", name: "Gods of the Bible", icon: ICON.gods }, {
    view: function () {
      var g = L(this, "gods");
      var h = g.length ? g.map(function (x, i) { return box(i ? "apparatus" : "witness", "", '<div class="item"><span class="tt">' + esc(x.title) + '</span><span class="sub">' + esc(x.summary) + "</span>" + (x.plain ? '<p class="u-mt8">' + md(x.plain) + "</p>" : "") + outlink(entryURL("gods", x.id), "Full entry") + "</div>"); }).join("")
        : none("No one from Gods of the Bible is named in " + esc(this.o.ref) + ".");
      return { kick: "Gods of the Bible \u00B7 " + g.length + " named here", title: "Who is in the room", body: h + outlink(CFG.site + "gods-of-the-bible/", "Open Gods of the Bible") };
    }
  }, {}, function (d) { return d ? (d.gods || []).length : null; });

  // ------------------------------------------------------------------ Fact Book
  /* STEPBible's records for the people and places named in the passage, in the order they first appear */
  var NAMESD = null, DSSD = null, ARTREFS = null, RELREFS = null;   // loaded by data.counts(), so the dock buttons can count without opening their panels
  function refsHit(refs, ref) { var segs = data.segs(ref); return refs.some(function (r) { return R.parse(r).some(function (a) { return segs.some(function (q) { return R.overlap(a, q); }); }); }); }
  /* the manuscripts holding any verse of the passage, most verses first (the Scrolls panel and its button) */
  function dssList(D, ref) {
    var by = {}, order = [];
    data.segs(ref).forEach(function (q) {
      for (var c = q.c1; c <= (q.c2 || q.c1); c++) { var ch = D.v[q.book + "|" + c] || {};
        Object.keys(ch).forEach(function (v) { var n = +v; if ((c === q.c1 && n < q.v1) || (c === (q.c2 || q.c1) && n > q.v2)) return;
          ch[v].forEach(function (ms) { if (!by[ms]) { by[ms] = { ms: ms, vs: [] }; order.push(ms); } by[ms].vs.push([q.book, c, n]); }); }); }
    });
    return order.map(function (k) { return by[k]; }).sort(function (a, b) { return b.vs.length - a.vs.length; });
  }
  function namesIn(nm, ref) {
    if (!nm) return [];
    var out = [], seen = {};
    data.segs(ref).forEach(function (q) {
      for (var c = q.c1; c <= (q.c2 || q.c1); c++) (((nm.ix[q.book] || {})[c]) || []).forEach(function (row) {
        var lo = c === q.c1 ? q.v1 : 1, hi = c === (q.c2 || q.c1) ? q.v2 : 999;
        if (!row.slice(1).some(function (v) { return v >= lo && v <= hi; }) || seen[row[0]]) return;
        seen[row[0]] = 1; out.push(Object.assign({ id: row[0] }, nm.p[row[0]]));
      });
    });
    return out;
  }
  /* one line of family, or a place's map: "Son of Salmon and Rahab · husband of Ruth · father of Obed · Tribe of Judah" */
  function nameLine(p) {
    var and = function (a) { return a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a[0]; };
    if (p.t === "Place") return p.tr && p.tr !== p.n ? esc(p.tr) : "";
    var f = p.t === "Female", bits = [];
    if (p.par) bits.push((f ? "Daughter" : "Son") + " of " + and(p.par));
    if (p.sib) bits.push((f ? "sister" : "brother") + " of " + and(p.sib));
    if (p.sp) bits.push((f ? "wife" : "husband") + " of " + and(p.sp));
    if (p.ch) bits.push((f ? "mother" : "father") + " of " + and(p.ch.slice(0, 6)) + (p.ch.length > 6 ? " and " + (p.ch.length - 6) + " more" : ""));
    if (p.tr) bits.push(p.tr);
    return esc(bits.join(" \u00B7 ").replace(/^./, function (x) { return x.toUpperCase(); }));
  }
  define("FactBook", { id: "facts", label: "Fact Book", name: "Fact Book", icon: ICON.facts }, {
    prepare: function () { var self = this; return Promise.all([data.names(), data.maps(), getJSON("map-places.json").catch(function () { return null; })]).then(function (r) { self.nm = r[0]; self.mp = r[2] || {}; }); },
    /* the Bible-era maps a place is on (Biblica Open Bible Maps, tagged by place): they open full screen here */
    mapsHTML: function (p) {
      var segs = data.segs(this.o.ref), ot = segs[0] && R.book(segs[0].book).order < 39, rank = {};
      /* the maps for this passage first, then this book's, then this testament's (an OT place in Ruth shouldn't open a Matthew map first) */
      var ids = (this.mp[p.n] || []).filter(function (i) { return MAPBY[i]; });
      ids.forEach(function (i, n) { var m = MAPBY[i], r = m.r || [], sc = 0;
        if (r.some(function (x) { return segs.some(function (q) { return R.overlap({ book: x[0], c1: x[1], v1: x[2], c2: x[3], v2: x[4] }, q); }); })) sc += 4;
        if (r.some(function (x) { return segs.some(function (q) { return x[0] === q.book; }); })) sc += 2;
        if ((i.charAt(0) === "O") === !!ot) sc += 1;
        rank[i] = sc * 1000 - n; });
      ids.sort(function (x, y) { return rank[y] - rank[x]; });
      var seenT = {}; ids = ids.filter(function (i) { var t = MAPBY[i].t.replace(/^[^:]+:\s*/, ""); if (seenT[t]) return false; seenT[t] = 1; return true; });
      if (!ids.length) return "";
      var first = MAPBY[ids[0]], name = function (i) { return esc(MAPBY[i].t.replace(/^[^:]+:\s*/, "")); };
      /* the best map shows on the card; tap it (or any title) for full screen */
      return '<div class="lbl u-mt8">Map \u00B7 ' + name(ids[0]) + '</div><img class="jst-mapimg u-mt6" src="' + esc(mapOnline(first)) + '" alt="' + esc(first.t) + '" data-jst-pmap="' + esc(ids[0]) + '" role="button" tabindex="0" title="Full screen"' + (++this._maps > 2 ? ' loading="lazy"' : "") + ">" +
        (ids.length > 1 ? '<div class="lbl u-mt8">More maps</div><div class="chips">' + ids.slice(1, 5).map(function (i) { return '<button class="chip" data-jst-pmap="' + esc(i) + '">' + name(i) + "</button>"; }).join("") + "</div>" : "");
    },
    /* STEPBible's own entry: the short one at once, the full article when opened */
    stepHTML: function (p) {
      if (!p.s) return "";
      return '<details class="jst-past" data-jst-step="' + esc(p.id) + '"><summary class="lbl">STEPBible entry</summary><p class="u-m4-8 u-fs15">' + esc(p.s) + '</p><div class="u-fs15" data-jst-art></div></details>';
    },
    click: function (e) {
      var m = e.target.closest("[data-jst-pmap]");
      if (m) { e.stopPropagation(); mapViewer(MAPBY[m.getAttribute("data-jst-pmap")]); return; }
      var sum = e.target.closest("[data-jst-step] summary");
      if (sum) { var d = sum.parentNode, slot = d.querySelector("[data-jst-art]"), id = d.getAttribute("data-jst-step");
        if (!slot.innerHTML) getJSON("names-articles.json").then(function (a) { var t = a && a[id]; if (t) slot.innerHTML = t.split(/\s*<br\s*\/?>\s*/i).filter(Boolean).map(function (x) { return "<p class=\"u-m4-8\">" + esc(x) + "</p>"; }).join(""); }).catch(function () {}); }
      Panel.prototype.click.call(this, e);
    },
    view: function () {
      var f = L(this, "facts"), st = namesIn(this.nm, this.o.ref), used = {};
      this._maps = 0;   // the first two maps load at once; the rest as they scroll into view
      /* a Fact Book entry gets STEPBible's family line or map when the same name is in the passage */
      var self = this, extra = function (p) { return p ? self.mapsHTML(p) + self.stepHTML(p) : ""; };
      var match = function (x) { for (var i = 0; i < st.length; i++) if (!used[i] && st[i].n === x.title) { used[i] = 1; return st[i]; } return null; };
      var h = f.map(function (x) { var p = match(x), line = p ? nameLine(p) : "";
        return box("apparatus", "", '<div class="item"><span class="when">' + esc([x.kind, x.about].filter(Boolean).join(" \u00B7 ")) + '</span><span class="tt">' + esc(x.title) + '</span><p class="sub u-m4-8 u-fs15">' + esc(x.note) + "</p>" +
          (line ? '<p class="u-m4-8 u-fs15">' + line + "</p>" : "") + extra(p) + outlink(entryURL("facts", x.id), "Fact Book entry") + "</div>"); }).join("");
      var more = st.filter(function (p, i) { return !used[i]; });
      if (more.length) h += (f.length ? '<div class="lbl u-mt14">Also named here</div>' : "") + more.map(function (p) {
        var line = nameLine(p);
        return box("apparatus", "", '<div class="item"><span class="when">' + esc(p.t === "Place" ? "Place" : (p.d || "Person")) + '</span><span class="tt">' + esc(p.n) + "</span>" +
          (p.b ? '<p class="sub u-m4-8 u-fs15">' + esc(p.b) + "</p>" : "") + (line ? '<p class="u-m4-8 u-fs15">' + line + "</p>" : "") + extra(p) + "</div>"); }).join("");
      if (!f.length && !more.length) h = none("No people or places are named in " + esc(this.o.ref) + ".");
      return { kick: "Fact Book \u00B7 " + (f.length + more.length) + " people and places", title: "People and places here", body: h + outlink(CFG.site + "bible-entity-explorer/", "Open the Fact Book") +
        '<p class="ctx u-fs13">Family lines, STEPBible entries and "Also named here": <a href="https://www.stepbible.org/" target="_blank" rel="noopener">STEPBible</a> (TIPNR, CC BY 4.0). Maps: <a href="https://github.com/BibleAquifer/BiblicaOpenBibleMaps" target="_blank" rel="noopener">Biblica Open Bible Maps</a> (CC BY-SA 4.0); tap one to open it full screen.</p>' +
        (LV.ok.facts ? "" : '<p class="ctx u-fs13">' + liveNote() + "</p>") };
    }
  }, { slug: "fact-book-alpha" }, function (d) {   // entries plus the people and places named; unknown (null) until names.json is in
    if (!d) return null; var f = (d.facts || []).length;
    return NAMESD ? f + namesIn(NAMESD, d.ref).length : (f || null); });

  // ------------------------------------------------------------------ Maps
  /* Every place named in the passage (STEPBible's positions) pinned on the Digital Atlas of the Roman Empire, an ancient-world base
     map (ancient names, terrain, Roman roads; dh.gu.se, CC BY), then the Biblica Bible maps for the passage and for each place.
     Leaflet draws the map; it loads from cdnjs the first time the panel opens. Where outside images are blocked (claude.ai) the
     panel lists the places and maps without the drawn map. */
  var LEAFLET = null;
  function leaflet() {
    if (LEAFLET) return LEAFLET;
    LEAFLET = new Promise(function (ok, no) {
      var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
      var sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; sc.onload = function () { ok(global.L); }; sc.onerror = no; document.head.appendChild(sc);
    });
    return LEAFLET;
  }
  define("Maps", { id: "maps", label: "Maps", name: "Maps of this passage", icon: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>' }, {
    prepare: function () { var self = this; return Promise.all([data.names(), data.maps(), getJSON("map-places.json").catch(function () { return null; }), this.o.owner ? data.library().catch(function () { return null; }) : null]).then(function (r) { self.nm = r[0]; self.mp = r[2] || {}; self.at = (r[3] && r[3].atlases) || []; }); },
    view: function () {
      var self = this, places = namesIn(this.nm, this.o.ref).filter(function (p) { return p.t === "Place"; });
      var pinned = places.filter(function (p) { return p.ll; });
      var ms = mapsFor(this.o.ref), h = "";
      if (pinned.length && CFG.onlineMaps) h += '<div class="jst-leaf" data-jst-leaf></div><p class="ctx u-fs13">Tap a pin for the place. Base map: <a href="https://dh.gu.se/dare/" target="_blank" rel="noopener">Digital Atlas of the Roman Empire</a> (CC BY); positions: STEPBible.</p>';
      if (places.length) h += '<div class="lbl u-mt14">Places in ' + esc(this.o.ref) + " (" + places.length + ")</div>" + places.map(function (p) {
        var on = (self.mp[p.n] || []).filter(function (i) { return MAPBY[i]; }).slice(0, 3);
        return box("witness", "", '<div class="item"><span class="tt">' + esc(p.n) + "</span>" + (p.b ? '<p class="sub u-m4-8 u-fs15">' + esc(p.b) + "</p>" : "") +
          (on.length ? '<div class="chips">' + on.map(function (i) { return '<button class="chip" data-jst-pmap="' + esc(i) + '">' + esc(MAPBY[i].t.replace(/^[^:]+:\s*/, "")) + "</button>"; }).join("") + "</div>" : "") +
          (p.ll && CFG.onlineMaps ? '<button class="btn u-mt6" data-jst-fly="' + esc(p.id) + '">Show on the map</button>' : "") + "</div>"); }).join("");
      else h += none("No place is named in " + esc(this.o.ref) + ".");
      h += '<div class="lbl u-mt14">Bible maps for ' + esc(this.o.ref) + " (" + ms.length + ")</div>" + (ms.length ? box("witness", "", '<div class="item">' + ms.map(function (m) { return '<p class="u-m5"><button class="tt jst-xt" data-jst-pmap="' + esc(m.id) + '">' + esc(m.t.replace(/^[^:]+:\s*/, "")) + "</button></p>"; }).join("") + "</div>") : none("No Biblica map is tied to this passage."));
      if (this.o.owner && (this.at || []).length) h += '<div class="lbl u-mt14">My atlases in Logos (' + this.at.length + ")</div>" + this.at.map(function (x) { return '<p class="u-m5">' + outlink(R.logos(x[0]), esc(x[1])) + "</p>"; }).join("");   // (moved from the Shelf's old Maps tab)
      h += '<p class="ctx u-fs13">Bible maps: <a href="https://github.com/BibleAquifer/BiblicaOpenBibleMaps" target="_blank" rel="noopener">Biblica Open Bible Maps</a> (CC BY-SA 4.0); tap one for full screen.</p>';
      return { kick: "Maps \u00B7 " + places.length + " places", title: "Where this happens", body: h };
    },
    after: function () {
      var self = this, box_ = this.el.querySelector("[data-jst-leaf]");
      if (!box_) return;
      var pinned = namesIn(this.nm, this.o.ref).filter(function (p) { return p.t === "Place" && p.ll; });
      leaflet().then(function (L) {
        if (!self.alive || !box_.isConnected) return;
        var map = L.map(box_, { scrollWheelZoom: false, attributionControl: false, maxZoom: 11 });
        L.tileLayer("https://dh.gu.se/tiles/imperium/{z}/{x}/{y}.png", { maxZoom: 11 }).addTo(map);
        self._pins = {};
        var pts = pinned.map(function (p) {
          var mk = L.circleMarker(p.ll, { radius: 7, color: "#5a3c10", weight: 2, fillColor: "#d4a85c", fillOpacity: .95 }).addTo(map)
            .bindPopup("<b>" + esc(p.n) + "</b>" + (p.b ? "<br>" + esc(p.b) : ""));
          self._pins[p.id] = mk; return p.ll; });
        if (pts.length === 1) map.setView(pts[0], 8); else map.fitBounds(pts, { padding: [28, 28], maxZoom: 9 });
        self._map = map;
      }).catch(function () { box_.outerHTML = '<p class="ctx">The map didn\'t load here.</p>'; });
    },
    click: function (e) {
      var m = e.target.closest("[data-jst-pmap]");
      if (m) { e.stopPropagation(); mapViewer(MAPBY[m.getAttribute("data-jst-pmap")]); return; }
      var f = e.target.closest("[data-jst-fly]");
      if (f && this._map) { e.stopPropagation(); var mk = this._pins[f.getAttribute("data-jst-fly")]; if (mk) { this._map.setView(mk.getLatLng(), 9); mk.openPopup(); this.el.closest(".pbody, #pbody") && (this.el.parentNode.scrollTop = 0); } return; }
      Panel.prototype.click.call(this, e);
    },
    destroy: function () { if (this._map) { try { this._map.remove(); } catch (e) {} this._map = null; } Panel.prototype.destroy.call(this); }
  }, {}, function (d) {   // places named plus Bible maps for the verses
    if (!d || !NAMESD || !MAPIDX) return null;
    return namesIn(NAMESD, d.ref).filter(function (p) { return p.t === "Place"; }).length + mapsFor(d.ref).length; });

  // ------------------------------------------------------------------ Family
  /* A family tree for anyone named in the passage (STEPBible's TIPNR links): grandparents, parents, the person with their
     spouses and brothers and sisters, children and grandchildren. Tap any relative to move the tree to them. */
  define("Family", { id: "family", label: "Family", name: "Family tree", icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="2"/><circle cx="6" cy="19.5" r="2"/><circle cx="18" cy="19.5" r="2"/><path d="M12 6.5v6M6 17.5v-5h12v5"/></svg>' }, {
    prepare: function () { var self = this; return data.names().then(function (n) { self.nm = n; }); },
    view: function () {
      var nm = this.nm, st = this.st;
      if (!nm) return { kick: "Family", title: "Family tree", body: none("The family data didn't load.") };
      var P = nm.p, here = namesIn(nm, this.o.ref).filter(function (p) { return p.t === "Male" || p.t === "Female"; });
      var ids = function (p, k) { return ((p && p[k + "i"]) || []).filter(function (i) { return i && P[i]; }); };
      var withKids = here.filter(function (p) { return ids(p, "par").length || ids(p, "ch").length || ids(p, "sp").length; });
      if (!st.focus || !P[st.focus]) st.focus = (withKids[0] || here[0] || {}).id;
      if (!st.focus) return { kick: "Family", title: "Family tree", body: none("No one with a recorded family is named in " + esc(this.o.ref) + ".") };
      var f = P[st.focus], chip = function (i, on) { var p = P[i]; return '<button class="chip' + (on ? " on" : "") + '" data-jst-fam="' + esc(i) + '" title="' + esc(p.b || p.d || "") + '">' + esc(p.n) + "</button>"; };
      var row = function (label, list) { return list.length ? '<div class="jst-famrow"><div class="lbl">' + label + '</div><div class="chips">' + list.map(function (i) { return chip(i); }).join("") + "</div></div>" : ""; };
      var uniq = function (a) { var o = []; a.forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; };
      var par = ids(f, "par"), kids = ids(f, "ch");
      var grand = uniq([].concat.apply([], par.map(function (i) { return ids(P[i], "par"); })));
      var gkids = uniq([].concat.apply([], kids.map(function (i) { return ids(P[i], "ch"); })));
      var h = "";
      if (here.length > 1) h += '<div class="lbl">Named in ' + esc(this.o.ref) + '</div><div class="chips u-mb10">' + here.map(function (p) { return chip(p.id, p.id === st.focus); }).join("") + "</div>";
      h += '<div class="jst-fam">' + row("Grandparents", grand) + row("Parents", par) +
        '<div class="jst-famrow jst-famme"><div class="lbl">' + esc(f.d || "") + '</div><div class="tt u-fs20">' + esc(f.n) + "</div>" + (f.b ? '<p class="u-m4-8 u-fs15">' + esc(f.b) + "</p>" : "") + (f.tr ? '<p class="sub u-fs13">' + esc(f.tr) + "</p>" : "") + "</div>" +
        row(f.t === "Female" ? "Husband" + (ids(f, "sp").length > 1 ? "s" : "") : "Wife" + (ids(f, "sp").length > 1 ? "s" : ""), ids(f, "sp")) +
        row("Brothers and sisters", ids(f, "sib")) + row("Children", kids) + row("Grandchildren", gkids) + "</div>";
      if (!par.length && !kids.length && !ids(f, "sp").length && !ids(f, "sib").length) h += none("STEPBible records no family for " + esc(f.n) + ".");
      h += '<p class="ctx u-fs13">Tap a name to move the tree to them. From <a href="https://www.stepbible.org/" target="_blank" rel="noopener">STEPBible</a> (TIPNR, CC BY 4.0).</p>';
      return { kick: "Family \u00B7 " + here.length + " people here", title: f.n + "'s family", body: h };
    },
    click: function (e) {
      var c = e.target.closest("[data-jst-fam]");
      if (c) { e.stopPropagation(); this.st.focus = c.getAttribute("data-jst-fam"); this.paint(); this.el.parentNode && (this.el.parentNode.scrollTop = 0); return; }
      Panel.prototype.click.call(this, e);
    }
  }, {}, function (d) {   // the people named, each with a family tree to show
    if (!d || !NAMESD) return null;
    return namesIn(NAMESD, d.ref).filter(function (p) { return p.t === "Male" || p.t === "Female"; }).length; });

  // ------------------------------------------------------------------ Scrolls
  /* The Dead Sea Scrolls that contain the passage (dss.json, ETCBC/Abegg, CC BY-NC 4.0), with the Leon Levy library's own
     photographs of each manuscript (dss-images.json, scripts/build-dss-images.py). Tap a photo for full screen. */
  define("Scrolls", { id: "scrolls", label: "Scrolls", name: "Dead Sea Scrolls of this passage", icon: '<svg viewBox="0 0 24 24"><path d="M6 4h11a2 2 0 0 1 0 4H6M6 4a2 2 0 0 0 0 4v10a2 2 0 0 0 2 2h11a2 2 0 0 1 0-4H8"/></svg>' }, {
    prepare: function () { var self = this; return Promise.all([data.dss(), getJSON("dss-images.json").catch(function () { return {}; })]).then(function (r) { self.D = r[0]; self.im = r[1] || {}; }); },
    view: function () {
      var D = this.D, im = this.im;
      if (!D) return { kick: "Scrolls", title: "Dead Sea Scrolls", body: none("The scroll data didn't load.") };
      var list = dssList(D, this.o.ref);
      /* "1:1-8, 13-15" */
      var spans = function (vs) { var out = [], lastC = null, run = null;
        vs.forEach(function (x) { if (run && x[1] === run.c && x[2] === run.b + 1) { run.b = x[2]; return; } run = { c: x[1], a: x[2], b: x[2] }; out.push(run); });
        return out.map(function (r) { var t = (r.c !== lastC ? r.c + ":" : "") + r.a + (r.b > r.a ? "\u2013" + r.b : ""); lastC = r.c; return t; }).join(", "); };
      if (!list.length) return { kick: "Scrolls \u00B7 none", title: "Dead Sea Scrolls", body: none("No Dead Sea Scroll manuscript contains " + esc(this.o.ref) + ". Many books survive only in pieces.") };
      var h = list.map(function (x) {
        var s = D.s[x.ms] || [x.ms, ""], ph = (im[x.ms] || []).slice(0, 4);
        return box("witness", "", '<div class="item"><span class="when">' + esc(x.ms) + " \u00B7 " + x.vs.length + " verse" + (x.vs.length > 1 ? "s" : "") + '</span><span class="tt">' + esc(s[0]) + '</span><p class="sub u-m4-8 u-fs15">' + esc(spans(x.vs)) + "</p>" +
          (ph.length && CFG.onlineMaps ? '<div class="jst-artgrid">' + ph.map(function (p) { return '<figure><img src="' + esc(p[0]) + '=s400" alt="' + esc(s[0] + " plate " + p[1]) + '" referrerpolicy="no-referrer" data-jst-scroll="' + esc(p[0]) + '" data-t="' + esc(s[0] + (p[1] ? ", plate " + p[1] : "") + (p[2] ? ", " + p[2] : "")) + '" role="button" tabindex="0"><figcaption>' + esc([p[1] ? "Plate " + p[1] : "", p[2]].filter(Boolean).join(" \u00B7 ")) + "</figcaption></figure>"; }).join("") + "</div>" : "") +
          outlink(s[1], s[1].indexOf("imj.org.il") > -1 ? "Open the scroll (Israel Museum)" : "All photographs (Leon Levy Library)") + "</div>"); }).join("");
      h += '<p class="ctx u-fs13">Which scrolls hold which verses: ETCBC/Martin Abegg (CC BY-NC 4.0). Photographs: <a href="https://www.deadseascrolls.org.il/" target="_blank" rel="noopener">Leon Levy Dead Sea Scrolls Digital Library</a>, Israel Antiquities Authority. Tap one for full screen.</p>';
      return { kick: "Dead Sea Scrolls \u00B7 " + list.length + " manuscript" + (list.length > 1 ? "s" : ""), title: "Scrolls of " + this.o.ref, body: h };
    },
    after: function () { dropBroken(this.el); },
    click: function (e) {
      var im = e.target.closest("[data-jst-scroll]");
      if (im) { e.stopPropagation(); mapViewer({ id: "dss-" + im.getAttribute("data-jst-scroll"), t: im.getAttribute("data-t"), img: im.getAttribute("data-jst-scroll") + "=s2000" }); return; }
      Panel.prototype.click.call(this, e);
    }
  }, {}, function (d) { return d && DSSD ? dssList(DSSD, d.ref).length : null; });   // manuscripts holding these verses

  // ------------------------------------------------------------------ Art
  /* Paintings of the scene in front of you, matched by its verses ahead of time (art.json, scripts/build-art.py): artworks museums
     have tagged with the scene's Iconclass code (the subject index they use; listed in Wikidata), and Wikimedia Commons scene
     categories for the rest. No search by name at view time, so no namesakes and no dead links. Exact scenes first; scenes the
     text only implies (the Lamentation, the Rest on the Flight) follow as "Related". Then the relics and objects tied to the verses.
     Tap a picture for full screen. Where outside images are blocked (claude.ai) the panel says so. */
  /* a picture that won't load takes its card with it, so the panel never shows empty frames */
  function dropBroken(root) {
    root.querySelectorAll("img").forEach(function (i) {
      var gone = function () { var f = i.closest("figure") || (i.classList.contains("jst-relic") ? i : null); if (f) f.remove(); };
      if (i.complete && i.getAttribute("src") && !i.naturalWidth) gone(); else i.addEventListener("error", gone, { once: true });
    });
  }
  define("Art", { id: "art", label: "Art", name: "Art of this passage", icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/></svg>' }, {
    prepare: function () {
      var self = this, segs = data.segs(this.o.ref);
      this.bk = R.book(segs[0].book).name;
      var hits = function (refs) { return refs.some(function (r) { return R.parse(r).some(function (a) { return segs.some(function (q) { return R.overlap(a, q); }); }); }); };
      return Promise.all([
        getJSON("art.json").then(function (d) { self.scenes = ((d && d.subjects) || []).filter(function (x) { return x.works.length && hits(x.refs); }); }).catch(function () { self.scenes = []; }),
        getJSON("relics.json").then(function (d) { self.relics = ((d && d.relics) || []).filter(function (x) { return hits(x.refs); }); }).catch(function () { self.relics = []; })
      ]);
    },
    view: function () {
      if (!CFG.onlineMaps) return { kick: "Art", title: "Art of this passage", body: none("Pictures from other sites can't show here. Open the app on jayms.com or your desk.") };
      var sc = (this.scenes || []).filter(function (x) { return !x.near; }), near = (this.scenes || []).filter(function (x) { return x.near; }), rel = this.relics || [], shown = 0;
      var bk = this.bk;
      var scene = function (x) {   /* the verses in the book you're reading come first; the Gospel parallels after, three at most */
        var rs = x.refs.filter(function (r) { return r.indexOf(bk + " ") === 0; }).concat(x.refs.filter(function (r) { return r.indexOf(bk + " ") !== 0; }));
        return '<div class="lbl u-mt14">' + esc(x.t) + " · " + esc(rs.slice(0, 3).join("; ") + (rs.length > 3 ? " +" + (rs.length - 3) : "")) + "</div>" + (x.look ? '<p class="ctx u-m4-8">' + esc(x.look) + "</p>" : "") +
          '<div class="jst-artgrid">' + x.works.map(function (w) {
            var cap = [w.by, w.d || w.y].filter(Boolean).join(", ");
            return '<figure><img src="' + esc(w.img) + '" alt="' + esc(w.t) + '"' + (shown++ >= 6 ? ' loading="lazy"' : "") + ' referrerpolicy="no-referrer" data-jst-art data-full="' + esc(w.full || w.img) + '" data-t="' + esc([w.t, cap, w.at].filter(Boolean).join(", ")) + '" role="button" tabindex="0">' +
              "<figcaption><b>" + esc(w.t) + "</b>" + (cap ? "<br>" + esc(cap) : "") + (w.at ? "<br>" + esc(w.at) : "") + " " + outlink(w.page, "Source") + "</figcaption></figure>"; }).join("") + "</div>";
      };
      var h = sc.map(scene).join("");
      if (near.length) h += (sc.length ? '<details class="jst-past u-mt14"><summary class="lbl">Related scenes (' + near.length + ")</summary>" : "") + near.map(scene).join("") + (sc.length ? "</details>" : "");
      if (!sc.length && !near.length) h += none("No paintings of a scene in " + esc(this.o.ref) + " yet.");
      /* the objects in the story (a shofar for Joshua 6, a lepton for the widow's mite), then inscriptions and finds that bear on it */
      var card = function (x) {
        return box("witness", "", '<div class="item">' + (x.img ? '<img class="jst-relic" src="' + esc(x.img) + '" alt="' + esc(x.t) + '" referrerpolicy="no-referrer" data-jst-art data-full="' + esc(x.img.replace(/\/\d+px-/, "/1280px-")) + '" data-t="' + esc(x.t) + '" role="button" tabindex="0">' : "") +
          (x.museum ? '<span class="when">' + esc(x.museum) + "</span>" : "") + '<span class="tt">' + esc(x.t) + '</span><p class="u-m4-8 u-fs15">' + esc(x.x) + "</p>" +
          '<p class="sub u-fs13">' + esc(x.refs.join(" \u00B7 ")) + "</p>" + outlink(x.url, "Read more") + "</div>"); };
      var objs = rel.filter(function (x) { return x.kind === "object"; }), finds = rel.filter(function (x) { return x.kind !== "object"; });
      if (objs.length) h += '<div class="lbl u-mt14">Objects in the story (' + objs.length + ")</div>" + objs.map(card).join("");
      if (finds.length) h += '<div class="lbl u-mt14">Relics and inscriptions (' + finds.length + ")</div>" + finds.map(card).join("");
      /* more in the museums' own collections: searched by the scene's main name (Jericho, Isaac, Pilate), or the book's */
      var key = (function () { var t = (sc[0] || near[0] || {}).t || "", ws = t.match(/\b[A-Z][a-z\u00C0-\u017F']+\b/g) || [];
        ws = ws.filter(function (w) { return !/^(The|A|An|Parable|Christ|Jesus|God|Lord|Saint|St|Creation|Division|Return|Fall|Sacrifice)$/.test(w); });
        if (ws.length) return ws[ws.length - 1].replace(/'s$/, "");
        t = t.split(" \u00B7 ")[0].replace(/^(the\s+)?(parable of\s+)?(the\s+)?/i, "");   // "Parable of the lost sheep" -> "lost sheep"
        return t || this.o.ref; }).call(this);
      h += '<div class="lbl u-mt14">More in the museums</div><p class="u-fs15">' + [
        ["British Museum", "https://www.britishmuseum.org/collection/search?keyword=" + encodeURIComponent(key), key],
        ["Museum of the Bible", "https://collections.museumofthebible.org/search?q=" + encodeURIComponent(bk === "Psalm" ? "Psalms" : bk), bk === "Psalm" ? "Psalms" : bk],
        ["Index of Medieval Art", "https://theindex.princeton.edu/", ""]
      ].map(function (m) { return outlink(m[1], m[0]) + (m[2] ? ' <span class="sub">' + esc(m[2]) + "</span>" : ""); }).join(" \u00B7 ") +
        '</p><p class="ctx u-fs13">The Index of Medieval Art has no search link: search it for ' + esc(key) + " once it opens.</p>";
      h += '<p class="ctx u-fs13">Paintings: works museums have tagged with the scene’s <a href="https://iconclass.org/" target="_blank" rel="noopener">Iconclass</a> subject, from Wikidata, and Wikimedia Commons scene collections; photos on Wikimedia Commons (each Source link has the details). Objects and relics: photos and articles from Wikipedia (CC BY-SA). Tap a picture for full screen.</p>';
      var all = sc.concat(near), nw = all.reduce(function (n, x) { return n + x.works.length; }, 0);
      return { kick: "Art · " + (all.length ? all.length + " scene" + (all.length > 1 ? "s" : "") + ", " + nw + " works" : "no scenes") + (rel.length ? ", " + rel.length + " objects and relics" : ""), title: "Art and relics", body: h };
    },
    after: function () { dropBroken(this.el); },
    click: function (e) {
      var im = e.target.closest("[data-jst-art]");
      if (im) { e.stopPropagation(); var full = im.getAttribute("data-full") || im.src; mapViewer({ id: "art-" + full, t: im.getAttribute("data-t"), img: full }); return; }
      Panel.prototype.click.call(this, e);
    }
  }, {}, function (d) {   // scenes painted plus objects and relics tied to the verses
    if (!d || !ARTREFS || !RELREFS) return null;
    return ARTREFS.filter(function (r) { return refsHit(r, d.ref); }).length + RELREFS.filter(function (r) { return refsHit(r, d.ref); }).length; });

  // ------------------------------------------------------------------ Posts
  define("Posts", { id: "posts", label: "Posts", name: "From the blog: posts on jayms.com", icon: ICON.posts }, {
    prepare: function () { var self = this; return Promise.all((this.o.alsoRefs || []).map(data.passage)).then(function (ds) { self.also = ds; }); },
    view: function () {
      var self = this, mine = L(this, "posts");
      var row = function (p) { return box("scripture", "", '<div class="item"><span class="when">' + new Date(p.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) + " \u00B7 cites it " + p.cites + " time" + (p.cites > 1 ? "s" : "") + '</span><span class="tt">' + esc(p.title) + '</span><p class="u-m6-8 u-fs15">' + esc(p.excerpt) + "</p>" + outlink(p.url, "Read the post") + "</div>"); };
      var h = '<div class="lbl">Posts that cite ' + esc(this.o.ref) + "</div>" + (mine.length ? mine.map(row).join("") : none("No post cites " + esc(this.o.ref) + " yet." + (this.o.owner === false ? "" : " That makes it a gap worth writing into.")));
      var ids = {}; mine.forEach(function (p) { ids[p.id] = 1; });
      (this.o.alsoRefs || []).forEach(function (r, i) {
        var fresh = ((self.also && self.also[i] && self.also[i].posts) || []).filter(function (p) { if (ids[p.id]) return false; ids[p.id] = 1; return true; });
        if (fresh.length) h += '<div class="lbl u-mt6">Also for ' + esc(r) + "</div>" + fresh.map(row).join("");
      });
      return { kick: "jayms.com \u00B7 " + Object.keys(ids).length + " posts", title: "From the blog", body: h };
    }
  }, { alsoRefs: [] }, function (d) { return d ? (d.posts || []).length : null; });

  // ------------------------------------------------------------------ Library (Corpus Atlas)
  /* Tools: the free study sites, each opened straight at the passage on screen, then the texts outside the Bible tied to it.
     One place for the free tools that are otherwise scattered across the web. Book names per site, in canonical order. */
  var SITE_BOOK = {
    blb: "gen exo lev num deu jos jdg rth 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sng isa jer lam eze dan hos joe amo oba jon mic nah hab zep hag zec mal mat mar luk jhn act rom 1co 2co gal eph phl col 1th 2th 1ti 2ti tit phm heb jas 1pe 2pe 1jo 2jo 3jo jde rev".split(" "),
    osis: "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev".split(" "),
    sefaria: "Genesis Exodus Leviticus Numbers Deuteronomy Joshua Judges Ruth I_Samuel II_Samuel I_Kings II_Kings I_Chronicles II_Chronicles Ezra Nehemiah Esther Job Psalms Proverbs Ecclesiastes Song_of_Songs Isaiah Jeremiah Lamentations Ezekiel Daniel Hosea Joel Amos Obadiah Jonah Micah Nahum Habakkuk Zephaniah Haggai Zechariah Malachi".split(" ")
  };
  function toolLinks(q) {
    var b = R.book(q.book), i = b.order, name = b.name === "Psalm" ? "Psalms" : b.name, c = q.c1, v = q.v1 || 1, one = b.chapters === 1;
    var full = q.v2 && q.v2 !== 999 && !(q.c1 === q.c2 && q.v1 === 1 && q.v2 === 999), ref = name + " " + c + (full ? ":" + v : "");
    var hub = name.toLowerCase().replace(/ /g, "_").replace("song_of_songs", "songs");
    var ew = (b.name === "Psalm" ? "psalm" : b.name === "Song of Songs" ? "song-of-solomon" : b.name.toLowerCase().replace(/ /g, "-")) + "-" + c;
    var L = [
      ["Blue Letter Bible", "Interlinear, lexicons and commentaries, in the LSB", "https://www.blueletterbible.org/lsb/" + SITE_BOOK.blb[i] + "/" + c + "/" + v + "/"],
      ["Bible Hub", "Interlinear, parallel versions and many commentaries", full ? "https://biblehub.com/interlinear/" + hub + "/" + c + "-" + v + ".htm" : "https://biblehub.com/" + hub + "/" + c + ".htm"],
      ["Bible Hub commentaries", "Every commentary they carry on this verse", "https://biblehub.com/commentaries/" + hub + "/" + c + "-" + v + ".htm"],
      ["STEPBible", "Tyndale House: original-language study, free", "https://www.stepbible.org/?q=version=ESV|reference=" + SITE_BOOK.osis[i] + "." + c + (full ? "." + v : "")],
      ["NET Bible", "The NET with all its translators' notes", "https://netbible.org/bible/" + encodeURIComponent(name + " " + c)],
      ["Bible Gateway", "LSB, NASB, ESV and NET side by side", "https://www.biblegateway.com/passage/?search=" + encodeURIComponent(ref) + "&version=LSB;NASB;ESV;NET"],
      ["OpenBible cross references", "What the rest of the Bible says, ranked by votes", "https://www.openbible.info/labs/cross-references/search?q=" + encodeURIComponent(name + " " + c + ":" + v)],
      ["Enduring Word", "David Guzik's free commentary", "https://enduringword.com/bible-commentary/" + ew + "/"]
    ];
    if (i < 39) L.push(["Sefaria", "The Hebrew with Jewish commentary (Rashi, Ramban ...)", "https://www.sefaria.org/" + SITE_BOOK.sefaria[i] + "." + c + (full ? "." + v : "") + "?lang=bi"]);
    return L;
  }
  define("Library", { id: "corpus", label: "Tools", name: "Free tools and texts", icon: ICON.corpus }, {
    view: function () {
      var lib = L(this, "library"), q = data.segs(this.o.ref)[0], h = "";
      if (q) h += '<div class="lbl">Free tools on ' + esc(this.o.ref) + "</div>" + box("scripture", "", '<div class="item">' + toolLinks(q).map(function (t) {
        return '<p class="u-m8">' + outlink(t[2], esc(t[0])) + '<br><span class="u-fs15">' + esc(t[1]) + "</span></p>"; }).join("") + "</div>");
      h += '<div class="lbl u-mt14">Texts outside the Bible (' + lib.length + ")</div>" + (lib.length ? lib.map(function (c) { return box("witness", "", '<div class="item"><span class="when">' + esc(c.when) + '</span><span class="tt">' + esc(c.t) + '</span><span class="sub">' + esc(c.trad) + '</span><p class="u-m8-0 u-fs15">' + esc(c.why) + "</p></div>"); }).join("")
        : none("No text outside the Bible is tied to " + esc(this.o.ref) + " yet.")) + outlink(CFG.corpus, "Open the Corpus Atlas");
      return { kick: "Tools \u00B7 free study sites at this passage", title: "Free tools", body: h };
    }
  }, {}, function (d) { return d && (d.library || []).length || null; });   // the free tools are always there: never shown as empty

  // ------------------------------------------------------------------ Vault (Obsidian)
  /* Each note opens with a plain obsidian:// link (vault + path), the same link Obsidian's own "Copy Obsidian URL" gives. */
  define("Vault", { id: "vault", label: "Obsidian", name: "My Obsidian vault", icon: ICON.vault, owner: true }, {
    uri: function (path) { return "obsidian://open?vault=" + encodeURIComponent(this.o.vaultName) + "&file=" + encodeURIComponent(path.replace(/\.md$/, "")); },
    view: function () {
      var self = this, v = L(this, "vault");
      var h = v.length ? v.map(function (n, i) { return box("open", "", '<div class="item"><span class="when">' + esc(n.path.split("/").slice(0, -1).join(" / ")) + " \u00B7 " + n.hits + " mention" + (n.hits > 1 ? "s" : "") + '</span><span class="tt">' + esc(n.t) + '</span><p class="u-m6-8 u-fs15">' + esc(n.hit) + '</p><div class="askrow">' +
          '<a class="btn" href="' + esc(self.uri(n.path)) + '" target="_blank" rel="noopener">Open in Obsidian</a><button class="btn" data-jst-copy-uri="' + i + '">Copy link</button><span class="jst-msg" data-jst-msg="' + i + '"></span></div></div>'); }).join("")
        : none("No note in your vault cites " + esc(this.o.ref) + ".");
      return { kick: "Obsidian \u00B7 " + v.length + " notes on " + this.o.ref, title: "My vault", body: h };
    },
    click: function (e) {
      var self = this, cp = e.target.closest("[data-jst-copy-uri]");
      if (!cp) return Panel.prototype.click.call(this, e);
      e.stopPropagation();
      var i = +cp.getAttribute("data-jst-copy-uri"), n = L(this, "vault")[i], msg = this.el.querySelector('[data-jst-msg="' + i + '"]');
      var say = function (t) { msg.textContent = t; };
      var copy = function (note) { var u = self.uri(n.path);
        return navigator.clipboard.writeText(u).then(function () { say((note ? note + " " : "") + "Link copied. Paste it into your browser's address bar."); })
          .catch(function () { say((note ? note + " " : "") + u); }); };
      return copy();
    }
  }, { vaultName: "Jayms" }, function (d) { return d ? (d.vault || []).length : null; });

  // ------------------------------------------------------------------ Chats (past Claude chats)
  function chatsHTML(list) {
    return list.length ? list.map(function (x) { return box("apparatus", "", '<div class="session"><span class="when u-label u-fs13 u-gold">' + esc(x.date) + '</span><span class="tt u-display u-fs20 u-w600 u-bright">' + esc(x.t) + '</span><p class="u-m4-6 u-fs15">' + esc(x.tldr) + "</p>" + outlink(x.url, "Reopen the chat") + "</div>"); }).join("")
      : none("No Claude chat in your synced summaries cites this passage yet.");
  }
  define("Chats", { id: "chats", label: "Claude", name: "My Claude chats", icon: ICON.claude, owner: true }, {
    view: function () { return { kick: "Claude chats", title: "Past chats on " + this.o.ref, body: chatsHTML(L(this, "chats")) }; }
  }, {}, function (d) { return d ? (d.chats || []).length : null; });

  // ------------------------------------------------------------------ Words
  define("Words", { id: "word", label: "Words", name: "Word Study", icon: ICON.word }, {
    /* the glossary marks show as soon as it is in; the panel never waits on it */
    prepare: function () { var self = this; return data.glossary(function () { if (self.alive) self.refresh(); }); },
    view: function () {
      var list = L(this, "words");
      if (!list.length) return { kick: "Word Study", title: this.o.ref, body: none("No word-by-word data for this passage yet.") };
      var k = this.o.word, w = (k && WORDS[k]) || list[0];
      var h = '<div class="lbl">Words in ' + esc(this.o.ref) + '</div><div class="chips">' + list.map(function (x) { return '<button class="chip' + (x.k === w.k ? " on" : "") + '" data-jst-pick="' + esc(x.k) + '"' + (glossFor(x.t, x.s).length ? ' title="In my glossary"' : "") + ">" + esc(x.t) + (glossFor(x.t, x.s).length ? ' <span class="jst-gl">G</span>' : "") + "</button>"; }).join("") + "</div>";
      h += box("witness", "", '<div class="big">' + esc(w.t) + '</div><dl class="meta"><dt>Strong\'s</dt><dd>' + esc(w.s) + "</dd><dt>Means</dt><dd>" + esc(w.gloss) + "</dd>" + (w.count ? "<dt>Used</dt><dd>" + esc(w.count) + " times</dd>" : "") + "</dl>");
      if (w.def) h += box("wording", "Lexicon", "<p>" + esc(w.def) + "</p>");
      if (w.note) h += box("explain", "In this passage", "<p>" + esc(w.note) + "</p>");
      h += glossBox(w.t, w.s);
      if (w.spread) h += box("apparatus", "Where it appears", "<p>" + esc(w.spread) + "</p>");
      h += '<div class="askrow">' + this.vocabBtn({ k: String(w.k || w.s || "").toLowerCase(), word: w.t, strong: w.s, gloss: w.gloss || "" }) + "</div>";
      h += outlink(entryURL("words", w.k || w.s), "All occurrences");
      return { kick: "Word Study \u00B7 " + w.s, title: w.t, body: h };
    },
    click: function (e) {
      var p = e.target.closest("[data-jst-pick]");
      if (p) { e.stopPropagation(); this.o.word = p.getAttribute("data-jst-pick"); this.paint(); this.emit("word", this.o.word); return; }
      Panel.prototype.click.call(this, e);
    }
    ,setRef: function (ref) { if (ref !== this.o.ref) this.o.word = null; Panel.prototype.setRef.call(this, ref); }
  }, { word: null }, function (d) { return d ? (d.words || []).length : null; });

  // ------------------------------------------------------------------ Verse
  define("Verse", { id: "verse", label: "Verse", name: "Verse tools", icon: ICON.verse }, {
    prepare: function () { var self = this; return Promise.all([data.verses(this.o.ref), data.diffs(), data.dss(), data.glossary(function () { if (self.alive) self.refresh(); })]).then(function (r) { self.vs = r[0]; self.df = r[1]; self.dss = r[2]; }); },
    /* the Dead Sea Scrolls that hold this verse, each linked to its images where an image page exists */
    dssHTML: function (b, c, v) {
      var D = this.dss; if (!D) return "";
      var ids = ((D.v[b + "|" + c] || {})[v]) || [];
      if (!ids.length) return "";
      var rows = ids.map(function (i) { var s = D.s[i];
        return '<p class="u-m5">' + (s ? outlink(s[1], esc(s[0]) + " (" + esc(i) + ")") : esc(i) + ' <span class="sub">no images online</span>') + "</p>"; }).join("");
      return box("witness", "In the Dead Sea Scrolls", rows + '<p class="ctx u-fs13 u-m6-0">Scroll list: ETCBC (Abegg). Images: Leon Levy Digital Library, Israel Museum.</p>');
    },
    view: function () {
      var vs = this.vs || [], o = this.o;
      if (!vs.length) return { kick: "Verse tools", title: o.ref, body: none("No word-by-word text for " + esc(o.ref) + " yet.") };
      var sel = vs.filter(function (x) { return o.verse && x.book === o.verse.book && x.c === o.verse.c && x.v === o.verse.v; })[0] || vs[0];
      var multi = {}; vs.forEach(function (x) { multi[x.book + x.c] = 1; }); multi = Object.keys(multi).length > 1;
      var h = '<div class="chips">' + vs.map(function (x) { return '<button class="chip' + (x === sel ? " on" : "") + '" data-jst-verse="' + x.book + "|" + x.c + "|" + x.v + '">' + (multi ? x.c + ":" : "") + x.v + "</button>"; }).join("") + "</div>";
      var text = o.scripture ? o.scripture(sel) : "";
      if (text) h += box("scripture", "", "<p>" + text + "</p>");
      var rtl = /[\u0590-\u05FF]/.test((sel.words[0] || {}).text || ""), vgloss = [];
      h += '<div class="lbl">Interlinear \u00B7 ' + (rtl ? "Hebrew" : "Greek") + ' word order</div><div class="ilin">' + sel.words.filter(function (w) { return w.gloss || w.english; }).map(function (w) {
        var k = strongKey(w.strong).toLowerCase(), t = latin(w), g = String(w.gloss || w.english || "").replace(/\./g, " ");
        var gl = glossFor((WORDS[k] && WORDS[k].t) || t, strongKey(w.strong)).concat(glossFor(t, strongKey(w.strong)));
        gl.forEach(function (x) { if (vgloss.indexOf(x) < 0) vgloss.push(x); });
        if (!k) return '<span class="wc wc-sfx"><b>' + esc(t) + "</b><span>" + esc(g) + "</span><em>" + (w.pos === "suffix" ? "suffix" : "") + "</em></span>";
        return '<button class="wc" data-jst-word="' + k + '" data-wfull="' + esc(JSON.stringify({ t: t, s: strongKey(w.strong), gloss: g, def: "", count: "", spread: "" })) + '"><b>' + esc(t) + "</b><span>" + esc(g) + "</span><em>" + esc(strongKey(w.strong)) + (gl.length ? ' <span class="jst-gl" title="In my glossary">G</span>' : "") + "</em></button>";
      }).join("") + "</div>";
      /* the words of this verse that have a glossary entry, each linked */
      if (vgloss.length) h += box("explain", "In my glossary", vgloss.map(function (x) { return "<p><b>" + esc(x.t) + "</b>" + (x.x ? " " + esc(x.x) : "") + "</p>" + outlink(x.url, "Glossary entry"); }).join(""));
      var notes = (this.d.verseNotes && this.d.verseNotes[sel.c + ":" + sel.v]) || [];
      h += notes.map(function (b) { return box(b[0], b[1], "<p>" + b[2] + "</p>"); }).join("");
      (this.df.byVerse[sel.book + "|" + sel.c + ":" + sel.v] || []).forEach(function (d) { h += box("wording", "How the translations differ", "<p>" + esc(d.gist) + "</p>" + outlink(entryURL("diffs", d.slug), "Full entry")); });
      h += this.dssHTML(sel.book, sel.c, sel.v);
      h += outlink(ibURL({ book: sel.book, c1: sel.c, v1: sel.v, c2: sel.c, v2: sel.v }), "Interleaved Bible");
      if (o.owner !== false) R.refly([{ book: sel.book, c1: sel.c, v1: sel.v, c2: sel.c, v2: sel.v }], o.translation).forEach(function (l) { h += outlink(l.url, "Logos"); });
      return { kick: "Verse tools", title: sel.book + " " + sel.c + ":" + sel.v, body: h };
    },
    click: function (e) {
      var b = e.target.closest("[data-jst-verse]");
      if (b) { e.stopPropagation(); var p = b.getAttribute("data-jst-verse").split("|"); this.o.verse = { book: p[0], c: +p[1], v: +p[2] }; this.paint(); return; }
      Panel.prototype.click.call(this, e);
    }
  }, { verse: null, scripture: null, translation: "LSB" });

  // ------------------------------------------------------------------ Interleave (interlinear + where it sits)
  define("Interleave", { id: "outline", label: "Inter", name: "Interleaved Bible", icon: ICON.outline }, {
    prepare: function () {
      var self = this, q = data.segs(this.o.ref)[0];
      this.st = { mode: this.st.mode || "il", word: null, diff: null, verse: null };
      if (!q) return null;
      var swap = function () { if (!self.alive) return; var dr = self.el.querySelector(".jst-drawer"); if (dr) dr.innerHTML = self.drawer(); };
      return Promise.all([data.verses(this.o.ref), data.diffs(), data.outline(q.book), data.text(this.o.ref), data.glossary(swap)]).then(function (r) {
        self.vs = r[0]; self.df = r[1]; self.book = r[2];
        var net = {}; (r[3] || []).forEach(function (t) { if (t.texts.NET) net[t.book + "|" + t.c + ":" + t.v] = t.texts.NET.replace(/\[\/?w:?\w*\]/g, "").replace(/<[^>]+>/g, " "); });
        self.vs.forEach(function (v) { v.net = net[v.book + "|" + v.c + ":" + v.v] || ""; });
      });
    },
    find: function (b, c, v, i) { var x = (this.vs || []).filter(function (r) { return r.book === b && r.c === c && r.v === v; })[0]; return x && x.words[i]; },
    drawer: function () {
      var st = this.st, q = data.segs(this.o.ref)[0], df = this.df;
      if (st.word) { var w = this.find(st.word.b, st.word.c, st.word.v, st.word.i); if (w) return wordCard(w, df.forWord(strongKey(w.strong), st.word.b, st.word.c, st.word.v), this); }
      if (st.verse) {
        var vr = (this.vs || []).filter(function (r) { return r.book + "|" + r.c + ":" + r.v === st.verse; })[0];
        if (vr) {
          var h2 = box("scripture", esc(vr.book + " " + vr.c + ":" + vr.v) + " \u00B7 NET", "<p>" + esc(vr.net || "The NET text for this verse isn't in the data.") + "</p>");
          (df.byVerse[vr.book + "|" + vr.c + ":" + vr.v] || []).forEach(function (d) { h2 += box("wording", "How the translations differ", "<p>" + esc(d.gist) + "</p>" + outlink(entryURL("diffs", d.slug), "Full entry")); });
          return h2;
        }
      }
      if (st.diff) { var d = df.list.filter(function (x) { return x.id === st.diff; })[0]; if (d) return box("wording", "How the translations differ \u00B7 " + esc(d.ref), "<p>" + esc(d.gist) + '</p><p class="u-fs14">' + esc(d.lemma) + "</p>" + outlink(entryURL("diffs", d.slug), "Full entry")); }
      return '<p class="empty u-fs15 u-m0">Tap any word to see it here: what it means, its form, and whether the versions differ on it. Tap a verse number for that verse in the NET; one underlined in gold also has a note on why the translations differ.</p>';
    },
    view: function () {
      var self = this, o = this.o, st = this.st, segs = data.segs(o.ref), q = segs[0], book = this.book;
      if (!q) return { kick: "Interleaved Bible", title: o.ref, body: none("Couldn't read " + esc(o.ref) + " as a Bible reference.") };
      var ev = null, eraI = -1, on = {};
      if (book) book.eras.forEach(function (e, ei) { e.events.forEach(function (x, vi) { var a = parseRef(x.books || x.date); if (a && overlap(a, q)) { if (eraI < 0) { eraI = ei; ev = x; } if (ei === eraI) on[vi] = 1; } }); });
      var bookName = book ? book.title.replace(/^The (Book|Gospel) of /, "").replace(/ Timeline$/, "") : q.book;
      var tail = segs.length > 1 ? q.c1 + ":" + q.v1 : o.ref.replace(/^.*?\s(?=\d)/, "");
      var h = '<div class="ilcrumb"><span>' + esc(bookName) + "</span><span>\u203A</span><span>" + esc(tail) + "</span></div>" +
              '<div class="iltitle">' + esc(ev ? ev.title : o.ref) + "</div>" +
              '<div class="ilhead"><span class="lbl">' + esc(o.ref) + '</span><span class="chips"><button class="chip' + (st.mode === "il" ? " on" : "") + '" data-jst-mode="il">Interlinear</button><button class="chip' + (st.mode === "where" ? " on" : "") + '" data-jst-mode="where">Where it sits</button></span></div>';
      var last = (this.vs || []).filter(function (r) { return r.book === q.book && r.c === q.c2; }).map(function (r) { return r.v; }).pop();
      var link = st.mode === "where" ? outlink(ibBookURL(q.book), "Interleaved Bible") : outlink(ibURL(q, last), "Interleaved Bible");
      if (st.mode === "where") return { kick: "Interleaved Bible", title: "Interleave", wide: true, body: '<div class="jst-pad u-flex u-col u-gap14">' + h + whereItSits(book, eraI, on, q) + link + "</div>" };
      return { kick: "Interleaved Bible \u00B7 NET", title: "Interleave", wide: true, split: !this.o.inline,
        body: '<div class="ilscroll">' + h + this.interlinear() + link + '</div><div class="ildrawer jst-drawer" aria-live="polite">' + this.drawer() + "</div>" };
    },
    interlinear: function () {
      var st = this.st, df = this.df, out = [];
      (this.vs || []).forEach(function (row) {
        var vd = df.byVerse[row.book + "|" + row.c + ":" + row.v] || [], key = row.book + "|" + row.c + ":" + row.v;
        out.push('<button class="ilv ilv-btn' + (vd.length ? " ilv-diff" : "") + (st.verse === key ? " on" : "") + '" data-jst-vnum="' + key + '" title="' + (vd.length ? "The NET for this verse, and why the translations differ here" : "The NET for this verse") + '">[' + row.v + "]</button>");
        var run = [], first = 0;
        function unit(run, i) {
          var head = i, long = -1;
          run.forEach(function (w, n) { var L2 = String(w.text || "").replace(/[\u0591-\u05C7]/g, "").length; if (L2 > long) { long = L2; head = i + n; } });
          var hw = run[head - i], argued = df.forWord(strongKey(hw.strong), row.book, row.c, row.v).length > 0;
          var isOn = st.word && st.word.b === row.book && st.word.c === row.c && st.word.v === row.v && st.word.i >= i && st.word.i < i + run.length;
          var gloss = run.map(function (w) { return String(w.gloss || w.english || ""); }).join(" ").replace(/\./g, " ").replace(/\s+/g, " ").trim();
          var rtl = /[\u0590-\u05FF]/.test(run[0].text || "");
          return '<button class="ilu' + (isOn ? " on" : "") + (argued ? " ilu-diff" : "") + '" data-jst-il="' + esc(row.book) + "|" + row.c + "|" + row.v + "|" + head + '"' + (argued ? ' title="The versions differ on this word"' : "") + '><span class="ilu-en">' + esc(gloss || "\u00B7") + '</span><span class="ilu-or" lang="' + (rtl ? "he" : "grc") + '"' + (rtl ? ' dir="rtl"' : "") + ">" + run.map(function (w) { return esc(w.text); }).join("") + "</span></button>";
        }
        row.words.forEach(function (w, i) { if (!run.length) first = i; run.push(w); if (w.after !== "") { out.push(unit(run, first)); run = []; } });
        if (run.length) out.push(unit(run, first));
      });
      if (!out.length) return none("No word-by-word text for " + esc(this.o.ref) + " yet.");
      return '<div class="il">' + out.join("") + '</div><p class="ilnote">Word glosses over the original (Macula Hebrew and Greek, in the original\'s word order); verse text from the NET. Words in rust are ones the English versions differ on.</p>';
    },
    click: function (e) {
      var m = e.target.closest("[data-jst-mode]"), w = e.target.closest("[data-jst-il]"), d = e.target.closest("[data-jst-vnum]"), st = this.st;
      if (m) { e.stopPropagation(); st.mode = m.getAttribute("data-jst-mode"); this.paint(); return; }
      if (w || d) {
        e.stopPropagation();
        if (w) { var p = w.getAttribute("data-jst-il").split("|"), pb = p[0], pn = p.slice(1).map(Number), same = st.word && st.word.b === pb && st.word.c === pn[0] && st.word.v === pn[1] && st.word.i === pn[2]; st.word = same ? null : { b: pb, c: pn[0], v: pn[1], i: pn[2] }; st.diff = null; }
        else { var key = d.getAttribute("data-jst-vnum"), same2 = st.verse === key; st.verse = same2 ? null : key; st.word = null; st.diff = null; }
        if (w) st.verse = null;
        /* only the drawer changes, so the text never moves */
        this.el.querySelectorAll(".ilu.on,.ilv.on").forEach(function (x) { x.classList.remove("on"); });
        if (st.word || st.verse) (w || d).classList.add("on");
        var dr = this.el.querySelector(".jst-drawer"); dr.innerHTML = this.drawer(); dr.scrollTop = 0;
        return;
      }
      Panel.prototype.click.call(this, e);
    },
    after: function () { this.el.classList.toggle("jst-inline", !!this.o.inline); }
  }, { inline: false });

  function wordCard(w, diffs, self) {
    var parse = [w.pos, w.stem, w.person && ("person " + w.person), w.gender, w.number, w.state, w.tense, w.voice, w.mood, w.case].filter(Boolean).join(" \u00B7 ");
    var key = strongKey(w.strong).toLowerCase(), t = latin(w), g = String(w.gloss || w.english || "").replace(/\./g, " ");
    var b = '<div class="big u-fs30">' + esc(w.translit || t) + '</div><dl class="meta"><dt>Means</dt><dd>' + esc(g) + "</dd>" + (key ? "<dt>Strong's</dt><dd>" + esc(strongKey(w.strong)) + "</dd>" : "<dt>Kind</dt><dd>" + esc(w.pos || "word part") + "</dd>") + (parse ? "<dt>Form</dt><dd>" + esc(parse) + "</dd>" : "") + "</dl>";
    if (!key) return box("witness", "The word", b);
    b += '<div class="askrow u-mt10"><button class="btn" data-jst-word="' + key + '" data-wfull="' + esc(JSON.stringify({ t: t, s: strongKey(w.strong), gloss: g, def: "", count: "", spread: "" })) + '">Word Study</button>' + (self ? self.vocabBtn({ k: key, word: String(t).normalize("NFD").replace(/[\u0300-\u036f\u02BB-\u02BF\u2018\u2019']/g, "").replace(/^-+|-+$/g, ""), strong: strongKey(w.strong), gloss: g.trim() }) : "") + "</div>";
    var h = box("witness", "The word", b) + glossBox(t, strongKey(w.strong));
    if (diffs.length) h += box("wording", "The versions differ on this word", diffs.slice(0, 2).map(function (d) { return "<p><b>" + esc(d.ref) + "</b> " + esc(d.gist) + "</p>"; }).join(""));
    return h;
  }
  function whereItSits(book, ei, on, q) {
    if (!book) return none("No outline for " + esc(q.book) + " yet.");
    if (ei < 0) return none("This passage isn't placed in the book's outline yet.");
    var era = book.eras[ei], legend = book.legend || {};
    /* the outline's labels spell the era number three ways ("Era XXVI", "Era Thirty-Two", "Era Six"); show digits only */
    var span = function (e) { return String(e.label || "").replace(/^\s*Era\s+[^\u00B7]*\u00B7\s*/i, ""); };
    var h = '<div class="item"><span class="when">Era ' + (ei + 1) + " of " + book.eras.length + (span(era) ? " \u00B7 " + esc(span(era)) : "") + '</span><span class="tt">' + esc(era.name) + "</span></div>";
    h += box("explain", "Where this sits", "<p>" + esc(era.dates) + "</p>");
    h += era.events.map(function (ev, vi) { var hit = on[vi];
      return '<div class="box ev-' + esc(ev.colour || "gold") + (hit ? " ev-on" : "") + '"><div class="item"><span class="when">' + esc(ev.date) + " \u00B7 " + esc(ev.kind || legend[ev.colour] || "") + (hit ? " \u00B7 you are here" : "") + '</span><span class="tt u-fs19">' + esc(ev.title) + "</span>" + (hit ? '<p class="u-m8-0 u-fs15">' + esc(ev.detail || "") + "</p>" : "") + "</div></div>"; }).join("");
    var prev = book.eras[ei - 1], next = book.eras[ei + 1];
    if (prev || next) h += box("apparatus", "Around it", (prev ? "<p><b>Before:</b> era " + ei + ", " + esc(span(prev)) + ", " + esc(prev.name) + "</p>" : "") + (next ? "<p><b>After:</b> era " + (ei + 2) + ", " + esc(span(next)) + ", " + esc(next.name) + "</p>" : ""));
    return h;
  }

  // ------------------------------------------------------------------ reading an answer
  /* The three markers claude-instructions.md asks for, read back out of an answer:
     a fenced block whose first line is "logos", "Vocabulary candidates: word (H430), ...", and
     "This is worth its own post on jayms.com: <title>". */
  function parseAnswer(text) {
    var out = { logos: [], vocab: [], idea: null };
    String(text || "").replace(/```[ \t]*(?:logos[ \t]*\n|\n[ \t]*logos[ \t]*\n)([\s\S]*?)```/gi, function (m, body) {
      var q = body.split("\n").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 4);
      if (q.length) out.logos.push({ queries: q });
      return m;
    });
    var v = String(text || "").match(/^\s*\**Vocabulary candidates:?\**\s*(.+)$/mi);
    if (v) v[1].split(/\s*[,;]\s*/).forEach(function (item) {
      var m = item.match(/^\**([^(*]+?)\**\s*\(([HG]\d{1,5})\)/i);
      if (m) out.vocab.push({ word: m[1].trim(), strong: m[2].toUpperCase() });
      else if (item.replace(/[.*]/g, "").trim()) out.vocab.push({ word: item.replace(/[.*]/g, "").trim(), strong: "" });
    });
    var i = String(text || "").match(/This is worth its own post on jayms\.com[:.\u2014-]*\s*([^\n]*)/i);
    if (i) out.idea = { title: i[1].trim().replace(/^["\u201C]|["\u201D.]$/g, "") };
    return out;
  }

  // ------------------------------------------------------------------ AskClaude
  /* options: ask(prompt, {signal, onText}) -> Promise<{text}>   the Claude call (claude.ai sample, or a server route)
              instructions: url of the rules file \u00B7 context(): string of the material sent with the question
              quick: [questions] \u00B7 showChats: true \u00B7 history(): earlier answer records for this passage
     sends: answer (every finished answer, as a record), note, logos, vocab, idea (when James presses their buttons) */
  define("AskClaude", { id: "claude", label: "Claude", name: "Study with Claude", icon: ICON.claude, owner: true }, {
    view: function () {
      var o = this.o, st = this.st;
      var h = '<p class="ctx">' + esc(o.blurb || "Claude answers by your study rules and starts from your own material on " + o.ref + ".") + "</p>";
      h += '<div class="chips">' + (o.quick || []).map(function (q, i) { return '<button class="chip" data-jst-q="' + i + '">' + esc(q) + "</button>"; }).join("") + "</div>";
      h += '<div class="ask"><label class="lbl">Ask about ' + esc(o.ref) + '</label><textarea data-jst-askq placeholder="' + esc(o.placeholder || "Ask anything about this passage") + '">' + esc(st.q || "") + "</textarea>" +
           '<div class="askrow">' + (o.ask ? '<button class="btn' + (o.project ? "" : " fill") + '" data-jst-ask' + (st.busy ? " disabled" : "") + ">" + (st.busy ? "Thinking\u2026" : "Ask Claude") + "</button>" + (st.busy ? '<button class="btn" data-jst-stop>Stop</button>' : "") : "") +
           (o.project ? '<button class="btn fill" data-jst-project title="Copies your question with this passage\'s material and opens your study Project beside the app">Ask in my Project</button>' : '<button class="btn" data-jst-copy>Copy for Claude chat</button>') + "</div>" +
           (st.projMsg ? '<p class="jst-msg u-mt6" role="status">' + esc(st.projMsg) + "</p>" : "") + "</div>";
      if (st.err) h += box("not", "", "<p>" + esc(st.err) + "</p>");
      if (st.a || st.busy) h += box("open", "Claude", '<div class="ans' + (!st.a ? " wait" : "") + '" data-jst-ans>' + esc(st.a || "Thinking\u2026") + "</div>" + (st.a && !st.busy ? this.actions(st.rec) : ""));
      var past = (o.history ? o.history() : []).filter(function (r) { return !st.rec || r.id !== st.rec.id; });
      if (past.length) h += '<details class="jst-past"><summary class="lbl">Earlier answers on ' + esc(o.ref) + " (" + past.length + ")</summary>" +
        past.map(function (r) { return '<div class="box v-apparatus"><div class="item"><span class="when">' + new Date(r.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) + '</span><span class="tt u-fs18">' + esc(r.question) + '</span><div class="ans u-mt6">' + esc(r.text) + "</div></div></div>"; }).join("") + "</details>";
      if (o.showChats) h += '<div class="lbl u-mt6">Your Claude chats on this passage</div>' + chatsHTML(L(this, "chats"));
      return { kick: "Claude \u00B7 owner only", title: "Study with Claude", body: h };
    },
    /* the buttons under a finished answer: what Claude marked in it, plus notes */
    actions: function (rec) {
      var p = (rec && rec.parsed) || { logos: [], vocab: [], idea: null }, done = this.st.done || {}, h = '<div class="jst-acts">';
      h += '<button class="btn" data-jst-act="note">' + (done.note ? "Added. Press Save under your notes" : "Add to notes") + "</button>";
      if (p.logos.length) h += '<button class="btn" data-jst-act="logos">' + (done.logos ? "\u2713 Queued" : "Queue for Logos") + "</button>";
      if (p.idea) h += '<button class="btn" data-jst-act="idea">' + (done.idea ? "Logged \u2713" : "Log post idea") + "</button>";
      h += "</div>";
      if (p.vocab.length) h += '<div class="lbl u-mt8">Vocabulary candidates</div><div class="chips">' + p.vocab.map(function (w, i) {
        return '<button class="chip' + (done["v" + i] ? " on" : "") + '" data-jst-act="vocab" data-i="' + i + '">' + (done["v" + i] ? "\u2713 " : "+ ") + esc(w.word) + (w.strong ? " (" + esc(w.strong) + ")" : "") + "</button>"; }).join("") + "</div>";
      return h;
    },
    rules: function () {
      var self = this; if (this._rules) return Promise.resolve(this._rules);
      return fetch(CFG.base + this.o.instructions, { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; }).then(function (t) { self._rules = t; return t; });
    },
    run: function (q) {
      var self = this, st = this.st, o = this.o;
      st.q = q; st.err = ""; st.a = ""; st.rec = null; st.done = {};
      if (!q) return;
      this.rules().then(function (rules) {
        if (!rules) { st.err = "Claude's instructions file didn't load, so Claude won't answer without it. Reload and try again."; return self.paint(); }
        if (!o.ask) { st.err = "Asking Claude works when this page is open on claude.ai. Use Copy for Claude chat to take this to your study project instead."; return self.paint(); }
        st.busy = true; st.ctl = new AbortController(); self.paint();
        return o.ask(rules + "\n\n" + (o.context ? o.context() : "") + "\n\nMy question: " + q, { signal: st.ctl.signal, cache: false,
          onText: function (x) { st.a = x.text; var el = self.el.querySelector("[data-jst-ans]"); if (el) { el.textContent = x.text; el.classList.remove("wait"); } } })
          .then(function (r) {
            st.a = r.text;
            /* every finished answer becomes a record: its passage, question, text and what it marked */
            var at = Date.now();
            st.rec = { id: R.key(o.ref) + "~" + at, ref: o.ref, key: R.key(o.ref), question: q, text: r.text, parsed: parseAnswer(r.text), at: at };
            self.emit("answer", st.rec);
          })
          .catch(function (e) {
            st.a = e.text || "";
            if (e.code === "not_granted") st.err = "Claude wasn't allowed on this page. Use Copy for Claude chat instead.";
            else if (e.code === "rate_limited") st.err = "Too many questions at once. Give it a minute.";
            else if (e.code !== "cancelled") st.err = "Claude couldn't answer that one. Try again, or use Copy for Claude chat.";
          })
          .then(function () { st.busy = false; self.paint(); });
      });
    },
    click: function (e) {
      var self = this, t = e.target, ta = this.el.querySelector("[data-jst-askq]");
      if (t.closest("[data-jst-q]")) { e.stopPropagation(); var qq = this.o.quick[+t.closest("[data-jst-q]").getAttribute("data-jst-q")];
        if (this.o.ask) return this.run(qq);
        this.st.q = qq; this.st.projMsg = ""; this.paint(); return; }   // no Claude on this page: the question goes in the box for "Ask in my Project"
      if (t.closest("[data-jst-ask]")) { e.stopPropagation(); return this.run((ta && ta.value.trim()) || this.st.q); }
      if (t.closest("[data-jst-stop]")) { e.stopPropagation(); if (this.st.ctl) this.st.ctl.abort(); return; }
      var act = t.closest("[data-jst-act]");
      if (act) {
        e.stopPropagation();
        var st = this.st, rec = st.rec, kind = act.getAttribute("data-jst-act"), base = { ref: this.o.ref, answerId: rec && rec.id };
        if (kind === "note") { this.emit("note", { ref: this.o.ref, text: st.a }); st.done.note = 1; }
        if (kind === "logos" && rec) { rec.parsed.logos.forEach(function (b) { self.emit("logos", Object.assign({ queries: b.queries }, base)); }); st.done.logos = 1; }
        if (kind === "idea" && rec) { this.emit("idea", Object.assign({ title: rec.parsed.idea.title, text: st.a }, base)); st.done.idea = 1; }
        if (kind === "vocab" && rec) { var i = +act.getAttribute("data-i"), w = rec.parsed.vocab[i], k = w.strong ? w.strong.toLowerCase() : "";
          this.emit("vocab", { k: k, word: w.word, strong: w.strong, gloss: (k && WORDS[k] && WORDS[k].gloss) || "", ref: this.o.ref, answerId: rec.id }); st.done["v" + i] = 1; }
        this.paint(); return;
      }
      if (t.closest("[data-jst-project]")) {
        e.stopPropagation();
        /* your study Project answers by its own instructions and knowledge, so only the passage material and the question go */
        var txt2 = (self.o.context ? self.o.context() : "") + "\n\n" + ((ta && ta.value.trim()) || "Let's study this passage together.");
        var w = Math.min(620, Math.round(screen.availWidth * 0.4));
        var win = window.open(self.o.project, "jayms-study-project", "popup=yes,width=" + w + ",height=" + screen.availHeight + ",left=" + ((screen.availLeft || 0) + screen.availWidth - w) + ",top=0");
        if (win) try { win.focus(); } catch (er) {}
        var done = function (m) { self.st.projMsg = m; self.st.q = ta ? ta.value : self.st.q; self.paint(); };
        navigator.clipboard.writeText(txt2).then(function () { done(win ? "Copied. Paste into the Project window (\u2318V) and send." : "Copied. Your browser blocked the Project window: allow pop-ups for this page, or open the Project and paste."); })
          .catch(function () { if (ta) { ta.value = txt2; ta.select(); } done("Selected. Copy it with \u2318C, then paste into the Project window."); });
        return;
      }
      if (t.closest("[data-jst-copy]")) {
        e.stopPropagation(); var b = t.closest("[data-jst-copy]");
        this.rules().then(function (rules) {
          var txt = (rules || "") + "\n\n" + (self.o.context ? self.o.context() : "") + "\n\n" + ((ta && ta.value.trim()) || "Let's study this passage together.");
          return navigator.clipboard.writeText(txt).then(function () { b.textContent = "Copied. Paste into Claude \u2713"; })
            .catch(function () { if (ta) { ta.value = txt; ta.select(); } b.textContent = "Selected. Copy it with \u2318C"; });
        });
        return;
      }
      Panel.prototype.click.call(this, e);
    }
  }, { instructions: "claude-instructions.md", quick: [], showChats: true, ask: null, context: null, history: null });

  // ------------------------------------------------------------------ CrossRefs
  /* Where else the Bible says this: the OpenBible.info cross-references for the passage, strongest first,
     split into what comes before it and after it in the Bible. Each opens in the reader (sends passage) or reads in place. */
  define("CrossRefs", { id: "xref", label: "Cross-refs", name: "Cross-references", icon: '<svg viewBox="0 0 24 24"><path d="M7 7h10l-3-3M17 17H7l3 3"/></svg>' }, {
    prepare: function () { var self = this; return data.xref(this.o.ref).then(function (x) { self.x = x; }); },
    view: function () {
      var self = this, st = this.st, all = this.x || [], q = data.segs(this.o.ref)[0];
      if (!q) return { kick: "Cross-references", title: this.o.ref, body: none("Open a passage first.") };
      var here = R.book(q.book), pos = function (x) { return x.order * 1e6 + x.c * 1e3 + x.v; }, me = here.order * 1e6 + q.c1 * 1e3 + q.v1;
      var before = all.filter(function (x) { return pos(x) < me; }), after = all.filter(function (x) { return pos(x) > me; });
      var top = Math.max.apply(null, all.map(function (x) { return x.votes; }).concat([1]));
      var row = function (x) {
        var nt = here.order < 39 && x.order >= 39, peek = st.peek && st.peek[x.ref];
        return box(nt ? "witness" : "scripture", "", '<div class="item">' +
          /* tap the reference to read it in place (tap again to fold it); "Open" puts it in the reader */
          '<div class="jst-xrow"><button class="tt jst-xt" data-jst-xpeek="' + esc(x.ref) + '" aria-expanded="' + !!peek + '" title="' + (peek ? "Hide the verse" : "Read it here") + '">' + esc(x.ref) + '</button><button class="jst-ref" data-jst-xopen="' + esc(x.ref) + '" title="Open ' + esc(x.ref) + ' in the reader">Open</button></div>' +
          (peek ? '<p class="u-fs16 u-m6-4">' + esc(peek) + "</p>" : "") + "</div>");
      };
      var sect = function (key, label, list) {
        if (!list.length) return "";
        var open = st["all" + key], shown = open ? list : list.slice(0, 10);
        return '<div class="lbl">' + label + " (" + list.length + ")</div>" + shown.map(row).join("") +
          (list.length > 10 ? '<div class="askrow"><button class="btn" data-jst-xall="' + key + '">' + (open ? "Show the strongest 10" : "Show all " + list.length) + "</button></div>" : "");
      };
      var h = '<p class="ctx">Other places that quote, echo or teach the same thing as ' + esc(this.o.ref) + ", strongest first. Tap one to read it here.</p>";
      h += all.length ? sect("after", "Later in the Bible", after) + sect("before", "Earlier in the Bible", before) : none("No cross-references for " + esc(this.o.ref) + ".");
      h += '<p class="ctx u-fs13">Sources: <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noopener">OpenBible.info</a> cross-references (CC BY, ranked by readers\' votes), and the verses cited in the <a href="https://tyndaleopenresources.com/" target="_blank" rel="noopener">Tyndale Open Study Notes</a> and <a href="https://github.com/BibleAquifer/BiblicaStudyNotes" target="_blank" rel="noopener">Biblica Study Notes</a> (CC BY-SA 4.0). Order: passages named by more than one source first, then by readers\' votes. A green edge marks a New Testament passage.</p>';
      return { kick: "Cross-references \u00B7 " + all.length, title: "Where else the Bible says this", body: h };
    },
    click: function (e) {
      var self = this, t = e.target, pk = t.closest("[data-jst-xpeek]"), op = t.closest("[data-jst-xopen]"), al = t.closest("[data-jst-xall]");
      if (op) { e.stopPropagation(); this.emit("passage", { ref: op.getAttribute("data-jst-xopen") }); return; }
      if (al) { e.stopPropagation(); var k = "all" + al.getAttribute("data-jst-xall"); this.st[k] = !this.st[k]; this.paint(); return; }
      if (pk && this.st.peek && this.st.peek[pk.getAttribute("data-jst-xpeek")]) { e.stopPropagation(); delete this.st.peek[pk.getAttribute("data-jst-xpeek")]; var kp = this.el.scrollTop; this.paint(); this.el.scrollTop = kp; return; }
      if (pk) { e.stopPropagation(); var r = pk.getAttribute("data-jst-xpeek"); pk.disabled = true;
        data.text(r).then(function (rows) {
          var ver = self.o.version || "NET";
          var txt = (rows || []).map(function (x) { var s2 = x.texts[ver] || x.texts.NET || ""; return "[" + x.v + "] " + String(s2).replace(/<[^>]+>/g, " ").replace(/\[\/?w:?\w*\]/g, "").replace(/ {2,}/g, " ").trim(); }).join(" ");
          self.st.peek = self.st.peek || {}; self.st.peek[r] = txt || "The text for this isn't in the data.";
          var keep = self.el.scrollTop; self.paint(); self.el.scrollTop = keep;
        }); return; }
      Panel.prototype.click.call(this, e);
    }
  }, { version: "NET" }, function (d) { return d && d.ref in XREFN ? XREFN[d.ref] : null; });

  // ------------------------------------------------------------------ Shelf (Logos commentaries)
  /* The commentaries James owns in Logos on the open book, trusted voices first (claude-instructions.md list).
     Each opens in the Logos app at the passage: logosres:<id>;ref=Bible.<Book><c>.<v> (JaymsRef.logos) */
  function logosRes(id, s) { return R.logos(id, { book: s.book, c1: s.c1, v1: s.v1, c2: s.c1, v2: s.v1 }); }
  function bookLabel(b) { return b === "Psalm" ? "Psalms" : b; }
  function shelfBooks(ref) { var seen = {}; return R.parse(ref || "").filter(function (s) { if (seen[s.book]) return false; seen[s.book] = 1; return true; }); }
  /* James's main authors, in his order. A name is "N.T. Wright" or "Wright, N. T."; it matches a Logos author line on the
     surname, and on the first initial when one is given. The page can replace the list (options.authors). */
  var DEFAULT_AUTHORS = ["Michael Heiser", "John Walton", "N.T. Wright", "Kenneth Bailey", "Craig Evans", "C.S. Lewis", "Greg Koukl", "James White",
    "D.A. Carson", "Dennis Prager", "F.F. Bruce", "Richard Bauckham", "Roger Beckwith",
    "John J. Collins", "James VanderKam", "George Nickelsburg", "Loren Stuckenbruck", "Larry Hurtado", "Craig Keener", "G.K. Beale", "David deSilva"];
  function nameKey(n) {
    n = String(n || "").trim(); var last, first;
    if (n.indexOf(",") > -1) { last = n.split(",")[0]; first = n.split(",")[1]; }
    else { var t = n.split(/\s+/); last = t.pop(); first = t.join(" "); }
    return { last: foldWord(last), init: foldWord(first).charAt(0) };
  }
  function byAuthor(name, by) {
    var k = nameKey(name);
    return String(by || "").split(";").some(function (a) { var x = nameKey(a.indexOf(",") > -1 ? a : a); return x.last === k.last && (!k.init || !x.init || x.init === k.init); });
  }
  function authorRank(names, by) { for (var i = 0; i < names.length; i++) if (byAuthor(names[i], by)) return i; return -1; }

  /* James's shelf settings, from the Config panel: {authors:{names}, commentaries:{order, hidden}, studyBibles:{order, hidden}} */
  function shelfCfg(o) {
    var c = (o.config ? o.config() : null) || {};
    var a = c.authors && c.authors.names && c.authors.names.length ? c.authors.names : DEFAULT_AUTHORS;
    var fix = function (x) { x = x || {}; return { order: x.order || [], hidden: x.hidden || [] }; };
    return { authors: a, com: fix(c.commentaries), sb: fix(c.studyBibles) };
  }
  /* his own order first, then the fallback order; hidden ones out */
  function cfgSort(list, idOf, part, fallback) {
    var pos = function (x) { var i = part.order.indexOf(idOf(x)); return i < 0 ? 1e6 : i; };
    return list.filter(function (x) { return part.hidden.indexOf(idOf(x)) < 0; }).sort(function (a, b) { return pos(a) - pos(b) || fallback(a, b); });
  }
  /* "Barry, John D.; Bomar, David; ..." -> "John D. Barry, David Bomar and others" */
  function shortBy(by) {
    var a = String(by || "").split(";").map(function (x) { x = x.trim(); var p = x.split(","); return p.length > 1 ? (p[1].trim() + " " + p[0].trim()) : x; }).filter(Boolean);
    return a.length > 2 ? a.slice(0, 2).join(", ") + " and others" : a.join(" and ");
  }
  var OPEN_SB = [["open:T", "Tyndale Open Study Notes"], ["open:B", "Biblica Study Notes"]];
  var MAPIDX = null, MAPBY = {}, MAPURL = {};
  /* a map's picture as a blob URL: sliced out of its bundle file (the page's own file, so it loads anywhere), else the original */
  function mapOnline(m) { return String(m.img).replace("https://raw.githubusercontent.com/BibleAquifer/BiblicaOpenBibleMaps/main/", "https://cdn.jsdelivr.net/gh/BibleAquifer/BiblicaOpenBibleMaps@main/"); }
  /* a map's picture: the online original (no copies are kept; maps.json's bundle fields are history from when claude.ai held them) */
  function mapURL(m) {
    if (!m) return Promise.resolve("");
    return Promise.resolve(MAPURL[m.id] || (MAPURL[m.id] = mapOnline(m)));
  }
  /* full screen: fit to the screen, tap to see it at full size and scroll around, x or Esc to close */
  function mapViewer(m) {
    if (!m) return;
    mapURL(m).then(function (u) {
      var v = document.createElement("div"); v.className = "jst-mapview";
      v.innerHTML = '<div class="jst-mapbar"><span>' + esc(m.t) + '</span><button class="btn" data-x aria-label="Close">\u00D7</button></div><div class="jst-mapscroll"><img src="' + u + '" alt="' + esc(m.t) + '" referrerpolicy="no-referrer"></div>';
      var close = function () { v.remove(); document.removeEventListener("keydown", key); };
      var key = function (e) { if (e.key === "Escape") close(); };
      v.addEventListener("click", function (e) {
        if (e.target.closest("[data-x]")) return close();
        if (e.target.tagName === "IMG") v.classList.toggle("full");
        else if (e.target === v) close();
      });
      document.addEventListener("keydown", key);
      document.body.appendChild(v);
    });
  }
  function mapsFor(ref) {
    if (!MAPIDX) return [];
    var segs = data.segs(ref);
    return MAPIDX.filter(function (m) { return (m.b || m.img) && m.r.some(function (r) { return segs.some(function (q) { return R.overlap({ book: r[0], c1: r[1], v1: r[2], c2: r[3], v2: r[4] }, q); }); }); });
  }

  /* The shelf. For James: his Logos commentaries, his study Bibles (Logos plus the open Tyndale and Biblica notes), maps, and the rest
     (DDD, his authors' books), one tab at a time. For readers: the open study notes and the maps. Order and hiding come from Config. */
  define("Shelf", { id: "shelf", label: "Shelf", name: "Study notes and my Logos shelf", icon: '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 20V6h3v14M10 20V4h3v16M15 20l2-13 3 .5-2 12.5"/></svg>' }, {
    prepare: function () { var self = this, own = this.o.owner; return Promise.all([data.notes(this.o.ref), own ? data.shelf() : null, own ? data.library() : null, data.maps(), own ? data.vaultBooks() : null]).then(function (r) { self.notes = r[0]; self.sh = r[1]; self.lib = r[2]; self.vb = r[4]; }); },
    /* the Books tab: books in his Obsidian BOOKS vault, for the authors Logos doesn't cover. Books about this Bible book first, then his authors in order */
    vaultHTML: function () {
      var vb = this.vb, segs = data.segs(this.o.ref), q = segs[0], bk = q && q.book, names = this.cfg().authors, lib = (this.lib && this.lib.lib) || [];
      if (!vb || !vb.authors) return none("Your BOOKS vault list isn't built yet.");
      var open = function (b) { return '<p class="u-m5">' + outlink("obsidian://open?vault=" + encodeURIComponent(vb.vault) + "&file=" + encodeURIComponent(b.f.replace(/\.md$/, "")), esc(b.t)) + "</p>"; };
      var h = "", on = [];
      vb.authors.forEach(function (a) { a.books.forEach(function (b) { if (!bk || !b.bk || b.bk.indexOf(bk) < 0) return;
        /* a file about one chapter ("Psalm 23", "Romans 1-7") shows only beside a passage in that chapter */
        if (b.ch && !b.ch.some(function (c) { return segs.some(function (sg) { return sg.book === bk && c >= sg.c1 && c <= sg.c2; }); })) return;
        on.push({ a: a, b: b }); }); });
      if (on.length) h += '<div class="lbl">On ' + esc(bookLabel(bk)) + " (" + on.length + ")</div>" + box("witness", "", '<div class="item">' + on.map(function (x) { return open(x.b).replace("</p>", ' <span class="sub">' + esc(x.a.by) + "</span></p>"); }).join("") + "</div>");
      var used = {}, any = false;
      h += '<div class="lbl u-mt14">My authors</div>';
      names.forEach(function (nm) {
        var a = vb.authors.filter(function (x) { return !used[x.by] && byAuthor(nm, x.by); }); if (!a.length) return;
        a.forEach(function (x) { used[x.by] = 1; });
        var books = [].concat.apply([], a.map(function (x) { return x.books; })), inLogos = lib.filter(function (x) { return byAuthor(nm, x[2]); }).length;
        any = true;
        h += '<div class="box v-' + (inLogos ? "apparatus" : "witness") + '"><div class="item"><span class="tt u-fs18">' + esc(nm) + '</span><span class="sub">' + books.length + " in your vault \u00B7 " + (inLogos ? inLogos + " in Logos" : "none in Logos") + "</span>" +
          (inLogos ? '<details class="jst-past"><summary class="lbl">Their books (' + books.length + ")</summary>" + books.map(open).join("") + "</details>" : books.map(open).join("")) + "</div></div>";
      });
      if (!any) h += none("None of your authors has a book in your BOOKS vault.");
      return h + '<p class="ctx u-fs13">Opens in Obsidian (BOOKS vault). Refreshed with the Logos shelf each morning.</p>';
    },
    cfg: function () { return shelfCfg(this.o); },
    dddHTML: function () {
      return '<div class="lbl">Dictionary of Deities and Demons</div>' + outlink(R.logos("13.0.23"), "Open in Logos");
    },
    studyBiblesHTML: function () {
      var c = this.cfg(), sb = (this.lib && this.lib.studyBibles) || [], q = data.segs(this.o.ref)[0]; if (!sb.length || !q) return "";
      var names = c.authors;
      sb = cfgSort(sb, function (x) { return x[0]; }, c.sb, function (a, b) { var ra = authorRank(names, a[2]), rb = authorRank(names, b[2]); return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || String(a[1]).localeCompare(b[1]); });
      return '<div class="lbl">My study Bibles in Logos (' + sb.length + ')</div><div class="box v-witness"><div class="item">' + sb.map(function (x) {
        return '<p class="u-m6"><span class="tt u-fs17">' + esc(x[1]) + "</span><br>" + outlink(logosRes(x[0], q), "Open") + "</p>"; }).join("") + "</div></div>";
    },
    /* books by his authors: the ones about this book of the Bible first, then everything else they wrote that he owns */
    /* his Logos Mobile Ed courses on this book of the Bible (the "(Activities)" workbooks are left out) */
    coursesHTML: function () {
      var lib = (this.lib && this.lib.lib) || [], q = data.segs(this.o.ref)[0]; if (!q) return "";
      var on = lib.filter(function (x) { return x[4] === "Course" && x[5].indexOf(q.book) > -1 && !/\(Activities\)$/.test(x[1]); });
      if (!on.length) return "";
      return '<div class="lbl u-mt14">My courses on ' + esc(bookLabel(q.book)) + " (" + on.length + ')</div><div class="box v-witness"><div class="item">' + on.map(function (x) {
        return '<p class="u-m6">' + outlink(R.logos(x[0]), esc(x[1])) + ' <span class="sub">' + esc(x[2]) + "</span></p>"; }).join("") + "</div></div>";
    },
    authorsHTML: function () {
      var lib = (this.lib && this.lib.lib) || [], names = this.cfg().authors, q = data.segs(this.o.ref)[0]; if (!q) return "";
      var bk = q.book, h = '<div class="lbl u-mt14">My authors</div>', any = false;
      names.forEach(function (nm) {
        var mine = lib.filter(function (x) { return byAuthor(nm, x[2]); }); if (!mine.length) return;
        var on = mine.filter(function (x) { return x[5].indexOf(bk) > -1; }), rest = mine.filter(function (x) { return x[5].indexOf(bk) < 0; });
        var row = function (x) { return '<p class="u-m5">' + outlink(R.logos(x[0]), esc(x[1])) + ' <span class="sub">' + esc([x[4], x[3]].filter(Boolean).join(" \u00B7 ")) + "</span></p>"; };
        any = true;
        h += '<div class="box v-' + (on.length ? "witness" : "apparatus") + '"><div class="item"><span class="tt u-fs18">' + esc(nm) + '</span><span class="sub">' + mine.length + " in your library" + (on.length ? " \u00B7 " + on.length + " on " + esc(bookLabel(bk)) : "") + "</span>" +
          on.map(row).join("") + (rest.length ? '<details class="jst-past"><summary class="lbl">' + (on.length ? "Their other books" : "Their books") + " (" + rest.length + ")</summary>" + rest.map(row).join("") + "</details>" : "") + "</div></div>";
      });
      if (!any) h += none("None of your authors has a book in your Logos library yet.");
      return h;
    },
    notesHTML: function () {
      var st = this.st, c = this.cfg(), all = (this.notes || []).filter(function (n) { return c.sb.hidden.indexOf("open:" + n.src.code) < 0; });
      var have = {}; all.forEach(function (n) { have[n.src.code] = (have[n.src.code] || 0) + 1; });
      var on = st.src || "all", list = all.filter(function (n) { return on === "all" || n.src.code === on; });
      var where = function (n) { var one = (R.book(n.book) || {}).chapters === 1, a = (one ? "" : n.c1 + ":") + n.v1; if (n.c2 === 999) return "Introduction to " + n.book; if (n.c1 === n.c2 && n.v1 === n.v2) return "Verse " + a; return (n.c1 === n.c2 ? "Verses " + a + "-" + n.v2 : a + " to " + n.c2 + ":" + n.v2); };
      var h = '<div class="lbl u-mt14">Open study notes (' + all.length + ")</div>";
      if (!all.length) return h + none("No open study note covers " + esc(this.o.ref) + ".");
      var srcs = Object.keys(NOTE_SRC).filter(function (k) { return have[k]; });
      if (srcs.length > 1) h += '<div class="chips"><button class="chip' + (on === "all" ? " on" : "") + '" data-jst-nsrc="all">Both</button>' + srcs.map(function (k) { return '<button class="chip' + (on === k ? " on" : "") + '" data-jst-nsrc="' + k + '">' + esc(NOTE_SRC[k].short) + " (" + have[k] + ")</button>"; }).join("") + "</div>";
      h += list.map(function (n) { return box(n.src.code === "T" ? "explain" : "apparatus", "", '<div class="item"><span class="when">' + esc(where(n)) + '</span><div class="jst-note">' + noteHTML(n.text) + "</div></div>"); }).join("");
      h += '<p class="ctx u-fs13">' + (have.T && have.B && on === "all" ? "Olive edge: Tyndale. Grey edge: Biblica. " : "") + srcs.map(function (k) { var x = NOTE_SRC[k]; return '<a href="' + x.url + '" target="_blank" rel="noopener">' + esc(x.name) + "</a> (" + x.licence + ")"; }).join(" and ") + ". A verse in a note opens in the reader.</p>";
      return h;
    },
    click: function (e) {
      var sb = e.target.closest("[data-jst-nsrc]");
      if (sb) { e.stopPropagation(); this.st.src = sb.getAttribute("data-jst-nsrc"); this.paint(); return; }
      var tb = e.target.closest("[data-jst-stab]");
      if (tb) { e.stopPropagation(); SHELF_TAB = tb.getAttribute("data-jst-stab"); this.el.scrollTop = 0; this.paint(); return; }
      Panel.prototype.click.call(this, e);
    },
    view: function () {
      var sh = this.sh || {}, segs = shelfBooks(this.o.ref), h = "", own = this.o.owner;
      var TABS = own ? [["com", "Commentaries"], ["sb", "Study Bibles"], ["vault", "Books"], ["other", "Others"]] : [["sb", "Study notes"]];   // maps live in the Maps panel
      var tab = TABS.some(function (t) { return t[0] === SHELF_TAB; }) ? SHELF_TAB : TABS[0][0];
      var tabs = '<div class="chips u-mb10">' + TABS.map(function (t) { return '<button class="chip' + (tab === t[0] ? " on" : "") + '" data-jst-stab="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>";
      var kick = (own ? "My shelf" : "Shelf") + (segs.length ? " \u00B7 " + segs.map(function (s) { return bookLabel(s.book); }).join(", ") : "");
      if (tab === "sb") return { kick: kick, title: own ? "Study Bibles" : "Study notes", body: tabs + (own ? this.studyBiblesHTML() : "") + this.notesHTML() };
      if (tab === "vault") return { kick: kick, title: "Books in my vault", body: tabs + this.vaultHTML() };
      if (tab === "other") return { kick: kick, title: "Others", body: tabs + this.dddHTML() + this.coursesHTML() + this.authorsHTML() };
      if (!segs.length) return { kick: kick, title: "Commentaries", body: tabs };
      h += tabs;
      var c = this.cfg(), names = c.authors, rank = function (x) { var r = authorRank(names, x.by); return r < 0 ? 999 : r; }, hidden = 0;
      var order = function (list) { var n0 = list.length, out = cfgSort(list, function (x) { return x.id; }, c.com, function (a, b) { return rank(a) - rank(b) || (b.year || 0) - (a.year || 0); }); hidden += n0 - out.length; return out; };
      var mine = function (x) { return c.com.order.indexOf(x.id) > -1 || rank(x) < 999; };
      var card = function (s) { return function (x) {
        return box(mine(x) ? "witness" : "apparatus", "", '<div class="item"><span class="when">' + esc([x.series, x.year].filter(Boolean).join(" \u00B7 ")) + '</span><span class="tt">' + esc(x.title) + '</span><span class="sub">' + esc(x.by) + "</span>" +
          outlink(logosRes(x.id, s), "Open") + "</div>");
      }; };
      segs.forEach(function (s) {
        var all = order(sh[s.book] || []), tr = all.filter(mine), rest = all.filter(function (x) { return !mine(x); });
        if (segs.length > 1) h += '<div class="lbl">' + esc(bookLabel(s.book)) + "</div>";
        if (tr.length) h += '<div class="lbl">My first picks</div>' + tr.map(card(s)).join("");
        if (rest.length) h += '<div class="lbl">' + (tr.length ? "The rest of the shelf" : "On " + esc(bookLabel(s.book))) + " (" + rest.length + ")</div>" + rest.map(card(s)).join("");
        if (!all.length) h += none("You don't own a commentary on " + esc(bookLabel(s.book)) + " in Logos.");
      });
      var s0 = segs[0], wide = order((sh[R.book(s0.book) && R.book(s0.book).order < 39 ? "_ot" : "_nt"] || []).concat(sh._bible || []));
      if (wide.length) h += '<details class="jst-past"><summary class="lbl">Whole Bible and whole Testament (' + wide.length + ")</summary>" + wide.map(card(s0)).join("") + "</details>";
      h += '<p class="ctx">Each link opens Logos at the start of the passage in that book. First picks: ranked in Config, or by your authors.' + (hidden ? " " + hidden + " hidden in Config." : "") + "</p>";
      return { kick: kick, title: "Commentaries", body: h };
    }
  }, { owner: false, config: null }, function (d) { return d && d.ref in NOTEN ? NOTEN[d.ref] : null; });

  // ------------------------------------------------------------------ ShelfConfig
  /* Config for the shelf: rank and add authors, rank and hide commentaries (those on the open book), rank and hide study Bibles.
     options: config() -> the saved settings (as shelfCfg reads them)
     sends:   shelfcfg ({key: "authors"|"commentaries"|"studyBibles", value}) */
  define("ShelfConfig", { id: "config", label: "Config", name: "Shelf settings", icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>', owner: true }, {
    prepare: function () { var self = this; return Promise.all([data.shelf(), data.library(), data.vaultBooks()]).then(function (r) { self.sh = r[0]; self.lib = r[1]; self.vb = r[2];
      /* an author with no book in Logos or the BOOKS vault doesn't belong on the list: a saved list drops them once both are loaded */
      var saved = self.o.config && self.o.config(), names = saved && saved.authors && saved.authors.names, lib = (r[1] && r[1].lib) || [], vba = (r[2] && r[2].authors) || [];
      if (names && names.length && r[2]) {
        var keep = names.filter(function (nm) { return lib.some(function (x) { return byAuthor(nm, x[2]); }) || vba.some(function (a) { return byAuthor(nm, a.by); }); });
        if (keep.length < names.length) self.emit("shelfcfg", { key: "authors", value: { names: keep } });
      } }); },
    rowHTML: function (i, n, label, sub, hidden, kind) {
            return '<div class="askrow u-gap6 u-m3' + (hidden ? " u-faded" : "") + '"><span class="u-minw22">' + (hidden ? "" : (i + 1) + ".") + '</span><span class="u-flex1">' + esc(label) + (sub ? ' <span class="sub">' + esc(sub) + "</span>" : "") + "</span>" +
        (hidden ? "" : '<button class="btn" data-jst-cmv="' + kind + "|" + i + '|-1"' + (i ? "" : " disabled") + ' aria-label="Move up">\u2191</button><button class="btn" data-jst-cmv="' + kind + "|" + i + '|1"' + (i < n - 1 ? "" : " disabled") + ' aria-label="Move down">\u2193</button>') +
        '<button class="btn" data-jst-chide="' + kind + "|" + i + "|" + (hidden ? 1 : 0) + '">' + (kind === "authors" ? "\u00D7" : hidden ? "Show" : "Hide") + "</button></div>";
    },
    /* the list a section works on, in its current order: shown ones first (ranked), then hidden ones */
    lists: function () {
      var c = shelfCfg(this.o), sh = this.sh || {}, lib = this.lib || {}, q = data.segs(this.o.ref)[0];
      var names = c.authors, rank = function (by) { var r = authorRank(names, by); return r < 0 ? 999 : r; };
      var com = q ? (sh[q.book] || []).concat(sh[R.book(q.book).order < 39 ? "_ot" : "_nt"] || [], sh._bible || []) : [];
      var comShown = cfgSort(com, function (x) { return x.id; }, c.com, function (a, b) { return rank(a.by) - rank(b.by) || (b.year || 0) - (a.year || 0); });
      var sbAll = (lib.studyBibles || []).map(function (x) { return { id: x[0], t: x[1], by: x[2] }; }).concat(OPEN_SB.map(function (x) { return { id: x[0], t: x[1], by: "" }; }));
      var sbShown = cfgSort(sbAll, function (x) { return x.id; }, c.sb, function (a, b) { return rank(a.by) - rank(b.by) || String(a.t).localeCompare(b.t); });
      return { c: c, book: q ? q.book : "", com: { shown: comShown, hidden: com.filter(function (x) { return c.com.hidden.indexOf(x.id) > -1; }) },
               sb: { shown: sbShown, hidden: sbAll.filter(function (x) { return c.sb.hidden.indexOf(x.id) > -1; }) } };
    },
    view: function () {
      var st = this.st, sec = st.sec || "authors", L2 = this.lists(), self = this, lib = (this.lib && this.lib.lib) || [];
      var tabs = '<div class="chips u-mb10">' + [["authors", "Authors"], ["com", "Commentaries"], ["sb", "Study Bibles"]].map(function (t) { return '<button class="chip' + (sec === t[0] ? " on" : "") + '" data-jst-csec="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>";
      var h = tabs;
      if (sec === "authors") {
        var vba = (this.vb && this.vb.authors) || [];
        var names = L2.c.authors, count = function (nm) { return lib.filter(function (x) { return byAuthor(nm, x[2]); }).length; },
            vcount = function (nm) { return vba.filter(function (a) { return byAuthor(nm, a.by); }).reduce(function (n, a) { return n + a.books.length; }, 0); },
            label = function (nm) { var n = count(nm), v = vcount(nm); return (n ? n + " in Logos" : "none in Logos") + (v ? " \u00B7 " + v + " in your vault" : ""); };
        h += '<p class="ctx">Your authors, in order. Higher shows first on the shelf and lifts their commentaries and study Bibles.</p>';
        h += names.map(function (nm, i) { var n = count(nm); return self.rowHTML(i, names.length, nm, label(nm), false, "authors"); }).join("");
        h += '<div class="ask"><label class="lbl">Add an author</label><input class="jst-in" data-jst-anew placeholder="Michael Heiser, or Heiser, Michael"><div class="askrow"><button class="btn" data-jst-aadd>Add</button><span class="jst-msg">' + esc(st.msg || "") + "</span></div></div>";
      } else {
        var part = sec === "com" ? L2.com : L2.sb;
        h += '<p class="ctx">' + (sec === "com" ? "Commentaries on " + esc(bookLabel(L2.book) || "this book") + " and the whole Bible. The order you set here holds on every book." : "Your study Bibles, Logos and open. Hide one to drop it from the shelf.") + "</p>";
        h += part.shown.map(function (x, i) { return self.rowHTML(i, part.shown.length, x.title || x.t, sec === "com" ? [x.series, x.year].filter(Boolean).join(" \u00B7 ") : shortBy(x.by), false, sec); }).join("");
        if (part.hidden.length) h += '<div class="lbl u-mt10">Hidden (' + part.hidden.length + ")</div>" + part.hidden.map(function (x, i) { return self.rowHTML(i, 0, x.title || x.t, "", true, sec); }).join("");
        if (st.msg) h += '<p class="jst-msg">' + esc(st.msg) + "</p>";
      }
      return { kick: "Config", title: "Shelf settings", body: h };
    },
    save: function (key, value, msg) { this.st.msg = msg || ""; this.emit("shelfcfg", { key: key, value: value }); this.paint(); },
    click: function (e) {
      var t = e.target, sc = t.closest("[data-jst-csec]"), mv = t.closest("[data-jst-cmv]"), hd = t.closest("[data-jst-chide]"), ad = t.closest("[data-jst-aadd]");
      if (sc) { e.stopPropagation(); this.st.sec = sc.getAttribute("data-jst-csec"); this.st.msg = ""; this.paint(); return; }
      var L2 = this.lists(), c = L2.c;
      if (mv) { e.stopPropagation(); var p = mv.getAttribute("data-jst-cmv").split("|"), kind = p[0], i = +p[1], j = i + (+p[2]);
        if (kind === "authors") { var names = c.authors.slice(), x = names.splice(i, 1)[0]; names.splice(j, 0, x); return this.save("authors", { names: names }); }
        var part = kind === "com" ? L2.com : L2.sb, ids = part.shown.map(function (y) { return y.id; }), y = ids.splice(i, 1)[0]; ids.splice(j, 0, y);
        var cur = kind === "com" ? c.com : c.sb, rest = cur.order.filter(function (id) { return ids.indexOf(id) < 0; });
        return this.save(kind === "com" ? "commentaries" : "studyBibles", { order: ids.concat(rest), hidden: cur.hidden });
      }
      if (hd) { e.stopPropagation(); var q = hd.getAttribute("data-jst-chide").split("|"), k2 = q[0], i2 = +q[1], wasHidden = q[2] === "1";
        if (k2 === "authors") { var nm = c.authors.slice(), gone = nm.splice(i2, 1)[0]; return this.save("authors", { names: nm }, "Removed " + gone + "."); }
        var part2 = k2 === "com" ? L2.com : L2.sb, item = (wasHidden ? part2.hidden : part2.shown)[i2], cur2 = k2 === "com" ? c.com : c.sb;
        var hidden = wasHidden ? cur2.hidden.filter(function (id) { return id !== item.id; }) : cur2.hidden.concat([item.id]);
        return this.save(k2 === "com" ? "commentaries" : "studyBibles", { order: cur2.order, hidden: hidden }, (wasHidden ? "Showing " : "Hid ") + (item.title || item.t) + ".");
      }
      if (ad) { e.stopPropagation(); var v = this.el.querySelector("[data-jst-anew]").value.trim(); if (!v) return;
        var names2 = c.authors.slice();
        if (names2.some(function (n) { var a = nameKey(n), b = nameKey(v); return a.last === b.last && a.init === b.init; })) { this.st.msg = v + " is already on the list."; this.paint(); return; }
        var lib = (this.lib && this.lib.lib) || [], n = lib.filter(function (x) { return byAuthor(v, x[2]); }).length;
        names2.push(v); return this.save("authors", { names: names2 }, n ? "Added " + v + ": " + n + " book" + (n > 1 ? "s" : "") + " in your library." : "Added " + v + ". No books by that name in your Logos library yet; check the spelling, or buy one and rebuild the shelf.");
      }
      Panel.prototype.click.call(this, e);
    }
  }, { config: null });

  // ------------------------------------------------------------------ Vocab (the vocabulary deck)
  /* The words James has kept, from Word Study, the interlinear or Claude's "Vocabulary candidates".
     options: items() -> [{id, k, word, strong, gloss, refs:[...], addedAt}]
              obsidian: {vault, path}   when given, "Save to Obsidian" writes the deck as one Markdown note there
     sends:   word (open it in Word Study), vocabRemove */
  function vocabMarkdown(list) {
    var day = new Date().toISOString().slice(0, 10);
    return "---\nsource: Study Workstation\ntags: [study-workstation, vocabulary]\nupdated: " + day + "\nwords: " + list.length + "\n---\n\n# Vocabulary\n\n" +
      list.map(function (x) { var r = x.refs || (x.ref ? [x.ref] : []); return "- **" + x.word + "**" + (x.strong ? " (" + x.strong + ")" : "") + (x.gloss ? ": " + x.gloss : "") + (r.length ? ". From " + r.join(", ") + "." : ""); }).join("\n") + "\n";
  }
  define("Vocab", { id: "vocab", label: "Vocab", name: "My vocabulary deck", icon: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12M7 11h6M7 15h4"/></svg>', owner: true }, {
    list: function () { return (this.o.items ? this.o.items() : []).slice().sort(function (a, b) { return String(a.word).localeCompare(String(b.word)); }); },
    view: function () {
      var all = this.list(), here = R.key(this.o.ref), o = this.o;
      var refsOf = function (x) { return x.refs || (x.ref ? [x.ref] : []); };
      var mine = all.filter(function (x) { return refsOf(x).some(function (r) { return R.key(r) === here; }); });
      var rest = all.filter(function (x) { return mine.indexOf(x) < 0; });
      var card = function (x) {
        return box("witness", "", '<div class="item"><span class="when">' + esc(x.strong || "") + (refsOf(x).length ? " \u00B7 from " + esc(refsOf(x).join(", ")) : "") + '</span><span class="tt">' + esc(x.word) + '</span><span class="sub">' + esc(x.gloss || "") + "</span>" +
          '<div class="askrow">' + (x.k ? '<button class="btn" data-jst-word="' + esc(x.k) + '">Word Study</button>' : "") + '<button class="btn" data-jst-vrm="' + esc(x.id) + '">Remove</button></div></div>');
      };
      var h = '<p class="ctx">Words you have kept. Add one with "+ Vocab" in Word Study or the interlinear, or from Claude\'s vocabulary candidates.</p>';
      h += '<div class="askrow"><button class="btn fill" data-jst-vcopy' + (all.length ? "" : " disabled") + ">Copy</button>";
      if (o.obsidian && all.length) h += '<a class="btn" href="obsidian://new?vault=' + encodeURIComponent(o.obsidian.vault) + "&file=" + encodeURIComponent(o.obsidian.path.replace(/\.md$/, "")) + "&content=" + encodeURIComponent(vocabMarkdown(all)) + '&overwrite=true">Save to Obsidian</a>';
      h += '<span class="jst-msg" data-jst-vmsg></span></div>';
      if (o.obsidian && all.length) h += '<p class="ctx u-fs13">Saves to ' + esc(o.obsidian.path) + " and replaces the copy there.</p>";
      if (!all.length) h += none("The deck is empty.");
      if (mine.length) h += '<div class="lbl">From ' + esc(this.o.ref) + " (" + mine.length + ")</div>" + mine.map(card).join("");
      if (rest.length) h += '<div class="lbl">' + (mine.length ? "The rest of the deck" : "The deck") + " (" + rest.length + ")</div>" + rest.map(card).join("");
      return { kick: "Vocabulary \u00B7 " + all.length + " word" + (all.length === 1 ? "" : "s"), title: "My vocabulary deck", body: h };
    },
    click: function (e) {
      var r = e.target.closest("[data-jst-vrm]"), c = e.target.closest("[data-jst-vcopy]");
      if (r) { e.stopPropagation(); this.emit("vocabRemove", { k: r.getAttribute("data-jst-vrm") }); return; }
      if (c) { e.stopPropagation(); var m = this.el.querySelector("[data-jst-vmsg]"), n = this.list().length;
        navigator.clipboard.writeText(vocabMarkdown(this.list())).then(function () { m.textContent = "Copied " + n + " word" + (n === 1 ? "" : "s") + "."; }).catch(function () { m.textContent = "Copy didn't work here."; }); return; }
      Panel.prototype.click.call(this, e);
    }
  }, { items: null, obsidian: null });

  // ------------------------------------------------------------------ Ideas (the post-idea inbox)
  /* Post ideas logged from Claude's "This is worth its own post on jayms.com:" line, or typed in.
     options: items() -> [{id, title, ref, text, answerId, written, createdAt}]
              obsidian: {vault, path}   when given, "Save to Obsidian" writes the list as one Markdown note
     sends:   idea (one typed in), ideaSet ({id, written}), ideaRemove, passage (open the idea's passage) */
  function ideasMarkdown(list) {
    var day = new Date().toISOString().slice(0, 10), open = list.filter(function (x) { return !x.written; }), done = list.filter(function (x) { return x.written; });
    var row = function (x) { var t = String(x.text || "").replace(/\s+/g, " ").trim(); return "- [" + (x.written ? "x" : " ") + "] **" + x.title + "** (" + x.ref + ")" + (t ? "\n  " + (t.length > 400 ? t.slice(0, 400) + "..." : t) : ""); };
    return "---\nsource: Study Workstation\ntags: [study-workstation, post-ideas]\nupdated: " + day + "\n---\n\n# Post ideas\n\n" + (open.length ? open.map(row).join("\n") + "\n" : "Nothing open.\n") + (done.length ? "\n## Written\n\n" + done.map(row).join("\n") + "\n" : "");
  }
  define("Ideas", { id: "ideas", label: "Ideas", name: "Post ideas", icon: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>', owner: true }, {
    list: function () { return (this.o.items ? this.o.items() : []).slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }); },
    view: function () {
      var all = this.list(), o = this.o, here = R.key(o.ref), st = this.st;
      var open = all.filter(function (x) { return !x.written; }), done = all.filter(function (x) { return x.written; });
      var card = function (x) {
        var t = String(x.text || ""), short = t.length > 280 ? t.slice(0, 280) + "\u2026" : t;
        return box(x.written ? "apparatus" : "witness", "", '<div class="item"><span class="when">' + esc(x.ref) + (R.key(x.ref) === here ? " \u00B7 this passage" : "") + (x.createdAt ? " \u00B7 " + new Date(x.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "") + '</span><span class="tt">' + esc(x.title) + "</span>" +
          (short ? '<details class="jst-past"><summary class="lbl">What Claude said</summary><p class="u-fs15 u-m6-0">' + md(st["full" + x.id] ? t : short) + "</p></details>" : "") +
          '<div class="askrow"><label class="jst-tick"><input type="checkbox" data-jst-iw="' + esc(x.id) + '"' + (x.written ? " checked" : "") + "> Written</label>" +
          (R.key(x.ref) !== here ? '<button class="btn" data-jst-ipass="' + esc(x.ref) + '">Open ' + esc(x.ref) + "</button>" : "") +
          '<button class="btn" data-jst-irm="' + esc(x.id) + '">Remove</button></div></div>');
      };
      var h = '<p class="ctx">Posts worth writing. Claude\'s "worth its own post" line logs here with one press; you can add your own too.</p>';
      h += '<div class="askrow"><button class="btn fill" data-jst-icopy' + (all.length ? "" : " disabled") + ">Copy</button>";
      if (o.obsidian && all.length) h += '<a class="btn" href="obsidian://new?vault=' + encodeURIComponent(o.obsidian.vault) + "&file=" + encodeURIComponent(o.obsidian.path.replace(/\.md$/, "")) + "&content=" + encodeURIComponent(ideasMarkdown(all)) + '&overwrite=true">Save to Obsidian</a>';
      h += '<span class="jst-msg" data-jst-imsg></span></div>';
      h += '<div class="ask"><label class="lbl">Add an idea from ' + esc(o.ref) + '</label><input class="jst-in" data-jst-inew placeholder="Working title"><div class="askrow"><button class="btn" data-jst-iadd>Log it</button></div></div>';
      h += open.length ? '<div class="lbl">Open (' + open.length + ")</div>" + open.map(card).join("") : none("No open ideas.");
      if (done.length) h += '<details class="jst-past"><summary class="lbl">Written (' + done.length + ")</summary>" + done.map(card).join("") + "</details>";
      return { kick: "Post ideas \u00B7 " + open.length + " open", title: "Post ideas", body: h };
    },
    click: function (e) {
      var t = e.target, w = t.closest("[data-jst-iw]"), r = t.closest("[data-jst-irm]"), c = t.closest("[data-jst-icopy]"), a = t.closest("[data-jst-iadd]"), p = t.closest("[data-jst-ipass]");
      if (w) { e.stopPropagation(); this.emit("ideaSet", { id: w.getAttribute("data-jst-iw"), written: w.checked }); return; }
      if (r) { e.stopPropagation(); this.emit("ideaRemove", { id: r.getAttribute("data-jst-irm") }); return; }
      if (p) { e.stopPropagation(); this.emit("passage", { ref: p.getAttribute("data-jst-ipass") }); return; }
      if (a) { e.stopPropagation(); var inp = this.el.querySelector("[data-jst-inew]"), v = inp.value.trim(); if (v) { this.emit("idea", { title: v, ref: this.o.ref, text: "", answerId: null }); inp.value = ""; } return; }
      if (c) { e.stopPropagation(); var m = this.el.querySelector("[data-jst-imsg]"), n = this.list().length;
        navigator.clipboard.writeText(ideasMarkdown(this.list())).then(function () { m.textContent = "Copied " + n + " idea" + (n === 1 ? "" : "s") + "."; }).catch(function () { m.textContent = "Copy didn't work here."; }); return; }
      Panel.prototype.click.call(this, e);
    }
  }, { items: null, obsidian: null });

  // ------------------------------------------------------------------ PlanBuilder
  /* Build a reading plan in the page: a book chapter by chapter, or a list of passages one day each.
     The result has exactly the shape of plans/<id>.json, so anything that reads plan files reads it.
     options: mine() -> [plan]   the plans James has made (to list and delete)
     sends:   plan (the finished plan), planRemove ({id}) */
  function isoDay(d) { var x = d || new Date(); return x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2) + "-" + ("0" + x.getDate()).slice(-2); }
  function buildPlan(f) {
    var days = [], errs = [];
    if (f.mode === "book") {
      var b = R.book(f.book); if (!b) return { errs: ["Pick a book."] };
      var from = Math.max(1, +f.from || 1), to = Math.min(b.chapters, +f.to || b.chapters), per = Math.max(1, +f.per || 1);
      if (from > to) return { errs: ["The first chapter is after the last."] };
      /* chapters to read, less the ones James skips when that box is ticked; then N a day */
      var skip = f.skip && f.skipList ? (f.skipList[b.name] || []) : [], chs = [];
      for (var c = from; c <= to; c++) if (skip.indexOf(c) < 0) chs.push(c);
      for (var i = 0; i < chs.length; i += per) {
        var grp = chs.slice(i, i + per), runs = [], st0 = grp[0], prev = grp[0];
        grp.slice(1).concat([null]).forEach(function (x) { if (x !== prev + 1) { runs.push(st0 === prev ? String(st0) : st0 + "-" + prev); st0 = x; } prev = x; });
        var ref = b.chapters === 1 ? b.name : b.name + " " + runs.join(", ");
        days.push({ day: days.length + 1, title: ref, note: "", readings: [{ ref: ref, role: "Main reading", why: "" }] });
      }
    } else {
      String(f.list || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (line, i) {
        var bits = line.split("|"), refs = bits[0].split(";").map(function (r) { return r.trim(); }).filter(Boolean), why = (bits[1] || "").trim(), rs = [];
        refs.forEach(function (r) { var sg = R.parse(r); if (!sg.length) errs.push("Line " + (i + 1) + ": couldn't read \"" + r + "\"."); else rs.push({ ref: R.format(sg), role: rs.length ? "Read with" : "Main reading", why: rs.length ? "" : why }); });
        if (rs.length) days.push({ day: days.length + 1, title: rs[0].ref, note: "", readings: rs });
      });
    }
    if (!days.length && !errs.length) errs.push(f.mode === "book" ? "No chapters in that range." : "Add at least one passage.");
    var name = String(f.name || "").trim() || (f.mode === "book" ? (R.book(f.book) || {}).name + ", chapter by chapter" : "My reading plan");
    return { errs: errs, plan: { id: "my-" + slug(name) + "-" + Date.now().toString(36), name: name, description: String(f.desc || "").trim(), start: f.start || isoDay(), mine: true, days: days } };
  }
  define("PlanBuilder", { id: "planner", label: "Plan", name: "Build a reading plan", icon: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M4 9h16M8 13h3M8 17h6"/></svg>', owner: true }, {
    form: function () {
      var g = function (k) { var x = this.el.querySelector('[data-pb="' + k + '"]'); return x ? x.value : ""; }.bind(this);
      var sk = this.el.querySelector('[data-pb="skip"]');
      return { mode: this.st.mode || "book", name: g("name"), desc: g("desc"), start: g("start"), book: g("book"), from: g("from"), to: g("to"), per: g("per"), list: g("list"), skip: !!(sk && sk.checked), skipList: this.o.skipList || null };
    },
    view: function () {
      var st = this.st, f = st.f || { mode: "book", start: isoDay(), book: (data.segs(this.o.ref)[0] || {}).book || "Genesis", per: 1, from: 1, to: "" }, mode = st.mode || f.mode;
      var opt = function (v, cur) { return '<option' + (v === cur ? " selected" : "") + ">" + esc(v) + "</option>"; };
      var h = '<p class="ctx">A plan saves to your account and shows in the plan menu beside the others. Same shape as the plan files, so it can be copied into plans/ later.</p>';
      h += '<div class="ask"><label class="lbl">Name</label><input class="jst-in" data-pb="name" value="' + esc(f.name || "") + '" placeholder="Romans in a month">' +
        '<label class="lbl">One line about it (optional)</label><input class="jst-in" data-pb="desc" value="' + esc(f.desc || "") + '">' +
        '<label class="lbl">Day 1 is</label><input class="jst-in" type="date" data-pb="start" value="' + esc(f.start || isoDay()) + '"></div>';
      h += '<div class="chips u-m10"><button class="chip' + (mode === "book" ? " on" : "") + '" data-pb-mode="book">A book, chapter by chapter</button><button class="chip' + (mode === "list" ? " on" : "") + '" data-pb-mode="list">Passages, one day each</button></div>';
      if (mode === "book") h += '<div class="ask"><label class="lbl">Book</label><select class="jst-in" data-pb="book">' + R.books.map(function (b) { return opt(b.name, f.book); }).join("") + "</select>" +
        '<label class="lbl">Chapters a day</label><input class="jst-in" type="number" min="1" max="10" data-pb="per" value="' + esc(f.per || 1) + '">' +
        '<label class="lbl">From chapter, to chapter (blank = the end)</label><div class="askrow"><input class="jst-in u-w45" type="number" min="1" data-pb="from" value="' + esc(f.from || 1) + '"><input class="jst-in u-w45" type="number" min="1" data-pb="to" value="' + esc(f.to || "") + '"></div>' +
        (this.o.skipList ? '<label class="planopt"><input type="checkbox" data-pb="skip"' + (f.skip ? " checked" : "") + "> Skip genealogies &amp; lists</label>" : "") + "</div>";
      else h += '<div class="ask"><label class="lbl">One day per line. Several passages on a day: separate with ";". Why it\'s there: after a "|".</label><textarea data-pb="list" placeholder="Psalm 82; Deuteronomy 32:7-9 | The council judged\\nDaniel 10:12-21\\nEphesians 6:10-20">' + esc(f.list || "") + "</textarea></div>";
      h += '<div class="askrow"><button class="btn" data-pb-go="preview">Preview</button><button class="btn fill" data-pb-go="save">Save</button><span class="jst-msg" data-pb-msg>' + esc(st.msg || "") + "</span></div>";
      if (st.res) {
        var r = st.res;
        if (r.errs.length) h += box("not", "Fix these first", r.errs.map(function (e) { return "<p>" + esc(e) + "</p>"; }).join(""));
        if (r.plan.days.length) h += box("apparatus", esc(r.plan.name) + " \u00B7 " + r.plan.days.length + " day" + (r.plan.days.length === 1 ? "" : "s"), r.plan.days.slice(0, 5).map(function (d) { return "<p><b>Day " + d.day + "</b> " + esc(d.readings.map(function (x) { return x.ref; }).join("; ")) + "</p>"; }).join("") + (r.plan.days.length > 5 ? "<p>\u2026 to day " + r.plan.days.length + ": " + esc(r.plan.days[r.plan.days.length - 1].title) + "</p>" : ""));
      }
      var mine = this.o.mine ? this.o.mine() : [];
      if (mine.length) h += '<div class="lbl u-mt12">Plans you made</div>' + mine.map(function (p) { return box("witness", "", '<div class="item"><span class="when">' + p.days.length + " days \u00B7 from " + esc(p.start) + '</span><span class="tt">' + esc(p.name) + '</span><div class="askrow"><button class="btn" data-pb-rm="' + esc(p.id) + '">Delete</button></div></div>'); }).join("");
      return { kick: "Reading plans", title: "Build a plan", body: h };
    },
    click: function (e) {
      var t = e.target, m = t.closest("[data-pb-mode]"), go = t.closest("[data-pb-go]"), rm = t.closest("[data-pb-rm]");
      if (m) { e.stopPropagation(); this.st.f = this.form(); this.st.mode = m.getAttribute("data-pb-mode"); this.st.f.mode = this.st.mode; this.paint(); return; }
      if (go) { e.stopPropagation(); var f = this.form(); f.mode = this.st.mode || "book"; this.st.f = f; this.st.res = buildPlan(f); this.st.msg = "";
        if (go.getAttribute("data-pb-go") === "save" && !this.st.res.errs.length) { this.emit("plan", this.st.res.plan); this.st.msg = "Saved. It's in the plan menu now."; }
        this.paint(); return; }
      if (rm) { e.stopPropagation(); if (confirm("Delete this plan? Your notes and done marks stay.")) this.emit("planRemove", { id: rm.getAttribute("data-pb-rm") }); return; }
      Panel.prototype.click.call(this, e);
    }
  }, { mine: null });
  api.buildPlan = buildPlan;

  // ------------------------------------------------------------------ WrapUp (the day's four deliverables)
  /* Turns the day's notes and saved Claude answers into the bible-book-study deliverables, each one ready for Obsidian.
     The rules live in a file James edits (wrapup-instructions.md: a preamble, then one "## <key>" section per deliverable),
     sent after the desk rules (claude-instructions.md). Nothing here decides what Claude writes.
     options: ask (a sample()-style function), material() -> string, title, refs, saved() -> {parts} | null,
              obsidian: {vault, folder}, instructions, wrapRules
     sends:   wrap (the record, after each part), vocab (from the vocabulary part's "Vocabulary candidates:" line) */
  var WRAP_PARTS = [
    { key: "mind-dump", name: "Mind Dump" }, { key: "student-sheet", name: "Student Sheet" },
    { key: "quiz", name: "Quiz" }, { key: "vocabulary", name: "Vocabulary" }
  ];
  define("WrapUp", { id: "wrap", label: "Wrap up", name: "Wrap up the day", icon: '<svg viewBox="0 0 24 24"><path d="M4 7l8-4 8 4-8 4z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></svg>', owner: true }, {
    keepRunning: true,   // it saves under o.saveKey (the day it started on), so it can finish after you move on
    rules: function () {
      var self = this, o = this.o;
      if (this._rules) return Promise.resolve(this._rules);
      var get = function (f) { return fetch(CFG.base + f, { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; }); };
      return Promise.all([get(o.instructions), get(o.wrapRules)]).then(function (a) {
        if (!a[0] || !a[1]) return null;
        var pre = a[1].split(/\n## /)[0], secs = {};
        a[1].split(/\n## /).slice(1).forEach(function (sec) { var k = sec.split("\n")[0].trim(); secs[k] = "## " + sec; });
        return (self._rules = { desk: a[0], pre: pre, secs: secs });
      });
    },
    parts: function () { var sv = this.st.parts || (this.o.saved && this.o.saved() && this.o.saved().parts) || {}; return sv; },
    view: function () {
      var o = this.o, st = this.st, parts = this.parts(), self = this, have = WRAP_PARTS.filter(function (p) { return parts[p.key]; }).length;
      var h = '<p class="ctx">Makes the four bible-book-study deliverables from today\'s notes and the Claude answers you saved on ' + esc((o.refs || []).join(", ")) + ". The rules are in wrapup-instructions.md.</p>";
      h += '<div class="askrow"><button class="btn fill" data-jst-wgo' + (st.busy || !o.ask ? " disabled" : "") + ">" + (st.busy ? "Working on " + esc(st.busy) + "\u2026" : have ? "Redo" : "Make it") + "</button>" + (st.busy ? '<button class="btn" data-jst-wstop>Stop</button>' : "") + "</div>";
      if (!o.ask) h += none("Claude isn't available here, so the wrap-up can't be made.");
      if (st.err) h += box("not", "", "<p>" + esc(st.err) + "</p>");
      WRAP_PARTS.forEach(function (p) {
        var t = parts[p.key], live = st.busy === p.name;
        if (!t && !live) return;
        var file = o.title + " - " + p.name, link = o.obsidian && t && !live ? "obsidian://new?vault=" + encodeURIComponent(o.obsidian.vault) + "&file=" + encodeURIComponent(o.obsidian.folder + "/" + file.replace(/[:\\/?*"<>|]/g, ".")) + "&content=" + encodeURIComponent(t) + "&overwrite=true" : "";
        var body = '<details class="jst-past"' + (live ? " open" : "") + '><summary class="lbl">' + (live ? "Writing\u2026" : "Read it") + '</summary><div class="ans" data-jst-wlive="' + p.key + '">' + esc(t || "Thinking\u2026") + "</div></details>";
        if (!live) {
          body += '<div class="askrow"><button class="btn" data-jst-wcopy="' + p.key + '">Copy</button>' + (link ? '<a class="btn" href="' + link + '">Save to Obsidian</a>' : "") + "</div>";
          if (p.key === "vocabulary") { var v = parseAnswer(t).vocab; if (v.length) body += '<div class="chips">' + v.map(function (w) { var k = w.strong ? w.strong.toLowerCase() : ""; return self.vocabBtn({ k: k, word: w.word, strong: w.strong, gloss: (k && WORDS[k] && WORDS[k].gloss) || "" }).replace('class="btn', 'class="chip').replace("+ Vocab", "+ " + esc(w.word)).replace("\u2713 In my vocab", "\u2713 " + esc(w.word)); }).join("") + "</div>"; }
        }
        h += box(live ? "open" : "witness", esc(p.name) + (link ? '<span class="jst-msg u-ml8">' + esc(o.obsidian.folder + "/" + file) + ".md</span>" : ""), body);
      });
      return { kick: "Wrap-up \u00B7 " + have + " of 4 made", title: "Wrap up " + (o.title || "the day"), body: h };
    },
    run: function () {
      var self = this, o = this.o, st = this.st;
      st.err = ""; st.parts = {}; st.ctl = new AbortController();
      this.rules().then(function (R2) {
        if (!R2) { st.err = "The instructions files didn't load, so nothing was made. Reload and try again."; st.busy = null; return self.paint(); }
        var material = o.material ? o.material() : "", i = 0;
        var next = function () {
          if (i >= WRAP_PARTS.length) { st.busy = null; self.paint(); return; }
          var p = WRAP_PARTS[i++], prior = st.parts["mind-dump"];
          st.busy = p.name; self.paint();
          var prompt = R2.desk + "\n\n" + R2.pre + "\n\n" + (R2.secs[p.key] || "") + "\n\nWrite only the " + p.name + ", nothing before or after it.\n\n" + material +
            (prior && p.key !== "mind-dump" ? "\n\n=== THE MIND DUMP ALREADY MADE FROM THIS MATERIAL ===\n" + prior + "\n=== END ===" : "");
          return o.ask(prompt, { signal: st.ctl.signal, cache: false, onText: function (x) { var el = self.el.querySelector('[data-jst-wlive="' + p.key + '"]'); if (el) el.textContent = x.text; } })
            .then(function (res) {
              st.parts[p.key] = String(res.text || "").trim();
              self.emit("wrap", { key: o.saveKey, title: o.title, refs: o.refs, parts: Object.assign({}, st.parts), at: Date.now() });
              return next();
            });
        };
        return next();
      }).catch(function (e) {
        st.busy = null; st.err = e && e.code === "cancelled" ? "Stopped. What was finished is kept." : "Claude couldn't finish: " + ((e && e.message) || "unknown error") + ". What was finished is kept.";
        if (Object.keys(st.parts).length) self.emit("wrap", { title: o.title, refs: o.refs, parts: Object.assign({}, st.parts), at: Date.now() });
        self.paint();
      });
    },
    click: function (e) {
      var t = e.target, go = t.closest("[data-jst-wgo]"), stop = t.closest("[data-jst-wstop]"), cp = t.closest("[data-jst-wcopy]");
      if (go) { e.stopPropagation(); this.run(); return; }
      if (stop) { e.stopPropagation(); if (this.st.ctl) this.st.ctl.abort(); return; }
      if (cp) { e.stopPropagation(); var txt = this.parts()[cp.getAttribute("data-jst-wcopy")] || ""; navigator.clipboard.writeText(txt).then(function () { cp.textContent = "Copied"; }).catch(function () { cp.textContent = "Copy didn't work here"; }); return; }
      Panel.prototype.click.call(this, e);
    }
  }, { ask: null, material: null, title: "", refs: [], saved: null, obsidian: null, instructions: "claude-instructions.md", wrapRules: "wrapup-instructions.md" });

  // ------------------------------------------------------------------ Review (spaced review of the deck and past days)
  /* Flashcards from the vocabulary deck on a five-box schedule (1, 2, 4, 8, 16 days; a miss goes back to box 1),
     and the quizzes from past wrap-ups, so what was kept shows as well as what was read.
     options: cards() -> vocab items, state(k) -> {box, due} | null, quizzes() -> [{title, refs, quiz, at}]
     sends:   review ({k, knew, box, due, at}), word */
  var BOX_DAYS = [1, 2, 4, 8, 16];
  function dueCards(cards, state, now) { return cards.filter(function (c) { var s2 = state(c.id); return !s2 || (s2.due || 0) <= now; }); }
  function reviewCount(cards, state) { return dueCards(cards, state, Date.now()).length; }
  define("Review", { id: "review", label: "Review", name: "Review what I kept", icon: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4M12 8v4l3 2"/></svg>', owner: true }, {
    view: function () {
      var o = this.o, st = this.st, cards = o.cards ? o.cards() : [], state = o.state || function () { return null; };
      var due = dueCards(cards, state, Date.now()), c = due.filter(function (x) { return x.id === st.cur; })[0] || due[0], h = "";
      h += '<div class="lbl">Vocabulary \u00B7 ' + due.length + " due of " + cards.length + "</div>";
      if (!cards.length) h += none("The deck is empty. Words you add with \"+ Vocab\" come up here.");
      else if (!c) {
        var next = cards.map(function (x) { return (state(x.id) || {}).due || 0; }).filter(Boolean).sort()[0];
        h += none("Nothing due. Next card " + (next ? new Date(next).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }) : "soon") + ".");
      } else {
        st.cur = c.id;
        var s2 = state(c.id) || { box: 0 }, refs = c.refs || (c.ref ? [c.ref] : []);
        var back = st.show ? '<p class="u-fs18 u-m10-4">' + esc(c.gloss || "(no gloss saved)") + '</p><p class="sub">' + esc(c.strong || "") + (refs.length ? " \u00B7 " + esc(refs.join(", ")) : "") + "</p>" +
          '<div class="askrow"><button class="btn fill" data-jst-rv="1">I knew it</button><button class="btn" data-jst-rv="0">Not yet</button>' + (c.k ? '<button class="btn" data-jst-word="' + esc(c.k) + '">Word Study</button>' : "") + "</div>"
          : '<div class="askrow"><button class="btn fill" data-jst-rshow>Show the meaning</button></div>';
        h += box("witness", "", '<div class="item"><span class="when">' + (s2.box ? "Box " + s2.box + " of 5" : "New card") + "</span><div class=\"big\">" + esc(c.word) + "</div>" + back + "</div>");
      }
      var qs = o.quizzes ? o.quizzes() : [];
      h += '<div class="lbl u-mt14">Quizzes from past days (' + qs.length + ")</div>";
      h += qs.length ? qs.map(function (q) {
        var parts = String(q.quiz).split(/\n##\s*Answer key/i);
        return box("apparatus", "", '<div class="item"><span class="when">' + new Date(q.at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " \u00B7 " + esc((q.refs || []).join(", ")) + '</span><span class="tt">' + esc(q.title) + '</span><details class="jst-past"><summary class="lbl">Take it</summary><div class="ans">' + esc(parts[0]) + "</div>" + (parts[1] ? '<details class="jst-past"><summary class="lbl">Answer key</summary><div class="ans">' + esc(parts[1]) + "</div></details>" : "") + "</details></div>");
      }).join("") : none("Quizzes come from the wrap-up. Make one at the end of a day and it shows here.");
      return { kick: "Review \u00B7 " + due.length + " card" + (due.length === 1 ? "" : "s") + " due", title: "Review what I kept", body: h };
    },
    click: function (e) {
      var t = e.target, sh = t.closest("[data-jst-rshow]"), rv = t.closest("[data-jst-rv]");
      if (sh) { e.stopPropagation(); this.st.show = true; this.paint(); return; }
      if (rv) { e.stopPropagation(); var k = this.st.cur, knew = rv.getAttribute("data-jst-rv") === "1", s2 = (this.o.state && this.o.state(k)) || { box: 0 };
        var box2 = knew ? Math.min(5, (s2.box || 0) + 1) : 1, at = Date.now(), d = new Date(); d.setHours(4, 0, 0, 0); d.setDate(d.getDate() + BOX_DAYS[box2 - 1]);
        this.st.show = false; this.st.cur = null;
        this.emit("review", { k: k, knew: knew, box: box2, due: d.getTime(), at: at }); this.paint(); return; }
      Panel.prototype.click.call(this, e);
    }
  }, { cards: null, state: null, quizzes: null });
  api.reviewCount = reviewCount;

  // ------------------------------------------------------------------ LogosQueue
  /* The Logos searches queued from Claude's answers (or typed in), ready to paste into Logos.
     options: items() -> [{id, ref, queries:[...], done, createdAt}]   the queue, from wherever the page keeps it
     sends:   logos (a search typed in), logosDone, logosRemove
     Copy text is the standing format: a block holding only "logos" and its searches, a blank line between blocks. */
  function logosBlock(q) { return "logos\n" + q.join("\n"); }
  define("LogosQueue", { id: "logos", label: "Logos", name: "Logos queue", icon: ICON.logos, owner: true }, {
    list: function () { return (this.o.items ? this.o.items() : []).slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }); },
    view: function () {
      var self = this, all = this.list(), open = all.filter(function (x) { return !x.done; }), done = all.filter(function (x) { return x.done; });
      var here = R.key(this.o.ref);
      var h = '<p class="ctx">Searches to run in Logos. Copy them, paste into Logos, and tick each one off when you have it.</p>';
      h += '<div class="askrow"><button class="btn fill" data-jst-lcopy="all"' + (open.length ? "" : " disabled") + ">Copy all</button>" + '<span class="jst-msg" data-jst-lmsg></span></div>';
      var card = function (x) {
        return '<div class="box v-apparatus' + (x.done ? " jst-done" : "") + '"><div class="item"><span class="when">' + esc(x.ref) + (R.key(x.ref) === here ? " \u00B7 this passage" : "") + "</span>" +
          '<pre class="jst-logos">' + esc(logosBlock(x.queries)) + "</pre>" +
          '<div class="askrow"><label class="jst-tick"><input type="checkbox" data-jst-ldone="' + esc(x.id) + '"' + (x.done ? " checked" : "") + "> Done</label>" +
          '<button class="btn" data-jst-lcopy="' + esc(x.id) + '">Copy</button><button class="btn" data-jst-lrm="' + esc(x.id) + '">Remove</button></div></div></div>';
      };
      h += open.length ? open.map(card).join("") : none("Nothing queued. When Claude adds a Logos block to an answer, press \"Queue\" under it, or add a search below.");
      h += '<div class="ask"><label class="lbl">Add a search for ' + esc(this.o.ref) + '</label><textarea data-jst-lnew placeholder="One search per line, up to four"></textarea><div class="askrow"><button class="btn" data-jst-ladd>Add to the queue</button></div></div>';
      if (done.length) h += '<details class="jst-past"><summary class="lbl">Done (' + done.length + ")</summary>" + done.slice().reverse().map(card).join("") + "</details>";
      var links = R.refly(this.o.ref, this.o.translation);
      h += links.map(function (l) { return outlink(l.url, links.length > 1 ? esc(l.label) + " in Logos" : "Open in Logos"); }).join("");
      return { kick: "Logos \u00B7 " + open.length + " open", title: "Logos queue", body: h };
    },
    copy: function (txt, msg) {
      var m = this.el.querySelector("[data-jst-lmsg]");
      navigator.clipboard.writeText(txt).then(function () { if (m) m.textContent = msg; }).catch(function () { if (m) m.textContent = "Copy didn't work here; select the text in the box instead."; });
    },
    click: function (e) {
      var t = e.target, c = t.closest("[data-jst-lcopy]"), r = t.closest("[data-jst-lrm]"), a = t.closest("[data-jst-ladd]"), d = t.closest("[data-jst-ldone]");
      if (d) { e.stopPropagation(); this.emit("logosDone", { id: d.getAttribute("data-jst-ldone"), done: d.checked }); return; }
      if (c) { e.stopPropagation(); var id = c.getAttribute("data-jst-lcopy"), all = this.list();
        if (id === "all") { var open = all.filter(function (x) { return !x.done; }); this.copy(open.map(function (x) { return logosBlock(x.queries); }).join("\n\n"), "Copied " + open.length + " block" + (open.length === 1 ? "" : "s") + ". Paste into Logos."); }
        else { var x = all.filter(function (y) { return y.id === id; })[0]; if (x) this.copy(logosBlock(x.queries), "Copied. Paste into Logos."); }
        return; }
      if (r) { e.stopPropagation(); this.emit("logosRemove", { id: r.getAttribute("data-jst-lrm") }); return; }
      if (a) { e.stopPropagation(); var ta = this.el.querySelector("[data-jst-lnew]"), q = ta.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 4);
        if (q.length) { this.emit("logos", { queries: q, ref: this.o.ref, answerId: null }); ta.value = ""; } return; }
      Panel.prototype.click.call(this, e);
    }
  }, { items: null, translation: "LSB" });

  // ------------------------------------------------------------------ BibleProject, Church Fathers, Targum
  /* BibleProject: the book's guide first, then its videos, articles and podcast episodes that deal with the chapter open in the reader.
     Built by scripts/build-bibleproject-index.py from bibleproject.com; every link opens on their site. */
  var BP_EMBED = /(^|\.)jayms\.com$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
  var NBP_FEED = "446953";   // the Naked Bible Podcast's Podcast Index feed id
  var BP_KIND = { v: "Videos", a: "Articles", p: "Podcast episodes", g: "Guides" }, BP_TAB = "watch";
  define("BibleProject", { id: "bp", label: "Media", name: "Videos, podcasts and articles on this passage", icon: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>' }, {
    prepare: function () {
      var self = this;
      data.podcast(NBP_FEED).then(function (p) { self.nbp = p; if (self.alive && self.bp) self.paint(); });   /* self.d is the passage until the BibleProject list lands, so wait on self.bp */   // arrives when it arrives
      return Promise.all([data.bibleproject(), data.lsbAudio(), data.heiser()]).then(function (r) { self.bp = r[0]; self.au = r[1]; self.hf = r[2]; });
    },
    /* Heiser Foundation articles that cite the passage's chapters: one citing more of them first, then the site's own order (most citations) */
    heiserFor: function (segs) {
      var hf = this.hf, score = {}, order = [];
      if (!hf) return [];
      segs.forEach(function (q) { var ch = hf.chapters[q.book] || {};
        for (var c = q.c1; c <= (q.c2 || q.c1); c++) (ch[c] || []).forEach(function (id, rank) { if (!(id in score)) { score[id] = 0; order.push(id); } score[id] += 1000 - rank; }); });
      return order.sort(function (a, b) { return score[b] - score[a]; }).map(function (id) { return hf.articles[id]; }).filter(Boolean);
    },
    /* Naked Bible Podcast episodes on the passage: a passage named in the title counts most, then ones the description names */
    nbpFor: function (segs) {
      var eps = (this.nbp && this.nbp.episodes) || [], out = [];
      var hit = function (text) { return R.refsIn(text).filter(function (x) { return segs.some(function (q) { return R.overlap(x.seg, q); }); }).length; };
      eps.forEach(function (e) { var sc = 10 * hit(e.t) + hit(e.desc); if (sc) out.push({ e: e, sc: sc }); });
      return out.sort(function (a, b) { return b.sc - a.sc || b.e.date - a.e.date; }).map(function (x) { return x.e; });
    },
    /* the LSB audio reading of this chapter: one video per chapter from youtube.com/@lsbaudiobible (scripts/build-lsb-audio.py).
       It plays in the panel where the page may frame YouTube (Chrome/Safari from localhost:8940, or jayms.com); claude.ai blocks
       other sites' frames, so there it opens the chapter on YouTube */
    /* every chapter in the reading gets a button; playing one carries on through the rest of the reading (a YouTube playlist) */
    audioHTML: function (ref) {
      var au = this.au || {}, list = [];
      data.segs(ref).forEach(function (q) { for (var c = q.c1; c <= (q.c2 || q.c1); c++) { var id = au[q.book] && au[q.book][c]; if (id) list.push({ id: id, t: q.book + (R.book(q.book).chapters > 1 ? " " + c : "") }); } });
      if (!list.length) return "";
      var one = list.length === 1;
      if (!BP_EMBED) return box("scripture", "", '<div class="item">' + (one ? "" : '<div class="lbl">Listen (LSB)</div>') + list.map(function (x) { return outlink("https://www.youtube.com/watch?v=" + x.id, one ? "Listen to " + esc(x.t) + " (LSB)" : esc(x.t)); }).join(" ") + "</div>");
      var btn = function (x, i) {
        /* the playlist must start with the chapter tapped: given only the later ones, YouTube skips straight to them */
        var rest = list.slice(i + 1).map(function (y) { return y.id; }), src = "https://www.youtube-nocookie.com/embed/" + x.id + "?autoplay=1&rel=0" + (rest.length ? "&playlist=" + [x.id].concat(rest).join(",") : "");
        return '<button class="' + (one ? "btn" : "chip") + '" data-jst-lsbplay data-src="' + esc(src) + '" data-url="https://www.youtube.com/watch?v=' + x.id + '">' + (one ? "Listen to " + esc(x.t) + " (LSB)" : esc(x.t)) + "</button>";
      };
      return box("scripture", "", '<div class="item" data-jst-lsb>' + (one ? "" : '<div class="lbl">Listen (LSB)</div><div class="chips">') + list.map(btn).join("") + (one ? "" : "</div>") + '<div data-jst-lsbslot></div></div>');
    },


    view: function () {
      var d = this.bp, st = this.st, q = data.segs(this.o.ref)[0];
      if (!q) return { kick: "BibleProject", title: this.o.ref, body: none("Open a passage first.") };
      if (!d) return { kick: "BibleProject", title: this.o.ref, body: none("The BibleProject list didn't load.") };
      var b = R.book(q.book), name = b.name, I = d.items, seen = {}, h = "";
      var link = function (i) { var x = I[i]; return '<p class="u-m8">' + outlink(x[2], esc(x[1])) + (x[3] ? '<br><span class="u-fs15">' + esc(x[3]) + "</span>" : "") + "</p>"; };
      h += this.audioHTML(this.o.ref);
      if (d.guide[name] != null) { seen[d.guide[name]] = 1; h += box("scripture", "", '<div class="item">' + outlink(I[d.guide[name]][2], "BibleProject guide to " + esc(name)) + "</div>"); }
      /* every chapter in the passage, strongest first; a page tied to several of them counts once */
      var score = {};
      for (var c = q.c1; c <= (q.c2 || q.c1); c++) ((d.ch[name] || {})[c] || []).forEach(function (x) { score[x[0]] = (score[x[0]] || 0) + x[1]; });
      /* the book's overview video sits at the top of the videos */
      (d.book[name] || []).forEach(function (i) { score[i] = (score[i] || 0) + 100; });
      var ids = Object.keys(score).map(Number).filter(function (i) { return !seen[i]; }).sort(function (a, z) { return score[z] - score[a]; });
      /* podcasts get their own tab: there are far more of them than videos and articles */
      var nbp = this.nbpFor(data.segs(this.o.ref)), hf = this.heiserFor(data.segs(this.o.ref));
      var count = function (ks) { return ids.filter(function (i) { return ks.indexOf(I[i][0]) > -1; }).length + (ks.indexOf("p") > -1 ? nbp.length : 0) + (ks.indexOf("h") > -1 ? hf.length : 0); };
      var TABS = [["watch", "Videos & articles", ["v", "a", "g"]], ["pod", "Podcasts", ["p"]], ["heiser", "Heiser", ["h"]]];
      /* a tab with nothing in it isn't the one to open on */
      var tab = TABS.filter(function (t) { return t[0] === BP_TAB; })[0] || TABS[0];
      if (!count(tab[2])) tab = TABS.filter(function (t) { return count(t[2]); })[0] || TABS[0];
      if (tab[0] === "heiser" && hf.length) {
        var hopen = st.allhf, hshown = hopen ? hf : hf.slice(0, 8);
        h += '<div class="chips u-m10">' + TABS.map(function (t) { return '<button class="chip' + (tab === t ? " on" : "") + '" data-jst-bptab="' + t[0] + '">' + t[1] + " (" + count(t[2]) + ")</button>"; }).join("") + "</div>";
        h += '<div class="lbl">Michael S. Heiser Foundation (' + hf.length + ")</div>" + box("witness", "", '<div class="item">' + hshown.map(function (a) {
          return '<p class="u-m8">' + outlink(a.u, esc(a.t)) + '<br><span class="u-fs15">' + esc(new Date(a.d + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })) + "</span></p>"; }).join("") + "</div>") +
          (hf.length > 8 ? '<div class="askrow"><button class="btn" data-jst-bpall="hf">' + (hopen ? "Fewer" : "All " + hf.length) + "</button></div>" : "");
        h += '<p class="ctx u-fs13">From <a href="https://michaelsheiserfoundation.org/articles/" target="_blank" rel="noopener">michaelsheiserfoundation.org</a>: articles that cite these chapters, the ones citing them most first.</p>';
        return { kick: "Media \u00B7 BibleProject, podcasts, Heiser", title: name + " " + q.c1 + (q.c2 && q.c2 !== q.c1 ? "\u2013" + q.c2 : ""), body: h };
      }
      if (ids.length || nbp.length || hf.length) h += '<div class="chips u-m10">' + TABS.map(function (t) { return '<button class="chip' + (tab === t ? " on" : "") + '" data-jst-bptab="' + t[0] + '">' + t[1] + " (" + count(t[2]) + ")</button>"; }).join("") + "</div>";
      if (tab[1] === "Podcasts" && nbp.length) {
        var nopen = st.allnbp, nshown = nopen ? nbp : nbp.slice(0, 6);
        h += '<div class="lbl">Naked Bible Podcast (' + nbp.length + ")</div>" + box("witness", "", '<div class="item">' + nshown.map(function (e) {
          return '<p class="u-m8">' + outlink(e.link, esc(e.t)) + '<br><span class="u-fs15">' + esc(new Date(e.date * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })) +
            (e.desc ? " \u00B7 " + esc(e.desc.length > 170 ? e.desc.slice(0, 170).replace(/\s+\S*$/, "") + "\u2026" : e.desc) : "") + "</span></p>"; }).join("") + "</div>") +
          (nbp.length > 6 ? '<div class="askrow"><button class="btn" data-jst-bpall="nbp">' + (nopen ? "Fewer" : "All " + nbp.length) + "</button></div>" : "");
        if (count(["p"]) > nbp.length) h += '<div class="lbl">BibleProject podcast (' + (count(["p"]) - nbp.length) + ")</div>";
      }
      tab[2].forEach(function (k) {
        var list = ids.filter(function (i) { return I[i][0] === k; }); if (!list.length) return;
        var open = st["all" + k], shown = open ? list : list.slice(0, 6);
        h += (tab[2].length > 1 ? '<div class="lbl">' + BP_KIND[k] + " (" + list.length + ")</div>" : "") + box("witness", "", '<div class="item">' + shown.map(link).join("") + "</div>") +
          (list.length > 6 ? '<div class="askrow"><button class="btn" data-jst-bpall="' + k + '">' + (open ? "Fewer" : "All " + list.length) + "</button></div>" : "");
      });
      if (ids.length && !count(tab[2])) h += none("No " + tab[1].toLowerCase() + " for " + esc(this.o.ref) + ".");
      if (!ids.length && !nbp.length && !hf.length) h += none("BibleProject has nothing filed under " + esc(this.o.ref) + " beyond the guide.");
      h += '<p class="ctx u-fs13">From <a href="https://bibleproject.com/" target="_blank" rel="noopener">bibleproject.com</a>' + (nbp.length ? ' and the <a href="https://nakedbiblepodcast.com/" target="_blank" rel="noopener">Naked Bible Podcast</a> (episode list via Podcast Index)' : "") + ', matched by the passages each one names. Strongest match first.</p>';
      return { kick: "Media \u00B7 BibleProject, podcasts, Heiser", title: name + " " + q.c1 + (q.c2 && q.c2 !== q.c1 ? "\u2013" + q.c2 : ""), body: h };
    },
    destroy: function () { if (this._csp) document.removeEventListener("securitypolicyviolation", this._csp); Panel.prototype.destroy.call(this); },
    click: function (e) {
      var pl = e.target.closest("[data-jst-lsbplay]");
      if (pl) {
        e.stopPropagation(); var w = pl.closest("[data-jst-lsb]"), slot = w.querySelector("[data-jst-lsbslot]"), f = document.createElement("iframe");
        f.src = pl.getAttribute("data-src"); f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true;
        f.className = "jst-player";
        /* if this host turns out to block the frame after all, fall back to the YouTube link */
        var no = function (ev) { if (String(ev.blockedURI).indexOf("youtube") > -1) { document.removeEventListener("securitypolicyviolation", no); BP_EMBED = false; slot.innerHTML = outlink(pl.getAttribute("data-url"), "Open on YouTube"); } };
        if (this._csp) document.removeEventListener("securitypolicyviolation", this._csp);   // one listener, not one per play
        this._csp = no; document.addEventListener("securitypolicyviolation", no);
        w.querySelectorAll("[data-jst-lsbplay]").forEach(function (b) { b.classList.toggle("on", b === pl); });
        if (pl.classList.contains("btn")) pl.remove();
        slot.innerHTML = ""; slot.appendChild(f); return;
      }
      var tb = e.target.closest("[data-jst-bptab]");
      if (tb) { e.stopPropagation(); BP_TAB = tb.getAttribute("data-jst-bptab"); this.el.scrollTop = 0; this.paint(); return; }
      var al = e.target.closest("[data-jst-bpall]");
      if (al) { e.stopPropagation(); var k = "all" + al.getAttribute("data-jst-bpall"); this.st[k] = !this.st[k]; this.paint(); }
    }
  });

  /* Church Fathers: what early Christian writers said about each verse, oldest first, an excerpt each with a link to the
     whole comment on historicalchristian.faith (the source of the data). Grouped by verse; four per verse until "All". */
  define("Fathers", { id: "fathers", label: "Fathers", name: "Church Fathers on this passage", icon: '<svg viewBox="0 0 24 24"><path d="M12 3v6M9 6h6"/><path d="M6 21v-7a6 6 0 0 1 12 0v7"/><path d="M4 21h16"/></svg>' }, {
    prepare: function () { var self = this; return data.fathers(this.o.ref).then(function (f) { self.f = f; }); },
    view: function () {
      var st = this.st, all = this.f || [], groups = {}, order = [];
      all.forEach(function (f) { var k = f.book + "|" + f.c + "|" + f.v1 + "|" + f.v2; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(f); });
      var where = function (f) { var one = (R.book(f.book) || {}).chapters === 1; return f.book + " " + (one ? "" : f.c + ":") + f.v1 + (f.v2 !== f.v1 ? "-" + f.v2 : ""); };
      var url = function (f) { return "https://historicalchristian.faith/" + bookRow(f.book).il + "/" + f.c + "/" + f.v1; };
      var h = all.length ? "" : none("No Church Fathers comment on " + esc(this.o.ref) + " in the collection.");
      order.forEach(function (k) {
        var list = groups[k], open = st["all" + k], shown = open ? list : list.slice(0, 4), f0 = list[0];
        h += '<div class="lbl">' + esc(where(f0)) + " (" + list.length + ")</div>" + shown.map(function (f) {
          return box("witness", "", '<div class="item"><span class="tt u-fs17">' + esc(f.by) + "</span>" + (f.year ? '<span class="sub">c. ' + (f.year < 0 ? -f.year + " BC" : "AD " + f.year) + "</span>" : "") +
            '<p class="u-m6">' + esc(f.text) + "</p>" + outlink(url(f), "Read it") + "</div>");
        }).join("") + (list.length > 4 ? '<div class="askrow"><button class="btn" data-jst-fall="' + esc(k) + '">' + (open ? "Fewer" : "All " + list.length) + "</button></div>" : "");
      });
      h += '<p class="ctx u-fs13">From the <a href="https://historicalchristian.faith/" target="_blank" rel="noopener">Historical Christian Faith</a> commentaries database (early Christian writers, public domain). Each is an excerpt; Read it opens the whole comment.</p>';
      return { kick: "Church Fathers \u00B7 " + all.length, title: "The Fathers on " + this.o.ref, body: h };
    },
    click: function (e) {
      var al = e.target.closest("[data-jst-fall]");
      if (al) { e.stopPropagation(); var k = "all" + al.getAttribute("data-jst-fall"), keep = this.el.scrollTop; this.st[k] = !this.st[k]; this.paint(); this.el.scrollTop = keep; }
    }
  });

  /* Targum: the Aramaic paraphrases read in the synagogue (Onkelos, Pseudo-Jonathan, Targum Jonathan on the Prophets), in
     English, verse by verse under the reader's own version, so the interpretive moves show ("the sons of the rulers" in Gen 6:2). */
  define("Targum", { id: "targum", label: "Targum", name: "The Targums on this passage", icon: '<svg viewBox="0 0 24 24"><path d="M5 4h9a5 5 0 0 1 5 5v11H10a5 5 0 0 1-5-5z"/><path d="M9 9h6M9 13h6"/></svg>' }, {
    prepare: function () { var self = this; return Promise.all([data.targum(this.o.ref), data.text(this.o.ref)]).then(function (r) { self.tg = r[0]; self.tx = r[1] || []; }); },
    view: function () {
      var tg = this.tg || { rows: [], src: {} }, ver = this.o.version || "LSB", tx = {}, one = function (b) { return (R.book(b) || {}).chapters === 1; };
      (this.tx || []).forEach(function (x) { tx[x.c + ":" + x.v] = String(x.texts[ver] || x.texts.NET || "").replace(/<[^>]+>/g, "").replace(/\[\/?w:?\w*\]/g, ""); });
      if (!tg.rows.length) return { kick: "Targum", title: this.o.ref, body: none("No English Targum for " + esc(this.o.ref) + ". The Torah, 1 and 2 Samuel and Isaiah are complete; other books are partial, and the Writings have none in English.") };
      var h = tg.rows.map(function (r) {
        var bib = tx[r.c + ":" + r.v];
        return '<div class="lbl">' + esc(r.book + " " + (one(r.book) ? "" : r.c + ":") + r.v) + "</div>" +
          (bib ? box("scripture", "", '<div class="item"><span class="sub">' + esc(ver) + '</span><p class="u-m4">' + esc(bib) + "</p></div>") : "") +
          r.items.map(function (it) { return box("witness", "", '<div class="item"><span class="tt u-fs16">' + esc(it[0]) + '</span><p class="u-m4">' + esc(it[1]) + "</p></div>"); }).join("");
      }).join("");
      h += '<p class="ctx u-fs13">From <a href="https://www.sefaria.org/texts/Tanakh/Targum" target="_blank" rel="noopener">Sefaria</a>. ' +
        Object.keys(tg.src).map(function (k) { return esc(k) + ": " + esc(tg.src[k]); }).join(". ") + ".</p>";
      return { kick: "Targum \u00B7 " + tg.rows.length + " verses", title: "The Targums on " + this.o.ref, body: h };
    }
  }, { version: null });

  // ------------------------------------------------------------------ Discuss (X) \u2014 wraps the JaymsX component
  define("Discuss", { id: "x", label: "On X", name: "Discussion on X", icon: ICON.x }, {
    view: function () { return { kick: "Discussion on X", title: this.o.ref, body: '<div data-jst-x></div>' }; },
    after: function () {
      if (!global.JaymsX) return;
      if (this.xh) this.xh.destroy();
      var self = this, o = this.o, posts = L(this, "posts");
      this.xh = global.JaymsX.mount(this.el.querySelector("[data-jst-x]"), {
        key: o.key || slug(o.ref), label: o.ref, owner: !!o.owner, draft: o.draft != null ? o.draft : o.ref + "\n\n",
        links: o.links || posts.slice(0, 4).map(function (p) { return { title: p.title.replace(/\s*\(\d+ of \d+\)$/, ""), url: p.url }; }),
        store: o.store || global.JaymsX.stores.local(), onChange: function (t) { self.emit("thread", t); }
      });
    },
    destroy: function () { if (this.xh) this.xh.destroy(); Panel.prototype.destroy.call(this); }
  }, { owner: false, key: null, store: null, draft: null, links: null });

  // ------------------------------------------------------------------ Marks (the Hebrew & Greek mode)
  /* Where a mark's English word sits in a verse. A mark (hebrew-greek.json) names, verse by verse, the English for its Hebrew or
     Greek word and which time it occurs ("tv": {"1": [[["was"], 0], ...]}); this finds it in any version's text. Used by the page,
     to underline the word and tag it, and by the Marks panel, to show each version's words around it. */
  var MK_SMALL = /^(the|a|an|of|to|in|and|is|was|be|i|he|it)$/;
  function mkTokens(t) { return String(t || "").split(/([A-Za-z\u00C0-\u017F']+)/); }   // odd indexes are words
  function mkSame(tk, w, loose) { tk = tk.toLowerCase(); if (tk === w) return true; if (!loose || w.length < 4) return false; return tk.indexOf(w.slice(0, Math.max(4, w.length - 2))) === 0; }   // loose: created ~ create
  function mkFind(toks, s, v) {
    var hits = [];
    ((s.tv || {})[v || s.v] || []).forEach(function (t) {
      var cands = t[0], occ = t[1], done = false;
      [false, true].forEach(function (loose) {
        cands.forEach(function (c) {
          if (done) return;
          var all = c.toLowerCase().split(/\s+/), ws = all.length > 1 ? all.filter(function (w) { return !MK_SMALL.test(w); }) : all, starts = [];
          if (!ws.length) return;
          for (var i = 1; i < toks.length; i += 2) { var ok = true; for (var k = 0; k < ws.length; k++) { var tk = toks[i + 2 * k]; if (!tk || !mkSame(tk, ws[k], loose)) { ok = false; break; } } if (ok) starts.push(i); }
          if (starts.length) { var at = starts[Math.min(occ, starts.length - 1)]; for (var k2 = 0; k2 < ws.length; k2++) hits.push(at + 2 * k2); done = true; }
        });
      });
    });
    return hits.filter(function (x, i) { return hits.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
  }
  var MK_CAT = { claim: "Changes the claim", emphasis: "Changes the emphasis", cosmetic: "Cosmetic" };
  var MK_FAM = { range: "Word range", merge: "Merged senses", syntax: "Syntax", rare: "Rare word", text: "Manuscripts", drift: "English drift", hebraism: "Hebraism", aspect: "Verb aspect", article: "The article", genitive: "Genitive" };
  /* the tag in the line: the original word in English letters, short */
  function mkTag(s) { var w = (s.w || "").trim(); if (!w || w[0] === "(") return MK_FAM[s.family] || "note"; w = w.split(" (")[0]; return w.length > 26 ? w.slice(0, 24).replace(/\s+\S*$/, "") + "\u2026" : w; }
  api.marks = { tokens: mkTokens, find: mkFind, tag: mkTag, cat: MK_CAT, fam: MK_FAM };

  /* The panel for one mark: the versions cut to the words around it, then the tool's own explanation, in its own order.
     opts: mark (the mark), list (the marks shown in this chapter, in order, for ‹ ›), on.mark(id) to step. */
  define("Marks", { id: "marks", label: "Marks", name: "Hebrew and Greek marks", icon: '<svg viewBox="0 0 24 24"><path d="M4 18h16"/><path d="M7 14l3-8 3 8M8 11.5h4"/><path d="M15 6h4M17 6v8"/></svg>' }, {
    prepare: function () { var self = this; return data.text(this.o.ref).then(function (rows) { self.rows = rows || []; }); },
    view: function () {
      var s = this.o.mark, list = this.o.list || [], st = this.st;
      if (!s) return { kick: "Marks", title: "Hebrew and Greek", body: none("Tap an underlined word or a tag in the text.") };
      var i = list.indexOf(s.id), row = (this.rows || []).filter(function (r) { return r.v === s.v; })[0], vers = ["LSB", "ESV", "NET", "NLT", "KJV"];
      var clean = function (t) { return String(t || "").replace(/\[w:\w+\]|\[\/w\]/g, "").replace(/<[^>]+>/g, ""); };
      var clause = function (text) {
        var toks = mkTokens(clean(text)), at = mkFind(toks, s, s.v), m = function (t, j) { return at.indexOf(j) > -1 ? "<mark>" + esc(t) + "</mark>" : esc(t); };
        if (!at.length || st.full) return toks.map(m).join("");
        var lo = Math.max(0, at[0] - 12), hi = Math.min(toks.length, at[at.length - 1] + 13);
        return (lo > 0 ? "\u2026 " : "") + toks.slice(lo, hi).map(function (t, j) { return m(t, lo + j); }).join("") + (hi < toks.length ? " \u2026" : "");
      };
      var para = function (t) { return t ? String(t).split(/\n\n+/).map(function (p) { return "<p>" + md(p) + "</p>"; }).join("") : ""; };
      var part = function (v, title, body) { return body ? box(v, title, body) : ""; };
      var h = '<div class="vpick chnav"><button class="sz" data-jst-mark="-1"' + (i <= 0 ? " disabled" : "") + ' aria-label="Previous mark">\u2039</button><button class="sz" data-jst-mark="1"' + (i >= list.length - 1 ? " disabled" : "") + ' aria-label="Next mark">\u203A</button></div>';
      h += box("explain", "", "<p>" + esc(s.summary) + "</p>" + (s.w ? '<p class="lbl u-mt6">' + esc(s.w) + " \u00B7 " + esc(MK_FAM[s.family] || "") + " \u00B7 " + esc(s.lang || "") + "</p>" : ""));
      if (row) h += box("scripture", "The versions", vers.filter(function (v) { return row.texts[v]; }).map(function (v) { return '<p class="u-m5"><span class="lbl">' + v + '</span> <span class="mkclause">' + clause(row.texts[v]) + "</span></p>"; }).join("") +
        '<button class="sz" data-jst-full>' + (st.full ? "Just the words around it" : "Whole verse") + "</button>");
      h += part("plain", "First, in plain English", para(s.plain)) + part("witness", "What you are seeing", para(s.seeing)) + part("open", "Why translators split", para(s.why)) +
        part("explain", "The rule to carry away", para(s.rule)) + part("explain", "Why this verse", para(s.whyThis)) +
        part("scripture", "King James", s.kjv ? "<p>" + md(s.kjv) + "</p>" + (s.kjvWhy ? para(s.kjvWhy) : "") : "") + part("wording", "How the others read it", para(s.others)) + part("open", "Choosing between them", para(s.choosing));
      h += '<p class="ctx u-fs13">From <a href="https://jayms.com/bible-study-tools-2/bible-translation-differences/" target="_blank" rel="noopener">Hebrew and Greek Without Learning Either</a> on jayms.com.</p>';
      return { kick: "Mark " + (i + 1) + " of " + list.length + " \u00B7 " + (MK_CAT[s.category] || ""), title: this.o.ref.split(" ")[0] === "Psalm" ? "Psalm " + s.c + ":" + s.v + " \u00B7 " + mkTag(s) : s.title.replace(/[a-z]$/, "").split(",")[0].replace(/(\d+:\d+)[a-z]/, "$1") + " \u00B7 " + mkTag(s), body: h };
    },
    click: function (e) {
      var st = e.target.closest("[data-jst-mark]"), list = this.o.list || [];
      if (st) { e.stopPropagation(); var n = list[list.indexOf(this.o.mark.id) + Number(st.getAttribute("data-jst-mark"))]; if (n) this.emit("mark", n); return; }
      if (e.target.closest("[data-jst-full]")) { e.stopPropagation(); this.st.full = !this.st.full; this.paint(); return; }
      Panel.prototype.click.call(this, e);
    }
  }, { mark: null, list: [] }, function () { return null; });

  global.JaymsStudy = api;
})(window);
