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
              chunks: !!global.JAYMS_PUBLIC || !!(global.JAYMS_SETTINGS && global.JAYMS_SETTINGS.chunks),   // a downloaded copy reads the site's pieces too
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
  var TOOL = { council: "divine-council-index", gods: "gods-of-the-bible", awp: "ancient-world-passages", awi: "ancient-world-ideas", facts: "bible-entity-explorer", words: "bible-word-study-tool",
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
    council: function () { return getLive(CFG.toolData + "divine-council.json").then(function (D) {
      var grp = {}; (D.filters || []).forEach(function (f) { if (f.field === "group") (f.options || []).forEach(function (o) { grp[o.k] = o.n; }); });
      var CAT = { explicit: "Explicit", implied: "Implied", contested: "Contested" };
      (D.entries || []).forEach(function (e) {
        LV.shared.council[e.id] = { title: e.title, cat: CAT[e.category] || "", group: grp[e.group] || "", summary: plain(e.summary), plain: e.plain || "", prob: plain(e.prob), res: plain(e.res), related: e.related || [] };
        R.parse(e.bibleRef || e.title).forEach(function (s) { lvPut("council", s, [e.id].concat(rng(s))); });
      });
    }); },
    gods: function () { return getLive(CFG.toolData + "gods-of-the-bible.json").then(function (D) {
      (D.entries || []).forEach(function (e) {
        LV.shared.gods[e.id] = { title: e.title, summary: plain(e.summary), plain: e.plain || "" };
        var seen = {};
        [e.bibleRef || ""].concat(e.refs || []).forEach(function (r) { R.parse(r).forEach(function (s) { var k = s.book + rng(s).join(","); if (!seen[k]) { seen[k] = 1; lvPut("gods", s, [e.id].concat(rng(s))); } }); });
      });
    }); },
    facts: function () { return getLive(CFG.toolData + "fact-book.json").then(function (D) {
      var card = D.card || {}, lab = card.labelField || "title", main = card.mainField || "summary";
      (D.entries || []).forEach(function (e) {
        var refs = e.refs || []; if (typeof refs === "string") refs = [refs];
        var st = splitTitle(e[lab] || e.title), books = {};
        refs.forEach(function (r) { R.parse(r).forEach(function (s) { lvPut("facts", s, [e.id].concat(rng(s))); books[s.book] = 1; }); });
        Object.keys(books).forEach(function (b) { (LV.facts[b] = LV.facts[b] || {})[e.id] = { title: st.name, about: st.about, kind: String(e.kind || "").replace(/^./, function (c) { return c.toUpperCase(); }), note: plain(e[main] || e.dictNote) }; });
      });
    }); },
    words: function () { return getLive(CFG.toolData + "word-study.json").then(function (D) {
      var by = {}; (D.entries || []).forEach(function (e) { by[String(e.strong).toUpperCase()] = e; });
      LV.ws = by;
      Object.keys(by).forEach(function (k) { var e = by[k];
        WORDS[k.toLowerCase()] = Object.assign(WORDS[k.toLowerCase()] || {}, { k: k.toLowerCase(), t: wordName(k, e.title), s: e.strong, gloss: e.gloss || "", count: (e.count || 0).toLocaleString("en-US"), def: e.def || "", spread: e.spread || "" }); });
    }); },
    diffs: function () { return getLive(CFG.toolData + "translation-differences.json").then(function (D) {
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
  var CORE = {}, CORE_IDS = {};            // the core stack (shelf.json core): by book, always shown, never hidden
  var SHELF_TAB = "com";                  // the Shelf tab James last picked: com | sb | other
  var XREFN = {}, NOTEN = {};
  var NOTE_SRC = {
    T: { code: "T", name: "Tyndale Open Study Notes", short: "Tyndale", url: "https://tyndaleopenresources.com/", licence: "CC BY-SA 4.0" },
    B: { code: "B", name: "Biblica Study Notes", short: "Biblica", url: "https://github.com/BibleAquifer/BiblicaStudyNotes", licence: "CC BY-SA 4.0" },
    N: { code: "N", name: "NET Bible notes", short: "NET", url: "https://netbible.org/", licence: "Biblical Studies Press" },
    /* James's own Logos book, on his desk only: fsb/<book>.json (scripts/build-fsb.py from his BOOKS vault) never reaches the site */
    F: { code: "F", name: "Faithlife Study Bible", short: "Faithlife", url: "logosres:FSB", licence: "in your Logos library", own: true }
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
    counts: function () { return Promise.all([data.names(), data.places(), data.maps().catch(function () {}), data.dss().catch(function () {}),
      getJSON("art-refs.json").then(function (d) { ARTREFS = d || []; }).catch(function () { ARTREFS = []; }),
      getJSON("relics.json").then(function (d) { RELREFS = ((d && d.relics) || []).map(function (x) { return x.refs; }); }).catch(function () { RELREFS = []; }),
      data.ancient()]); },
    /* The Ancient World Behind the Text (jayms.com tools, read live like the Council and Gods): its passages and its ideas */
    ancient: function () {
      return cache.__aw || (cache.__aw = Promise.all([getLive(CFG.toolData + "ancient-world-passages.json"), getLive(CFG.toolData + "ancient-world-ideas.json")]).then(function (r) {
        AWP = (r[0] && r[0].entries) || []; AWI = {}; ((r[1] && r[1].entries) || []).forEach(function (e) { AWI[e.id] = e; }); return true;
      }).catch(function () { AWP = AWP || []; AWI = AWI || {}; cache.__aw = null; return false; }));
    },
    bibleproject: function () { return getJSON("bibleproject.json"); },
    lsbAudio: function () { return getJSON("lsb-audio.json"); },
    /* Michael S. Heiser Foundation articles by the chapters they cite (scripts/fetch-heiser.py) */
    /* STEPBible's people and places (scripts/build-names.py): family lines and map positions for the Fact Book panel */
    names: function () { return getJSON("names.json").then(function (d) { NAMESD = d; return d; }).catch(function () { return null; }); },
    places: function () { return getJSON("places.json").then(function (d) { PLACESD = d; return d; }).catch(function () { return null; }); },   // the shared place list (scripts/build-places.py)
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
    shelf: function () { return getJSON("shelf.json").then(function (d) { CORE = (d && d.core) || {}; CORE_IDS = {}; Object.keys(CORE).forEach(function (b) { CORE[b].forEach(function (x) { CORE_IDS[x.id] = 1; }); }); return (SHELF = (d && d.books) || {}); }); },
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
      var own = !global.JAYMS_PUBLIC;   // the Faithlife Study Bible's notes: James's desk only
      /* the NET's translators' notes for everyone (netnotes/<book>.json, scripts/fetch-net-notes.py) */
      return Promise.all(books.map(function (b) { return Promise.all([bookFile("study", b, segs), bookFile("netnotes", b, segs).catch(function () { return null; }), own ? bookFile("fsb", b, segs).catch(function () { return null; }) : null]); })).then(function (sets) {
        var files = sets.map(function (p) { return { n: [].concat.apply([], p.map(function (x) { return (x && x.n) || []; })) }; });
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

  // ------------------------------------------------------------------ Ancient world
  /* The Ancient World Behind the Text: the tool's notes on the passage being read (what a first reader knew without being told),
     each with the ideas behind it. Tap an idea for its card: what it meant then, the bridge to today, where the analogy breaks. */
  function awFor(ref) { return (AWP || []).filter(function (e) { return e.bibleRef && refsHit([e.bibleRef], ref); }); }
  define("Ancient", { id: "ancient", label: "Ancient", name: "The ancient world behind the text", icon: '<svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M3 10h18L12 3z"/></svg>' }, {
    prepare: function () { return data.ancient(); },
    view: function () {
      var st = this.st, kick = "The Ancient World Behind the Text";
      if (st.idea && AWI[st.idea]) {
        var e = AWI[st.idea], f = function (k, v, t) { return e[k] ? box(v, t, "<p>" + md(e[k]) + "</p>") : ""; };
        var h = '<button class="btn u-mb10" data-jst-awback>Back</button><div class="item"><span class="sub">' + esc(e.summary) + "</span></div>";   // the title is the panel's own
        h += (e.plain ? '<div class="box plain"><p class="u-m0">' + md(e.plain) + "</p></div>" : "") + f("then", "explain", "What it meant then") + f("bridge", "witness", "The bridge to today") +
             f("changes", "explain", "What it changes in the reading") + f("not", "not", "Where the analogy breaks") + f("dissent", "open", "Where scholars disagree");
        return { kick: kick, title: e.title, body: h + outlink(entryURL("awi", e.id), "Full entry") };
      }
      var list = awFor(this.o.ref);
      if (!list.length) return { kick: kick, title: "The world behind this passage", body: none("The Ancient World tool has no note on " + esc(this.o.ref) + " yet. It covers the New Testament.") + outlink(CFG.site + TOOL.awp + "/", "Open the tool") };
      var h = list.map(function (e) {
        var ideas = (e._ideas || []).filter(function (id) { return AWI[id]; });
        return '<div class="item u-mt14"><span class="when">' + esc(e.bibleRef) + '</span><span class="tt">' + esc(e.title.replace(/^[^,]*,\s*/, "")) + '</span><span class="sub">' + esc(e.summary) + "</span></div>" +
          (e.plain ? '<div class="box plain"><h3>What is going on here</h3><p class="u-m0">' + md(e.plain) + "</p></div>" : "") +
          (ideas.length ? '<div class="lbl">The ancient world behind it</div><div class="chips u-mb10">' + ideas.map(function (id) { return '<button class="chip" data-jst-awi="' + esc(id) + '">' + esc(AWI[id].title) + "</button>"; }).join("") + "</div>" : "") +
          (e.note ? '<details class="jst-past"><summary class="lbl">Also in this passage</summary>' + box("explain", "", "<p>" + md(e.note) + "</p>") + "</details>" : "") +
          outlink(entryURL("awp", e.id), "Full entry");
      }).join("");
      return { kick: kick + " \u00B7 " + list.length + " for this passage", title: "The world behind this passage", body: h };
    },
    click: function (e) {
      var i = e.target.closest("[data-jst-awi]"), b = e.target.closest("[data-jst-awback]");
      if (i) { e.stopPropagation(); this.st.idea = i.getAttribute("data-jst-awi"); this.el.scrollTop = 0; this.paint(); return; }
      if (b) { e.stopPropagation(); this.st.idea = null; this.paint(); return; }
      Panel.prototype.click.call(this, e);
    }
  }, {}, function (d) { return d && AWP ? awFor(d.ref).length : null; });

  // ------------------------------------------------------------------ Fact Book
  /* STEPBible's records for the people and places named in the passage, in the order they first appear */
  var NAMESD = null, PLACESD = null, DSSD = null, ARTREFS = null, RELREFS = null, AWP = null, AWI = null;   // loaded by data.counts(), so the dock buttons can count without opening their panels
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
  /* the places a passage names, from the shared place list's verse index: [{id, n, ll, tier, s, alt, ...}] in order of first mention.
     n drops OpenBible's disambiguating number ("Bethel 1" -> "Bethel"). */
  function placesIn(pd, ref) {
    if (!pd) return [];
    var out = [], seen = {};
    data.segs(ref).forEach(function (q) {
      for (var c = q.c1; c <= (q.c2 || q.c1); c++) (((pd.ix[q.book] || {})[c]) || []).forEach(function (row) {
        var lo = c === q.c1 ? q.v1 : 1, hi = c === (q.c2 || q.c1) ? q.v2 : 999;
        if (!row.slice(1).some(function (v) { return v >= lo && v <= hi; }) || seen[row[0]]) return;
        seen[row[0]] = 1; var p = pd.places[row[0]]; if (p) out.push(Object.assign({ id: row[0] }, p, { n: p.n.replace(/\s+\d+$/, "") }));
      });
    });
    return out;
  }
  api.placesIn = function (ref) { return data.places().then(function (pd) { return placesIn(pd, ref); }); };
  var TIER = { secure: "Secure identification", likely: "Likely identification", contested: "Contested identification", unlocated: "No proposed site",
    area: "Exact spot unknown", region: "Region" };   // area: known only as in or near somewhere (a gate "in Jerusalem"); region: the pin marks the middle
  function tierNote(p) { return p.tier === "area" ? '<p class="u-fs14 u-m4-8">Known only as ' + esc(p.near || "in this area") + '; the pin marks that, not the spot.</p>' : p.tier === "region" ? '<p class="u-fs14 u-m4-8">A land or region; the pin marks its middle.</p>' : ""; }
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
  }, { slug: "fact-book" }, function (d) {   // entries plus the people and places named; unknown (null) until names.json is in
    if (!d) return null; var f = (d.facts || []).length;
    return NAMESD ? f + namesIn(NAMESD, d.ref).length : (f || null); });

  // ------------------------------------------------------------------ Maps
  /* A drawn atlas: Natural Earth coastlines, lakes and rivers (atlas.json, scripts/build-atlas.py) on parchment, so it needs no
     outside tiles and draws the same on the desk, claude.ai and the site. Tabs: the places named in this passage (STEPBible's
     positions, gold marks), and the journeys the text narrates (Abraham, the Exodus, Paul's three journeys and his voyage, the
     seven churches), each stop numbered with the verse that names it. The journey whose chapters you are reading opens first.
     Below: each place's Biblica maps and the passage's own Biblica maps. atlasMount() is the map on its own, for any panel. */
  var SVGNS = "http://www.w3.org/2000/svg";
  function atlasSVG(host, A, o) {   // the drawn map: the fallback where MapLibre can't run
    /* o: {marks: [{x, y, n, k: "place"|"stop", num, color, i}], legs: [{x1, y1, x2, y2, m: "land"|"sea"}], color, onPick(i)} */
    var svg = document.createElementNS(SVGNS, "svg"), vb = { x: 0, y: 0, w: A.w, h: A.h }, marks = [], labs = [], self = {};
    svg.setAttribute("class", "jst-atlas-svg"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", o.label || "Map");
    var defs = '<defs><marker id="jst-ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M1 1L9 5L1 9z" fill="' + (o.color || "#7a2e2e") + '"/></marker></defs>';
    var h = defs + '<rect class="sea" x="-4000" y="-4000" width="' + (A.w + 8000) + '" height="' + (A.h + 8000) + '"/>' +
      '<path class="land" d="' + A.land + '"/><path class="lake" d="' + A.lakes + '"/><path class="river" d="' + A.rivers + '"/><g class="labs"></g><g class="legs"></g><g class="marks"></g>';
    svg.innerHTML = h; host.appendChild(svg);
    var gL = svg.querySelector(".labs"), gLegs = svg.querySelector(".legs"), gM = svg.querySelector(".marks");
    A.labels.forEach(function (l) {
      var t = document.createElementNS(SVGNS, "text"); t.setAttribute("class", "lab " + l[3]); t.setAttribute("x", l[1]); t.setAttribute("y", l[2]);
      t.textContent = l[0]; t._z = l[4]; gL.appendChild(t); labs.push(t); });
    (o.legs || []).forEach(function (g, i) {
      var p = document.createElementNS(SVGNS, "path"), mx = (g.x1 + g.x2) / 2, my = (g.y1 + g.y2) / 2;
      p.setAttribute("d", "M" + g.x1 + " " + g.y1 + "L" + mx + " " + my + "L" + g.x2 + " " + g.y2);
      p.setAttribute("class", "leg by-" + g.m); p.setAttribute("stroke", o.color || "#7a2e2e"); p.setAttribute("marker-mid", "url(#jst-ar)"); p._i = g.i || i + 1;
      gLegs.appendChild(p); });
    /* stops that come back to the same spot sit beside the earlier mark, not on top of it */
    var at = {}, many = {};
    (o.marks || []).forEach(function (m) { var key = Math.round(m.x) + "," + Math.round(m.y); many[key] = (many[key] || 0) + 1; });
    (o.marks || []).forEach(function (m) {
      var key = Math.round(m.x) + "," + Math.round(m.y), nth = at[key] = (at[key] || 0) + 1;
      var g = document.createElementNS(SVGNS, "g"); g.setAttribute("class", "amk " + m.k + (m.tier ? " tier-" + m.tier : "")); g.setAttribute("data-i", m.i); g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button"); g.setAttribute("aria-label", (m.num ? m.num + ". " : "") + m.n);
      var dx = (nth - 1) * 17, r = m.k === "stop" ? 9 : 6;
      g.innerHTML = '<circle cx="' + dx + '" cy="0" r="' + r + '"' + (m.k === "stop" ? ' fill="' + (o.color || "#7a2e2e") + '"' : "") + "/>" +
        (m.num ? '<text class="num" x="' + dx + '" y="3.6">' + m.num + "</text>" : "") +
        (nth === 1 ? '<text class="nm" x="' + (r + 4 + (many[key] - 1) * 17) + '" y="4">' + esc(m.n) + "</text>" : "");
      g._x = m.x; g._y = m.y; g._i = m.i; g._dx = dx; gM.appendChild(g); marks.push(g); });

    function px() { return vb.w / Math.max(1, host.clientWidth); }   // map units per screen pixel
    function draw() {
      var s = px(), level = Math.log2(A.w / vb.w) + 1;
      svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h);
      svg.style.setProperty("--s", s);
      gL.setAttribute("font-size", 12 * s);
      labs.forEach(function (t) { t.style.display = level >= t._z ? "" : "none"; });
      gLegs.setAttribute("stroke-width", 2.6 * s);
      gLegs.querySelectorAll(".by-land").forEach(function (p) { p.setAttribute("stroke-dasharray", 7 * s + " " + 5 * s); });
      svg.querySelector(".land").setAttribute("stroke-width", .9 * s);
      svg.querySelector(".lake").setAttribute("stroke-width", .7 * s);
      svg.querySelector(".river").setAttribute("stroke-width", 1.1 * s);
      marks.forEach(function (g) { g.setAttribute("transform", "translate(" + g._x + " " + g._y + ") scale(" + s + ")"); });
      /* a name shows only where it has room; the picked mark's name always shows, the rest come back as you zoom in */
      var boxes = [];
      marks.forEach(function (g) { g._sx = (g._x - vb.x) / s; g._sy = (g._y - vb.y) / s; if (g.style.display !== "none") boxes.push([g._sx - 10, g._sy - 10, g._sx + 10 + (g._dx || 0), g._sy + 10, g]); });
      marks.slice().sort(function (a, b) { return (b.classList.contains("on") ? 1 : 0) - (a.classList.contains("on") ? 1 : 0); }).forEach(function (g) {
        var t = g.querySelector(".nm"); if (!t || g.style.display === "none") return;
        var nx = +t.getAttribute("x"), bx = [g._sx + nx - 2, g._sy - 9, g._sx + nx + 4 + t.textContent.length * 7.4, g._sy + 9];
        var hit = boxes.some(function (o) { return (!o[4] || o[4]._x !== g._x || o[4]._y !== g._y) && bx[0] < o[2] && o[0] < bx[2] && bx[1] < o[3] && o[1] < bx[3]; });
        t.style.display = hit && !g.classList.contains("on") ? "none" : ""; if (!hit || g.classList.contains("on")) boxes.push(bx); });
    }
    /* keep the box the shape of the frame, and inside the map */
    function shape(cx, cy, w) {
      var asp = Math.max(.2, host.clientHeight / Math.max(1, host.clientWidth));
      w = Math.min(A.w, A.h / asp, Math.max(A.w / 300, w)); var hh = w * asp;   // never wider or taller than the drawn map
      cx = Math.min(A.w - w / 2, Math.max(w / 2, cx)); cy = Math.min(A.h - hh / 2, Math.max(hh / 2, cy));   // and never past its edge
      vb = { x: cx - w / 2, y: cy - hh / 2, w: w, h: hh };
    }
    var anim = null;
    function go(cx, cy, w, ms) {
      if (anim) cancelAnimationFrame(anim);
      var a = { cx: vb.x + vb.w / 2, cy: vb.y + vb.h / 2, w: vb.w }, t0 = 0;
      if (!ms || document.hidden) { shape(cx, cy, w); draw(); return; }
      function step(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        shape(a.cx + (cx - a.cx) * e, a.cy + (cy - a.cy) * e, Math.exp(Math.log(a.w) + (Math.log(w) - Math.log(a.w)) * e)); draw();
        if (k < 1) anim = requestAnimationFrame(step); }
      anim = requestAnimationFrame(step);
    }
    self.fit = function (pts, ms, minW) {
      if (!pts || !pts.length) { go(A.w * .55, A.h * .5, A.w * .9, ms); return; }
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
      var cw = Math.max(1, host.clientWidth), asp = host.clientHeight / cw, w = Math.max(x1 - x0, (y1 - y0) / asp, 90) * 1.3 + 40;
      if (minW) w = Math.max(w, minW);
      w *= cw / Math.max(1, cw - 56);   // keep the marks clear of the zoom buttons on the right
      go((x0 + x1) / 2 + 28 * w / cw, (y0 + y1) / 2, w, ms);
    };
    self.zoom = function (f, cx, cy) {
      cx = cx == null ? vb.x + vb.w / 2 : cx; cy = cy == null ? vb.y + vb.h / 2 : cy;
      var w = vb.w / f, k = w / vb.w;   // keep the point under the cursor still
      go(cx + (vb.x + vb.w / 2 - cx) * k, cy + (vb.y + vb.h / 2 - cy) * k, w, 180);
    };
    /* show only the first n legs and stops (Play), or all (n = null) */
    self.upTo = function (n) {
      gLegs.querySelectorAll(".leg").forEach(function (p) { p.style.display = n == null || p._i < n ? "" : "none"; });
      marks.forEach(function (g) { g.style.display = n == null || g._i <= n ? "" : "none"; }); draw();
    };
    self.pick = function (i) { marks.forEach(function (g) { g.classList.toggle("on", g._i === i); }); draw(); };
    self.resize = function () { shape(vb.x + vb.w / 2, vb.y + vb.h / 2, vb.w); draw(); };
    function unit(e) { var r = svg.getBoundingClientRect(); return { x: vb.x + (e.clientX - r.left) * px(), y: vb.y + (e.clientY - r.top) * px() }; }

    /* drag to move, two fingers to pinch, Ctrl/Cmd + wheel to zoom (a plain wheel scrolls the panel) */
    var ptr = {}, last = null, moved = 0;
    svg.addEventListener("pointerdown", function (e) { ptr[e.pointerId] = { x: e.clientX, y: e.clientY }; moved = 0; last = null; });
    svg.addEventListener("pointermove", function (e) {
      if (!ptr[e.pointerId]) return;
      var ids = Object.keys(ptr), p = ptr[e.pointerId], dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (ids.length === 1) { moved += Math.abs(dx) + Math.abs(dy); if (moved > 6 && !svg.hasPointerCapture(e.pointerId)) try { svg.setPointerCapture(e.pointerId); } catch (x) {}   // capture only once it is a drag, so a tap still reaches the mark
        var s = px(); vb.x -= dx * s; vb.y -= dy * s; shape(vb.x + vb.w / 2, vb.y + vb.h / 2, vb.w); draw(); }
      ptr[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (ids.length === 2) { var a = ptr[ids[0]], b = ptr[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (last) { var m = unit({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }), k = last / d, w = vb.w * k;
          shape(m.x + (vb.x + vb.w / 2 - m.x) * k, m.y + (vb.y + vb.h / 2 - m.y) * k, w); draw(); }
        last = d; moved = 99; }
    });
    function up(e) { delete ptr[e.pointerId]; last = null; }
    svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
    svg.addEventListener("click", function (e) {
      var g = e.target.closest(".amk"); if (!g || moved > 6) return;
      e.stopPropagation(); if (o.onPick) o.onPick(+g.getAttribute("data-i"));
    });
    svg.addEventListener("keydown", function (e) { var g = e.target.closest && e.target.closest(".amk"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); if (o.onPick) o.onPick(+g.getAttribute("data-i")); } });
    svg.addEventListener("dblclick", function (e) { var u = unit(e); self.zoom(2, u.x, u.y); });
    var hintT = 0;
    svg.addEventListener("wheel", function (e) {
      if (!(e.ctrlKey || e.metaKey)) { if (o.onHint && Date.now() - hintT > 1500) { hintT = Date.now(); o.onHint(); } return; }
      e.preventDefault(); var u = unit(e), k = Math.exp(-e.deltaY * .0022), w = vb.w / k, f = w / vb.w;
      shape(u.x + (vb.x + vb.w / 2 - u.x) * f, u.y + (vb.y + vb.h / 2 - u.y) * f, w); draw();
    }, { passive: false });
    var ro = global.ResizeObserver ? new ResizeObserver(function () { self.resize(); }) : null;
    if (ro) ro.observe(host);
    function esc_(e) { if (e.key === "Escape" && host.classList.contains("jst-atlas-big")) { e.stopPropagation(); host.classList.remove("jst-atlas-big"); } }
    document.addEventListener("keydown", esc_, true);   // Escape leaves the phone's full-screen map before it closes the panel
    self.destroy = function () { if (anim) cancelAnimationFrame(anim); if (ro) ro.disconnect(); document.removeEventListener("keydown", esc_, true); svg.remove(); };
    shape(A.w / 2, A.h / 2, A.w); draw();
    return self;
  }
  /* how far and how long: straight-line km for every leg; ORBIS days for the New Testament legs it covers (scripts/travel.py) */
  function travelLine(rt) {
    var t = '<p class="u-fs15 u-m4-8 jst-atlas-travel">About ' + (rt.km || 0).toLocaleString() + " km from stop to stop in straight lines; the roads were longer. ";
    if (rt.group !== "nt") t += "No day count: ORBIS, the travel model behind the day counts, covers the Roman world around AD 200.";
    else if (rt.days) t += "<a href=\"https://orbis.stanford.edu/\" target=\"_blank\" rel=\"noopener\">ORBIS</a> puts the " + rt.legs_days + " of " + rt.legs + " legs it covers at about " + rt.days + " days of travel: 30 km a day on its roads, its own sailing times at sea. The figures leave out stays, storms and the time of year, so the real journeys took longer." + (rt.legs_days < rt.legs ? " The other legs reach places ORBIS doesn't include." : "");
    else t += "ORBIS, the travel model behind the day counts, doesn't include these towns, so there is no day count.";
    return t + "</p>";
  }
  /* Heights, read in the browser from the relief files (atlas-tiles/relief-*.pmtiles, Mapterhorn terrarium WebP tiles: metres =
     R*256 + G + B/256 - 32768). The Levant file (zoom 10, about 150 m a pixel) is used inside its box, the region file (zoom 7,
     about 1 km a pixel) everywhere else. Tiles are decoded once and kept. */
  var ELEV = { files: {}, tiles: {} };
  var LEVANT = [29.0, 33.8, 33.6, 37.2];
  function elevAt(lat, lon) {
    var lev = lat >= LEVANT[0] && lat <= LEVANT[2] && lon >= LEVANT[1] && lon <= LEVANT[3], file = lev ? "relief-levant" : "relief-region", z = lev ? 10 : 7;
    return atlasLib().then(function () {
      var pm = ELEV.files[file] || (ELEV.files[file] = new global.pmtiles.PMTiles(new URL(CFG.base + "atlas-tiles/" + file + ".pmtiles", document.baseURI).href));
      var n = Math.pow(2, z), fx = (lon + 180) / 360 * n, r = lat * Math.PI / 180, fy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
      var tx = Math.floor(fx), ty = Math.floor(fy), key = file + "/" + z + "/" + tx + "/" + ty;
      var t = ELEV.tiles[key] || (ELEV.tiles[key] = pm.getZxy(z, tx, ty).then(function (res) {
        if (!res || !res.data) return null;
        return createImageBitmap(new Blob([res.data], { type: "image/webp" })).then(function (bm) {
          var c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; var x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(bm, 0, 0);
          return { w: bm.width, h: bm.height, px: x.getImageData(0, 0, bm.width, bm.height).data };
        });
      }));
      return t.then(function (T) {
        if (!T) return null;
        var px = Math.min(T.w - 1, Math.floor((fx - tx) * T.w)), py = Math.min(T.h - 1, Math.floor((fy - ty) * T.h)), i = (py * T.w + px) * 4;
        return Math.round(T.px[i] * 256 + T.px[i + 1] + T.px[i + 2] / 256 - 32768);
      });
    });
  }
  /* a height profile along a line of points [{ll, n?, sea?}]: about 300 samples, sea legs held at sea level */
  function profileOf(pts) {
    var segs = [], total = 0;
    for (var i = 1; i < pts.length; i++) { var a = pts[i - 1].ll, b = pts[i].ll, d = atlasKm(a, b); segs.push({ a: a, b: b, d: d, sea: !!pts[i].sea, from: total }); total += d; }
    var step = Math.max(.25, total / 300), samples = [], marks = [{ k: 0, n: pts[0].n }];
    segs.forEach(function (sg, si) {
      var m = Math.max(1, Math.ceil(sg.d / step));
      for (var j = 0; j <= m; j++) { if (j === 0 && si > 0) continue; var f = j / m; samples.push({ k: sg.from + sg.d * f, ll: [sg.a[0] + (sg.b[0] - sg.a[0]) * f, sg.a[1] + (sg.b[1] - sg.a[1]) * f], sea: sg.sea && j > 0 && j < m }); }
      if (pts[si + 1].n) marks.push({ k: sg.from + sg.d, n: pts[si + 1].n });
    });
    return Promise.all(samples.map(function (p) { return p.sea ? Promise.resolve(0) : elevAt(p.ll[0], p.ll[1]); })).then(function (h) {
      samples.forEach(function (p, i) { p.h = h[i] == null ? null : Math.max(-450, h[i]); });
      return { total: total, samples: samples, marks: marks };
    });
  }
  function atlasKm(a, b) { var p1 = a[0] * Math.PI / 180, p2 = b[0] * Math.PI / 180, dp = p2 - p1, dl = (b[1] - a[1]) * Math.PI / 180;
    return 12742 * Math.asin(Math.sqrt(Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2))); }
  /* the chart: distance along, height up, sea level marked, each stop ticked; under it the highest, lowest and total climb */
  function profileSVG(P, color, width) {
    var S = P.samples.filter(function (p) { return p.h != null; }); if (S.length < 2) return "";
    var W = Math.max(300, Math.round(width || 640)), H = Math.round(Math.max(150, Math.min(220, W * .32))), L = 52, B = 24, T = 16, lo = Math.min(0, Math.min.apply(null, S.map(function (p) { return p.h; }))), hi = Math.max(50, Math.max.apply(null, S.map(function (p) { return p.h; })));   // drawn at the slot's own width so the lettering stays readable
    var X = function (k) { return L + (W - L - 8) * k / (P.total || 1); }, Y = function (h) { return T + (H - T - B) * (1 - (h - lo) / ((hi - lo) || 1)); };
    var line = S.map(function (p, i) { return (i ? "L" : "M") + X(p.k).toFixed(1) + " " + Y(p.h).toFixed(1); }).join("");
    var climb = 0, fall = 0, ref = S[0].h;   // count a rise or fall once it passes 20 m, so ripples in the height data don't pile up
    for (var i = 1; i < S.length; i++) { var d = S[i].h - ref; if (d >= 20) { climb += d; ref = S[i].h; } else if (d <= -20) { fall -= d; ref = S[i].h; } }
    var top = S.reduce(function (a, b) { return b.h > a.h ? b : a; }), bot = S.reduce(function (a, b) { return b.h < a.h ? b : a; });
    var near = function (p) { return P.marks.reduce(function (a, m) { return Math.abs(m.k - p.k) < Math.abs(a.k - p.k) ? m : a; }).n; };
    var g = '<svg class="jst-prof" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Height profile">' +
      (lo < 0 ? '<line x1="' + L + '" x2="' + (W - 8) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" class="sea0"/><text x="' + (W - 10) + '" y="' + (Y(0) - 4) + '" class="ax" text-anchor="end">sea level</text>' : "") +
      '<path d="' + line + "L" + X(S[S.length - 1].k) + " " + (H - B) + "L" + X(S[0].k) + " " + (H - B) + 'Z" class="fill" fill="' + color + '"/><path d="' + line + '" class="ln" stroke="' + color + '"/>' +
      '<text x="' + (L - 6) + '" y="' + (Y(hi) + 4) + '" class="ax" text-anchor="end">' + Math.round(hi) + ' m</text><text x="' + (L - 6) + '" y="' + (Y(lo) + 4) + '" class="ax" text-anchor="end">' + Math.round(lo) + " m</text>" +
      P.marks.map(function (m, i) { return '<line x1="' + X(m.k) + '" x2="' + X(m.k) + '" y1="' + T + '" y2="' + (H - B) + '" class="tick"/><text x="' + X(m.k) + '" y="' + (H - 6) + '" class="ax" text-anchor="' + (i === 0 ? "start" : i === P.marks.length - 1 ? "end" : "middle") + '">' + (P.marks.length > 8 ? i + 1 : esc(m.n)) + "</text>"; }).join("") + "</svg>";
    return g + '<p class="u-fs14 u-m4-8">Highest ' + Math.round(top.h).toLocaleString() + " m near " + esc(near(top)) + "; lowest " + Math.round(bot.h).toLocaleString() + " m near " + esc(near(bot)) +
      ". About " + Math.round(climb / 10) * 10 + " m of climbing and " + Math.round(fall / 10) * 10 + " m of descent along the line, " + Math.round(P.total).toLocaleString() + " km. Straight lines between the stops, so a real road's switchbacks add more; heights from Mapterhorn (Copernicus GLO-30).</p>";
  }
  function realStops(rt) { return rt.stops.filter(function (s) { return !s.via; }); }   // stops, not the unnumbered bends in the road
  function atlasXY(A, ll) { var p = A.proj; return { x: (ll[1] - p.lon0) * p.c * p.k, y: (p.lat1 - ll[0]) * p.k, ll: ll }; }

  /* The atlas on MapLibre (vendor/maplibre, kept in the repo so the desk works offline) reading map files from atlas-tiles/
     (scripts/fetch-atlas-tiles.sh): Protomaps land, sea, rivers and land cover in three detail levels (the whole region to
     zoom 8, Paul's world to 10, the Holy Land to 13), Mapterhorn relief (Copernicus GLO-30), and the modern borders as a layer
     you can switch on. Where MapLibre or the files can't load (claude.ai), atlasMount falls back to the drawn map (atlasSVG). */
  var ATLAS_GL = null;
  function atlasLib() {
    if (ATLAS_GL) return ATLAS_GL;
    var base = new URL(CFG.base + "vendor/maplibre/", document.baseURI).href;
    ATLAS_GL = new Promise(function (ok, no) {
      if (!document.querySelector("link[data-ml]")) { var css = document.createElement("link"); css.rel = "stylesheet"; css.href = base + "maplibre-gl.css"; css.setAttribute("data-ml", ""); document.head.appendChild(css); }
      var sc = document.createElement("script"); sc.src = base + "pmtiles.js"; sc.onerror = no;
      sc.onload = function () { import(base + "maplibre-gl.mjs").then(function (m) { var ml = m.default || m; ml.addProtocol("pmtiles", new global.pmtiles.Protocol().tile); ok(ml); }, no); };
      document.head.appendChild(sc);
    });
    ATLAS_GL.catch(function () { ATLAS_GL = null; });
    return ATLAS_GL;
  }
  var ATLAS_LAYERS = [["kingdoms", "Kingdoms by year", true], ["tribes", "Tribal lands, estimated (Joshua 13\u201319)", true], ["roads", "Roman roads (from 200 BC on the slider)", true], ["relief", "Mountains and valleys", true], ["cover", "Desert, farmland and forest", true], ["ancient", "Ancient names", true], ["modern", "Modern countries and cities", false], ["sites", "Ancient sites in use that year (zoom in)", true], ["tilt", "Tilt into 3D hills while a journey plays", true]];
  function atlasPrefs() { var p = {}; try { p = JSON.parse(localStorage.getItem("ws.atlasLayers") || "{}"); } catch (e) {} ATLAS_LAYERS.forEach(function (l) { if (!(l[0] in p)) p[l[0]] = l[2]; }); return p; }
  function atlasSavePrefs(p) { try { localStorage.setItem("ws.atlasLayers", JSON.stringify(p)); } catch (e) {} }

  /* kingdoms.json (scripts/build-kingdoms.py): borders by year. Year numbers: BC negative. */
  function yearLabel(y) { return y < 0 ? -y + " BC" : "AD " + y; }
  function passageYear(K, ref) {
    var q = data.segs(ref)[0]; if (!K || !q) return null;
    var row = (K.years || []).filter(function (r) { return r[0] === q.book && q.c1 >= r[1] && q.c1 <= r[2]; })[0];
    return row ? { y: row[3], note: row[4] } : null;
  }
  var KCOL = { "Kingdom of Israel": "#6f97bf", "Kingdom of Judah": "#c79a3e", "Philistia": "#9d7bb5", "Neo-Assyrian Empire": "#b0573f", "Assyria": "#b0573f",
    "Neo-Babylonian Empire": "#8f6d3a", "Babylonia": "#8f6d3a", "Achaemenid Empire": "#6c8f5a", "Roman Empire": "#8c4a6b", "Roman Republic": "#8c4a6b",
    "Judea": "#c79a3e", "New Kingdom of Egypt": "#c9844f", "Moab": "#b98a5a", "Edom": "#a35d4a", "Ammon": "#7d9a6b", "Aram-Damascus": "#5f8b8f" };
  var KPAL = ["#c98b6b", "#8fae7e", "#b79bc9", "#7fa6c2", "#d4b26a", "#c27a8e", "#86b3a8", "#a99a72", "#b5866a", "#8d9fd1"];
  function kColor(n) { if (KCOL[n]) return KCOL[n]; var h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return KPAL[h % KPAL.length]; }
  function chgFC(A) { return { type: "FeatureCollection", features: (A.changes || []).map(function (c) { return { type: "Feature", geometry: { type: "Point", coordinates: [c[3], c[2]] }, properties: { n: c[0], x: c[4], src: c[5] } }; }) }; }
  var EOX_ATTR = 'Satellite: <a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless 2016 by EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2016 &amp; 2017)';
  function atlasGL(ml, host, A, o) {
    var self = { gl: true }, abs = function (p) { return new URL(CFG.base + p, document.baseURI)   /* baseURI: on jayms.com the page carries a <base> to GitHub Pages, where the map files are */.href; }, prefs = atlasPrefs();
    var holder = document.createElement("div"); holder.className = "jst-atlas-gl"; host.insertBefore(holder, host.firstChild);
    var SEA = "#b7cdd1", LAND = "#efe5c9", INK = "#2b2418";
    function base(src, minz, maxz) {
      var z = function (l) { if (minz) l.minzoom = minz; if (maxz) l.maxzoom = maxz; return l; };
      return [
        z({ id: src + "-earth", type: "fill", source: src, "source-layer": "earth", paint: { "fill-color": LAND } }),
        z({ id: src + "-cover", type: "fill", source: src, "source-layer": "landcover", metadata: { layer: "cover" },
          paint: { "fill-color": ["match", ["get", "kind"], "forest", "#cdd3a4", "grassland", "#dfdcb2", "scrub", "#e3d9b0", "farmland", "#e1dcb5", "barren", "#f3e4bf", "glacier", "#fbfbf6", "#efe5c9"], "fill-opacity": .75 } }),
        z({ id: src + "-water", type: "fill", source: src, "source-layer": "water", filter: ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]], paint: { "fill-color": SEA } }),
        z({ id: src + "-coast", type: "line", source: src, "source-layer": "water", filter: ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]], paint: { "line-color": "#8a7650", "line-width": ["interpolate", ["linear"], ["zoom"], 3, .4, 10, 1] } }),
        z({ id: src + "-river", type: "line", source: src, "source-layer": "water", filter: ["all", ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]], ["==", ["get", "kind"], "river"]],
          paint: { "line-color": "#7f9ea6", "line-width": ["interpolate", ["linear"], ["zoom"], 4, .5, 9, 1.4, 13, 2.5] } })
      ];
    }
    var label = function (t, lat, lon, k, z) { return { type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: { t: t, k: k, z: z } }; };
    var labels = { type: "FeatureCollection", features: A.labels.filter(function (l) { return l.length > 5; }).map(function (l) { return label(l[0], l[5], l[6], l[3], l[4]); }) };
    var fc = function (a) { return { type: "FeatureCollection", features: a }; };
    var pt = function (ll, p) { return { type: "Feature", geometry: { type: "Point", coordinates: [ll[1], ll[0]] }, properties: p }; };
    var at = {};
    var marks = fc((o.marks || []).filter(function (m) { return m.ll; }).map(function (m) {
      var key = m.ll[0].toFixed(3) + "," + m.ll[1].toFixed(3), nth = at[key] = (at[key] || 0) + 1;
      return pt(m.ll, { i: m.i, n: m.n, k: m.k, tier: m.tier || "", num: m.num ? String(m.num) : "", nth: nth - 1, first: nth === 1 }); }));
    var legs = fc((o.legs || []).filter(function (g) { return g.ll1 && g.ll2; }).map(function (g, i) {
      return { type: "Feature", geometry: { type: "LineString", coordinates: [[g.ll1[1], g.ll1[0]], [g.ll2[1], g.ll2[0]]] }, properties: { i: g.i || i + 1, m: g.m } }; }));
    var color = o.color || "#7a2e2e";
    var style = {
      version: 8, glyphs: abs("vendor/fonts/") + "{fontstack}/{range}.pbf",   // added after URL() so the braces stay unencoded
      sources: {
        region: { type: "vector", url: "pmtiles://" + abs("atlas-tiles/base-region.pmtiles"), attribution: "© OpenStreetMap · Protomaps" },
        paul: { type: "vector", url: "pmtiles://" + abs("atlas-tiles/base-paul.pmtiles") },
        holy: { type: "vector", url: "pmtiles://" + abs("atlas-tiles/base-holyland.pmtiles") },
        dem: { type: "raster-dem", url: "pmtiles://" + abs("atlas-tiles/relief-region.pmtiles"), encoding: "terrarium", tileSize: 512, attribution: "Relief: Mapterhorn (Copernicus GLO-30)" },
        dem2: { type: "raster-dem", url: "pmtiles://" + abs("atlas-tiles/relief-levant.pmtiles"), encoding: "terrarium", tileSize: 512 },
        labels: { type: "geojson", data: labels }, chg: { type: "geojson", data: chgFC(A) }, kpoly: { type: "geojson", data: fc([]) }, roads: { type: "geojson", data: fc([]) }, tribes: { type: "geojson", data: fc([]) }, tribelab: { type: "geojson", data: fc([]) }, sites: { type: "geojson", data: fc([]) }, kreg: { type: "geojson", data: fc([]) }, klab: { type: "geojson", data: fc([]) }, alts: { type: "geojson", data: fc([]) }, rivers: { type: "geojson", data: abs("atlas-rivers.json"), maxzoom: 8 }, marks: { type: "geojson", data: marks }, legs: { type: "geojson", data: legs }
      },
      layers: [{ id: "sea", type: "background", paint: { "background-color": SEA } }]
        .concat(base("region"), base("paul", 8), base("holy", 10))
        .concat([
          { id: "ne-river", type: "line", source: "rivers", maxzoom: 8, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#7f9ea6", "line-width": ["interpolate", ["linear"], ["zoom"], 3, .6, 8, 1.4] } },
          { id: "relief", type: "hillshade", source: "dem", maxzoom: 9.5, metadata: { layer: "relief" }, paint: { "hillshade-exaggeration": .55, "hillshade-shadow-color": "#5a4630", "hillshade-highlight-color": "#fffaf0", "hillshade-accent-color": "#6e5a40" } },
          { id: "relief2", type: "hillshade", source: "dem2", minzoom: 9.5, metadata: { layer: "relief" }, paint: { "hillshade-exaggeration": .55, "hillshade-shadow-color": "#5a4630", "hillshade-highlight-color": "#fffaf0", "hillshade-accent-color": "#6e5a40" } },
          /* kingdoms in the slider's year (filters set by self.year): Cliopatria borders, then OpenBible's regions as stacked bands */
          { id: "k-fill", type: "fill", source: "kpoly", metadata: { layer: "kingdoms" }, filter: ["==", ["get", "f"], 99999], paint: { "fill-color": ["get", "c"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, .2, 9, .06] } },   // fades close up so the land and names read
          { id: "k-line", type: "line", source: "kpoly", metadata: { layer: "kingdoms" }, filter: ["==", ["get", "f"], 99999], paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 9, 2.2], "line-opacity": .9 } },
          { id: "k-reg", type: "fill", source: "kreg", metadata: { layer: "kingdoms" }, filter: ["==", ["get", "f"], 99999], paint: { "fill-color": ["get", "c"], "fill-opacity": .09 } },
          { id: "k-label", type: "symbol", source: "klab", metadata: { layer: "kingdoms" }, filter: ["==", ["get", "f"], 99999],
            layout: { "text-field": ["upcase", ["get", "l"]], "text-font": ["Noto Sans Medium"], "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 8, 13], "text-letter-spacing": .12, "text-max-width": 9, "symbol-sort-key": ["-", 0, ["get", "a"]] },
            paint: { "text-color": ["get", "d"], "text-halo-color": "rgba(250,244,226,.9)", "text-halo-width": 1.6 } },
          { id: "k-label-key", type: "symbol", source: "klab", metadata: { layer: "kingdoms" }, filter: ["==", ["get", "f"], 99999],   // Israel, Judah and the empires that ruled them: always named
            layout: { "text-field": ["upcase", ["get", "l"]], "text-font": ["Noto Sans Medium"], "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10.5, 8, 14], "text-letter-spacing": .12, "text-max-width": 9, "text-allow-overlap": true },
            paint: { "text-color": ["get", "d"], "text-halo-color": "rgba(250,244,226,.95)", "text-halo-width": 2 } },
          /* tribal lands (tribes.json): estimated from Joshua's town lists, so a soft fill and a dotted edge, never a hard border */
          { id: "tr-fill", type: "fill", source: "tribes", metadata: { layer: "tribes" }, filter: ["==", ["get", "f"], 99999], paint: { "fill-color": ["get", "c"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, .28, 10, .12] } },
          { id: "tr-line", type: "line", source: "tribes", metadata: { layer: "tribes" }, filter: ["==", ["get", "f"], 99999], paint: { "line-color": ["get", "c"], "line-width": 1.6, "line-dasharray": [1, 1.5], "line-opacity": .9 } },
          { id: "tr-label", type: "symbol", source: "tribelab", metadata: { layer: "tribes" }, filter: ["==", ["get", "f"], 99999],
            layout: { "text-field": ["upcase", ["get", "n"]], "text-font": ["Noto Sans Medium"], "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11, 9, 15], "text-letter-spacing": .14 },
            paint: { "text-color": ["get", "c"], "text-halo-color": "rgba(250,244,226,.95)", "text-halo-width": 2 } },
          /* Roman roads (roads.json, Itiner-e, CC BY 4.0): solid = certain, dashed = conjectured, dotted = hypothetical, the dataset's own grades */
          { id: "road-certain", type: "line", source: "roads", metadata: { layer: "roads" }, filter: ["==", ["get", "c"], "certain"], layout: { "line-cap": "round" },
            paint: { "line-color": "#7a3b1e", "line-opacity": .85, "line-width": ["interpolate", ["linear"], ["zoom"], 4, ["match", ["get", "t"], "main", 1.4, .7], 10, ["match", ["get", "t"], "main", 3, 1.6]] } },
          { id: "road-conj", type: "line", source: "roads", metadata: { layer: "roads" }, filter: ["==", ["get", "c"], "conjectured"],
            paint: { "line-color": "#7a3b1e", "line-opacity": .75, "line-dasharray": [3, 1.6], "line-width": ["interpolate", ["linear"], ["zoom"], 4, ["match", ["get", "t"], "main", 1.2, .6], 10, ["match", ["get", "t"], "main", 2.6, 1.4]] } },
          { id: "road-hyp", type: "line", source: "roads", metadata: { layer: "roads" }, filter: ["==", ["get", "c"], "hypothetical"], layout: { "line-cap": "round" },
            paint: { "line-color": "#7a3b1e", "line-opacity": .7, "line-dasharray": [.1, 2.2], "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.2, 10, 2.4] } },
          /* ancient sites (sites.json, Pleiades, CC BY 3.0): only those in use in the slider's year, from zoom 6.5; names from zoom 9 */
          { id: "site-dot", type: "circle", source: "sites", minzoom: 6.5, metadata: { layer: "sites" }, filter: ["==", ["get", "f"], 99999],
            paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 6.5, 3.4, 9, 5, 12, 7], "circle-color": ["match", ["get", "k"], "s", "#5b4a32", "f", "#7a2e2e", "r", "#2f5e6e", "b", "#5e4a6e", "p", "#2f4f8a", "#6b6b52"],
              "circle-stroke-color": "#fffaf0", "circle-stroke-width": 1.4, "circle-opacity": .9 } },
          { id: "site-name", type: "symbol", source: "sites", minzoom: 9, metadata: { layer: "sites" }, filter: ["==", ["get", "f"], 99999],
            layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Regular"], "text-size": 13, "text-variable-anchor": ["left", "right", "top"], "text-radial-offset": .9, "text-max-width": 10 },
            paint: { "text-color": "#3b3226", "text-halo-color": "rgba(250,244,226,.95)", "text-halo-width": 1.6 } },
          { id: "modern-border", type: "line", source: "region", "source-layer": "boundaries", metadata: { layer: "modern" }, filter: ["==", ["get", "kind"], "country"],
            paint: { "line-color": "#8c2f52", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.4, 9, 2.6], "line-dasharray": [3, 2] } },
          { id: "modern-country", type: "symbol", source: "region", "source-layer": "places", metadata: { layer: "modern" }, filter: ["==", ["get", "kind"], "country"],
            layout: { "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]], "text-font": ["Noto Sans Medium"], "text-size": 14, "text-transform": "uppercase", "text-letter-spacing": .12 },
            paint: { "text-color": "#5c1f36", "text-halo-color": "#fffaf0", "text-halo-width": 2.4 } },
          { id: "modern-city", type: "symbol", source: "region", "source-layer": "places", metadata: { layer: "modern" }, minzoom: 4,
            filter: ["all", ["==", ["get", "kind"], "locality"], ["<=", ["get", "min_zoom"], ["+", ["zoom"], 0]]],
            layout: { "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]], "text-font": ["Noto Sans Medium"], "text-size": ["interpolate", ["linear"], ["zoom"], 4, 12.5, 9, 15], "icon-optional": true },
            paint: { "text-color": "#5c1f36", "text-halo-color": "#fffaf0", "text-halo-width": 2.4 } },
        ]).concat([1, 2, 3, 4, 5, 6, 7].reduce(function (out, lv) {   // label level 1 = the whole map in view; each level is about one zoom step
          return out.concat([
            { id: "ancient-sea-" + lv, type: "symbol", source: "labels", minzoom: lv + 1.5, metadata: { layer: "ancient" }, filter: ["all", ["!=", ["get", "k"], "region"], ["==", ["get", "z"], lv]],
              layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Italic"], "text-size": ["match", ["get", "k"], "sea", 14, 12] },
              paint: { "text-color": "#41646d", "text-halo-color": "rgba(196,214,214,.8)", "text-halo-width": 1.2 } },
            { id: "ancient-region-" + lv, type: "symbol", source: "labels", minzoom: lv + 1.5, metadata: { layer: "ancient" }, filter: ["all", ["==", ["get", "k"], "region"], ["==", ["get", "z"], lv]],
              layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Medium"], "text-size": 11.5, "text-letter-spacing": .22 },
              paint: { "text-color": "#6b5a3a", "text-halo-color": "rgba(241,230,200,.9)", "text-halo-width": 1.6 } }]);
        }, [])).concat([
          { id: "legs", type: "line", source: "legs", layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": color, "line-width": 2.6, "line-dasharray": ["case", ["==", ["get", "m"], "land"], ["literal", [3, 2]], ["literal", [1, 0]]] } },
          { id: "arrows", type: "symbol", source: "legs", layout: { "symbol-placement": "line-center", "icon-image": "jst-arrow", "icon-size": .6, "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true },
            paint: { "icon-color": color } },
          { id: "chg-dot", type: "circle", source: "chg", paint: { "circle-radius": 5, "circle-color": "#fffaf0", "circle-stroke-color": "#9a3b26", "circle-stroke-width": 2 } },
          { id: "chg-name", type: "symbol", source: "chg", minzoom: 7, layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Italic"], "text-size": 12, "text-variable-anchor": ["right", "left", "top"], "text-radial-offset": .9 },
            paint: { "text-color": "#7a2e1e", "text-halo-color": "rgba(250,244,226,.95)", "text-halo-width": 1.6 } },
          /* the other proposed sites for the picked place: a dotted line out to each, a small open ring and its name with its score */
          { id: "alt-line", type: "line", source: "alts", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#7d5a2e", "line-width": 1.3, "line-dasharray": [1, 2.5] } },
          { id: "alt-dot", type: "circle", source: "alts", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 4.5, "circle-color": "rgba(250,244,226,.9)", "circle-stroke-color": "#7d5a2e", "circle-stroke-width": 1.4 } },
          { id: "alt-name", type: "symbol", source: "alts", filter: ["==", ["geometry-type"], "Point"],
            layout: { "text-field": ["concat", ["get", "n"], " (", ["to-string", ["get", "s"]], ")"], "text-font": ["Noto Sans Italic"], "text-size": 11.5, "text-variable-anchor": ["left", "right", "top", "bottom"], "text-radial-offset": .8 },
            paint: { "text-color": "#5a4630", "text-halo-color": "rgba(250,244,226,.95)", "text-halo-width": 1.5 } },
          /* a place's pin says how sure scholars are of the site: solid = secure, open = likely, dashed ring = contested */
          { id: "place-pin", type: "symbol", source: "marks", filter: ["==", ["get", "k"], "place"],
            layout: { "icon-image": ["concat", "jst-pin-", ["get", "tier"]], "icon-allow-overlap": true, "icon-ignore-placement": true } },
          { id: "stop-dot", type: "symbol", source: "marks", filter: ["==", ["get", "k"], "stop"],
            layout: { "icon-image": "jst-dot", "icon-size": .62, "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-offset": ["interpolate", ["linear"], ["get", "nth"], 0, ["literal", [0, 0]], 4, ["literal", [140, 0]]],   // a return visit sits beside the earlier mark
              "text-field": ["get", "num"], "text-font": ["Noto Sans Medium"], "text-size": 10.5, "text-allow-overlap": true, "text-ignore-placement": true,
              "text-offset": ["interpolate", ["linear"], ["get", "nth"], 0, ["literal", [0, 0]], 4, ["literal", [6.7, 0]]], "symbol-sort-key": ["get", "i"] },
            paint: { "icon-color": color, "icon-halo-color": "#fffaf0", "icon-halo-width": 2, "text-color": "#ffffff" } },
          { id: "picked", type: "circle", source: "marks", filter: ["==", ["get", "i"], -1], paint: { "circle-radius": 12, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#1a1c20", "circle-stroke-width": 3 } },
          { id: "mark-name", type: "symbol", source: "marks", filter: ["==", ["get", "first"], true],
            layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Medium"], "text-size": 13, "text-variable-anchor": ["left", "right", "top", "bottom"], "text-radial-offset": 1.05, "text-justify": "auto", "symbol-sort-key": ["get", "i"] },
            paint: { "text-color": INK, "text-halo-color": "rgba(250,244,226,.95)", "text-halo-width": 1.8 } }
        ])
    };
    var map = new ml.Map({ container: holder, style: style, bounds: [[-12, 6], [62, 50]], maxBounds: [[-30, -5], [80, 60]], minZoom: 2, maxZoom: 14,
      attributionControl: { compact: true }, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false, touchPitch: false, renderWorldCopies: false });
    map.touchZoomRotate.disableRotation();
    self.map = map; holder.jstMap = map;   // reachable from the console for checking
    /* the stop circle and the leg arrow, drawn once as SDF images so the route's colour tints them */
    function sdf(id, draw) { var c = document.createElement("canvas"); c.width = c.height = 48; var x = c.getContext("2d"); x.fillStyle = "#000"; draw(x); map.addImage(id, x.getImageData(0, 0, 48, 48), { sdf: true }); }
    map.on("styleimagemissing", function (e) {
      if (e.id === "jst-dot") sdf("jst-dot", function (x) { x.beginPath(); x.arc(24, 24, 20, 0, 7); x.fill(); });
      if (/^jst-pin-/.test(e.id)) {   // drawn at twice the size for sharp edges on retina screens
        var t = e.id.slice(8), c = document.createElement("canvas"); c.width = c.height = 36; var x = c.getContext("2d");
        x.beginPath(); x.arc(18, 18, 12, 0, 7); x.fillStyle = t === "secure" ? "#c9a24c" : "rgba(250,244,226,.95)"; x.fill();
        x.lineWidth = t === "secure" ? 3 : t === "region" ? 2.6 : 4.4; x.strokeStyle = t === "contested" ? "#9a3b26" : t === "likely" ? "#b0852f" : t === "rejected" ? "#7a7a7a" : t === "area" || t === "region" ? "#8a7650" : "#5a3c10";
        if (t === "area") x.setLineDash([2.5, 3]);   // only the town or area is known: a dotted ring
        if (t === "rejected") { x.fillStyle = "rgba(220,220,220,.95)"; x.fill(); x.beginPath(); x.moveTo(10, 10); x.lineTo(26, 26); x.moveTo(26, 10); x.lineTo(10, 26); }
        if (t === "contested") x.setLineDash([5, 4]); x.stroke();
        map.addImage(e.id, x.getImageData(0, 0, 36, 36), { pixelRatio: 2 });
      }
      if (e.id === "jst-arrow") sdf("jst-arrow", function (x) { x.beginPath(); x.moveTo(10, 10); x.lineTo(40, 24); x.lineTo(10, 38); x.closePath(); x.fill(); });
    });
    function applyPrefs() {
      (map.getStyle().layers || []).forEach(function (l) { var g = l.metadata && l.metadata.layer; if (!g) return;
        var on = prefs[g] && !(prefs.kingdoms && /^ancient-region-/.test(l.id)) && !(g === "roads" && yr < -200);   // Rome's roads only once there is a Rome to build them   // with kingdoms on, the kingdoms name the land; the fixed region names would say it twice
        map.setLayoutProperty(l.id, "visibility", on ? "visible" : "none"); });
    }
    var ready = false, queue = [];   // calls made before the map loads wait here
    /* the year bar: a slider from 2500 BC to AD 400, opening on the passage's own year */
    var yr = o.year != null ? o.year : -1000, ybar = document.createElement("div"); ybar.className = "jst-atlas-year";
    ybar.innerHTML = '<button data-ystep="-10" aria-label="Ten years earlier">\u2039</button><input type="range" min="-2500" max="400" step="10" aria-label="Year"><button data-ystep="10" aria-label="Ten years later">\u203A</button><b></b><span></span>';
    host.appendChild(ybar);
    var yin = ybar.querySelector("input"), ylab = ybar.querySelector("b"), ynote = ybar.querySelector("span");
    yin.value = yr; ynote.textContent = o.yearNote || "";
    function yfilter(y) { return ["all", ["<=", ["get", "f"], y], [">=", ["get", "t"], y]]; }
    self.year = function (y) { yr = Math.max(-2500, Math.min(400, Math.round(y))); yin.value = yr; ylab.textContent = yearLabel(yr);
      var tl = host.querySelector(".jst-atlas-wipe .then"); if (tl) tl.textContent = "Then \u00B7 " + yearLabel(yr);
      when(function () { ["k-fill", "k-line", "k-reg", "site-dot", "site-name", "tr-fill", "tr-line", "tr-label"].forEach(function (id) { map.setFilter(id, yfilter(yr)); });
        applyPrefs();
        map.setFilter("k-label", ["all", yfilter(yr), ["<", ["get", "a"], 1000]]); map.setFilter("k-label-key", ["all", yfilter(yr), [">=", ["get", "a"], 1000]]); }); };
    yin.addEventListener("input", function () { ynote.textContent = ""; self.year(+yin.value); });
    ybar.addEventListener("click", function (e) { var b = e.target.closest("[data-ystep]"); if (b) { e.stopPropagation(); ynote.textContent = ""; self.year(yr + +b.getAttribute("data-ystep")); } });
    ybar.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    function showYearBar() { ybar.style.display = prefs.kingdoms ? "" : "none"; }
    showYearBar(); self.year(yr);
    map.on("load", function () { ready = true; applyPrefs();
      getJSON("roads.json").then(function (Rd) { if (Rd && map.getSource("roads")) map.getSource("roads").setData(Rd); });   // 3 MB, fetched once
      getJSON("tribes.json").then(function (T) { if (T && map.getSource("tribes")) { map.getSource("tribes").setData(T.areas); map.getSource("tribelab").setData(T.labels); } });
      getJSON("sites.json").then(function (St) { if (St && map.getSource("sites")) map.getSource("sites").setData(St); });   // 2 MB, fetched once
      getJSON("kingdoms.json").then(function (K) {   // 5 MB: fetched once, the first time a map opens, then cached
        if (!K || !map.getSource("kpoly")) return;
        var col = function (f) { var n = f.properties.n, c = kColor(n); f.properties.c = c; f.properties.d = c; f.properties.l = n.replace(/^(Kingdom|Kingdoms) of (the )?/, ""); if (KCOL[n]) f.properties.a = 1000 + (f.properties.a || 0); return f; };   // the Bible's own kingdoms get first claim on label space
        map.getSource("kpoly").setData(fc(K.polities.features.map(col))); map.getSource("kreg").setData(fc(K.regions.features.map(col)));
        map.getSource("klab").setData(fc(K.labels.features.map(col))); self.year(yr);
      }); var at = holder.querySelector(".maplibregl-compact-show"); if (at) at.classList.remove("maplibregl-compact-show");   // credits start folded (the i button opens them)
      queue.forEach(function (f) { f(); }); queue = []; });
    function when(f) { if (ready) f(); else queue.push(f); }
    map.on("click", function (e) {
      var f = map.queryRenderedFeatures(e.point, { layers: ["stop-dot", "place-pin", "mark-name"] })[0];
      if (f && o.onPick) { o.onPick(f.properties.i); return; }
      var rd = prefs.roads && map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: ["road-certain", "road-conj", "road-hyp"] })[0];
      if (rd && o.onRoad) { o.onRoad(rd.properties); return; }
      var ch = map.queryRenderedFeatures(e.point, { layers: ["chg-dot", "chg-name"] })[0];
      if (ch && o.onChange) { o.onChange(ch.properties); return; }
      var tb = prefs.tribes && map.queryRenderedFeatures(e.point, { layers: ["tr-fill", "tr-label"] })[0];
      if (tb && o.onTribe) { o.onTribe(tb.properties); return; }
      var st = prefs.sites && map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: ["site-dot", "site-name"] })[0];
      if (st && o.onSite) { o.onSite(st.properties); return; }
      var k = prefs.kingdoms && map.queryRenderedFeatures(e.point, { layers: ["k-fill", "k-reg"] })[0];
      if (k && o.onKingdom) o.onKingdom(k.properties, yr);
    });
    map.on("mousemove", function (e) { map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, { layers: ["stop-dot", "place-pin"] }).length ? "pointer" : ""; });

    function lls(pts) { return (pts || []).map(function (p) { return p.ll; }).filter(Boolean); }
    var touched = false, lastFit = null;
    map.on("dragstart", function (e) { if (e.originalEvent) touched = true; });
    map.on("zoomstart", function (e) { if (e.originalEvent) touched = true; });
    self.fit = function (pts, ms, minW) {
      lastFit = [pts, 0, minW];
      when(function () {
        var a = lls(pts), w = holder.clientWidth || 400;
        if (!a.length) { map.fitBounds([[-12, 6], [62, 50]], { duration: ms || 0 }); return; }
        var b = new ml.LngLatBounds([a[0][1], a[0][0]], [a[0][1], a[0][0]]); a.forEach(function (p) { b.extend([p[1], p[0]]); });
        var maxZoom = 11.5;
        if (minW) { var deg = minW / (A.proj.c * A.proj.k); maxZoom = Math.log2(360 / deg * w / 512); }   // minW is in the drawn map's units
        var fo = { padding: { top: 60, bottom: 96, left: 50, right: 78 }, maxZoom: Math.min(maxZoom, a.length === 1 ? 8.5 : 11.5), duration: ms || 0 };
        if (tilted && a.length === 2) {   // Play in 3D: face the way the leg runs, tipped back so the hills stand up
          var brg = atlasPrefs().northup ? 0 : Math.atan2((a[1][1] - a[0][1]) * Math.cos(a[0][0] * Math.PI / 180), a[1][0] - a[0][0]) * 180 / Math.PI;
          var cam = map.cameraForBounds(b, { padding: 90, maxZoom: 11, bearing: brg });   // the leg itself, not the flat map's minimum width
          if (cam) { map.easeTo({ center: cam.center, zoom: Math.min(cam.zoom - .3, 10.5), bearing: brg, pitch: 58, duration: ms || 0 }); return; }
        }
        if (map.getPitch() || map.getBearing()) { var c0 = map.cameraForBounds(b, { padding: fo.padding, maxZoom: fo.maxZoom, bearing: 0 }); if (c0) { map.easeTo({ center: c0.center, zoom: c0.zoom, bearing: 0, pitch: 0, duration: ms || 700 }); return; } }   // back down flat after Play
        map.fitBounds(b, fo);
      });
    };
    /* 3D hills for Play: the Levant's 30 m heights when the journey stays inside it, the region's coarser ones otherwise */
    var tilted = false;
    self.tilt = function (on, levant) { when(function () {
      if (!on) { if (!tilted) return; tilted = false; map.setTerrain(null); map.easeTo({ pitch: 0, bearing: 0, duration: 700 }); return; }
      if (!prefs.tilt || now) return;   // switched off in the layers, or comparing with today
      var file = levant ? "relief-levant" : "relief-region", src = map.getSource("dem3d");
      if (src && src._file !== file) { map.setTerrain(null); map.removeSource("dem3d"); src = null; }
      if (!src) { map.addSource("dem3d", { type: "raster-dem", url: "pmtiles://" + abs("atlas-tiles/" + file + ".pmtiles"), encoding: "terrarium", tileSize: 512 }); map.getSource("dem3d")._file = file; }
      map.setTerrain({ source: "dem3d", exaggeration: levant ? 2 : 3 }); tilted = true;
    }); };
    self.zoom = function (f) { when(function () { map.easeTo({ zoom: map.getZoom() + Math.log2(f), duration: 250 }); }); };
    self.upTo = function (n) { when(function () {
      map.setFilter("legs", n == null ? null : ["<", ["get", "i"], n]); map.setFilter("arrows", n == null ? null : ["<", ["get", "i"], n]);
      map.setFilter("stop-dot", n == null ? ["==", ["get", "k"], "stop"] : ["all", ["==", ["get", "k"], "stop"], ["<=", ["get", "i"], n]]);
      map.setFilter("mark-name", n == null ? ["==", ["get", "first"], true] : ["all", ["==", ["get", "first"], true], ["<=", ["get", "i"], n]]);
      if (now && now.isStyleLoaded()) { now.setFilter("legs", n == null ? null : ["<", ["get", "i"], n]); now.setFilter("legs-edge", n == null ? null : ["<", ["get", "i"], n]);
        ["stop-dot", "stop-num"].forEach(function (id) { now.setFilter(id, n == null ? ["==", ["get", "k"], "stop"] : ["all", ["==", ["get", "k"], "stop"], ["<=", ["get", "i"], n]]); }); } }); };
    self.pick = function (i) { when(function () { map.setFilter("picked", ["all", ["==", ["get", "i"], i], ["==", ["get", "nth"], 0]]); }); };
    self.resize = function () { map.resize(); if (now) now.resize(); };
    /* THEN | NOW: a second map (2016 Sentinel-2 satellite, today's borders and towns, the same pins) laid over this one and kept in
       step; a divider shows the ancient map left of it and today right of it. */
    var now = null, h2 = null, wipe = null, wx = .5, syncing = false, s1, s2;
    function setWipe(f) { wx = Math.max(.04, Math.min(.96, f)); var w = holder.clientWidth; if (h2) h2.style.clipPath = "inset(0 0 0 " + Math.round(w * wx) + "px)"; if (wipe) wipe.style.left = Math.round(w * wx) + "px"; }
    function tie(a, b) { return function () { if (syncing) return; syncing = true; b.jumpTo({ center: a.getCenter(), zoom: a.getZoom() }); syncing = false; }; }
    self.compare = function () {
      if (now) { map.off("move", s1); now.off("move", s2); now.remove(); h2.remove(); wipe.remove(); now = h2 = wipe = null; host.classList.remove("jst-atlas-cmp"); return false; }
      if (!ready) { queue.push(function () { if (!now) self.compare(); }); return true; }   // asked before the map loaded: do it when it has
      h2 = document.createElement("div"); h2.className = "jst-atlas-gl jst-atlas-now"; holder.parentNode.insertBefore(h2, holder.nextSibling);
      var mk = map.getSource("marks").serialize().data, lg = map.getSource("legs").serialize().data;
      now = new ml.Map({ container: h2, center: map.getCenter(), zoom: map.getZoom(), minZoom: 2, maxZoom: 14, maxBounds: [[-30, -5], [80, 60]], renderWorldCopies: false,
        attributionControl: { compact: true }, cooperativeGestures: true, dragRotate: false, touchPitch: false,
        style: { version: 8, glyphs: abs("vendor/fonts/") + "{fontstack}/{range}.pbf",
          sources: { sat: { type: "raster", tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"], tileSize: 256, maxzoom: 15, attribution: EOX_ATTR },
            region: { type: "vector", url: "pmtiles://" + abs("atlas-tiles/base-region.pmtiles"), attribution: "\u00A9 OpenStreetMap \u00B7 Protomaps" },
            marks: { type: "geojson", data: mk }, legs: { type: "geojson", data: lg }, chg: { type: "geojson", data: chgFC(A) } },
          layers: [
            { id: "sat", type: "raster", source: "sat" },
            { id: "b", type: "line", source: "region", "source-layer": "boundaries", filter: ["==", ["get", "kind"], "country"], paint: { "line-color": "#ffd27a", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 9, 2.4], "line-dasharray": [3, 2] } },
            { id: "c", type: "symbol", source: "region", "source-layer": "places", filter: ["==", ["get", "kind"], "country"], layout: { "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]], "text-font": ["Noto Sans Medium"], "text-size": 14, "text-transform": "uppercase", "text-letter-spacing": .12 }, paint: { "text-color": "#fff", "text-halo-color": "#1a1206", "text-halo-width": 2.6, "text-halo-blur": .5 } },
            { id: "t", type: "symbol", source: "region", "source-layer": "places", minzoom: 4, filter: ["all", ["==", ["get", "kind"], "locality"], ["<=", ["get", "min_zoom"], ["+", ["zoom"], 0]]], layout: { "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]], "text-font": ["Noto Sans Medium"], "text-size": ["interpolate", ["linear"], ["zoom"], 4, 12.5, 9, 15] }, paint: { "text-color": "#fff", "text-halo-color": "#1a1206", "text-halo-width": 2.6, "text-halo-blur": .5 } },
            { id: "chg-dot", type: "circle", source: "chg", paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#e0603c", "circle-stroke-width": 2 } },
            /* the journey drawn the same way as on the ancient side, white-edged so it reads on the photograph */
            { id: "legs-edge", type: "line", source: "legs", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "rgba(255,255,255,.85)", "line-width": 5 } },
            { id: "legs", type: "line", source: "legs", layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": color, "line-width": 2.8, "line-dasharray": ["case", ["==", ["get", "m"], "land"], ["literal", [3, 2]], ["literal", [1, 0]]] } },
            { id: "m", type: "circle", source: "marks", filter: ["==", ["get", "k"], "place"], paint: { "circle-radius": 6, "circle-color": "#e8c46a", "circle-stroke-color": "#fff", "circle-stroke-width": 1.8 } },
            { id: "stop-dot", type: "circle", source: "marks", filter: ["==", ["get", "k"], "stop"], paint: { "circle-radius": 10, "circle-color": color, "circle-stroke-color": "#fff", "circle-stroke-width": 2, "circle-translate": [0, 0] } },
            { id: "stop-num", type: "symbol", source: "marks", filter: ["==", ["get", "k"], "stop"], layout: { "text-field": ["get", "num"], "text-font": ["Noto Sans Medium"], "text-size": 10.5, "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#fff" } },
            { id: "mn", type: "symbol", source: "marks", filter: ["==", ["get", "first"], true], layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Medium"], "text-size": 14, "text-variable-anchor": ["left", "right", "top", "bottom"], "text-radial-offset": 1 }, paint: { "text-color": "#fff", "text-halo-color": "#1a1206", "text-halo-width": 2.8, "text-halo-blur": .5 } }
          ] } });
      now.touchZoomRotate.disableRotation();
      map.on("move", s1 = tie(map, now)); now.on("move", s2 = tie(now, map));
      wipe = document.createElement("div"); wipe.className = "jst-atlas-wipe"; wipe.setAttribute("role", "slider"); wipe.setAttribute("tabindex", "0"); wipe.setAttribute("aria-label", "Then and now divider");
      wipe.innerHTML = '<span class="then">Then \u00B7 ' + yearLabel(yr) + '</span><i></i><span class="now">Now \u00B7 2016 satellite</span>';
      holder.parentNode.insertBefore(wipe, h2.nextSibling);
      var drag = false;
      wipe.addEventListener("pointerdown", function (e) { drag = true; try { wipe.setPointerCapture(e.pointerId); } catch (x) {} e.stopPropagation(); e.preventDefault(); });
      wipe.addEventListener("pointermove", function (e) { if (!drag) return; var r = holder.getBoundingClientRect(); setWipe((e.clientX - r.left) / r.width); });
      wipe.addEventListener("pointerup", function () { drag = false; });
      wipe.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setWipe(wx + (e.key === "ArrowLeft" ? -.05 : .05)); } });
      wipe.addEventListener("click", function (e) { e.stopPropagation(); });
      host.classList.add("jst-atlas-cmp"); setWipe(wx);
      return true;
    };
    self.alts = function (list) { when(function () {
      var f = [];
      (list || []).forEach(function (a) { f.push(pt(a.ll, { n: a.n, s: a.s })); if (a.from) f.push({ type: "Feature", geometry: { type: "LineString", coordinates: [[a.from[1], a.from[0]], [a.ll[1], a.ll[0]]] }, properties: {} }); });
      map.getSource("alts").setData(fc(f));
      if (list && list.length) { var b = new ml.LngLatBounds(); list.forEach(function (a) { b.extend([a.ll[1], a.ll[0]]); if (a.from) b.extend([a.from[1], a.from[0]]); }); map.fitBounds(b, { padding: 70, maxZoom: 9, duration: 600 }); }
    }); };
    /* the layer switches: a small list over the map, remembered on this device */
    var menu = null;
    self.toggleLayers = function (btn) {
      if (menu) { menu.remove(); menu = null; return; }
      menu = document.createElement("div"); menu.className = "jst-atlas-menu";
      menu.innerHTML = '<div class="lbl">Layers</div>' + ATLAS_LAYERS.map(function (l) { return '<label><input type="checkbox" data-l="' + l[0] + '"' + (prefs[l[0]] ? " checked" : "") + "> " + esc(l[1]) + "</label>"; }).join("");
      menu.addEventListener("change", function (e) { var k = e.target.getAttribute("data-l"); prefs[k] = e.target.checked; var cur = atlasPrefs(); cur[k] = prefs[k]; atlasSavePrefs(cur); when(applyPrefs); showYearBar(); });
      menu.addEventListener("click", function (e) { e.stopPropagation(); });
      host.appendChild(menu);
    };
    var ro = global.ResizeObserver ? new ResizeObserver(function () { map.resize(); if (now) { now.resize(); setWipe(wx); } if (!touched && lastFit && ready) self.fit.apply(null, lastFit); }) : null;   // keep the passage in frame when the panel changes width, until the reader moves the map
    if (ro) ro.observe(host);
    function esc_(e) { var wr = host.closest("[data-jst-awrap]") || host; if (e.key === "Escape" && wr.classList.contains("jst-atlas-big")) { e.stopPropagation(); wr.classList.remove("jst-atlas-big"); } }
    document.addEventListener("keydown", esc_, true);
    self.destroy = function () { if (now) self.compare(); if (ro) ro.disconnect(); document.removeEventListener("keydown", esc_, true); if (menu) menu.remove(); ybar.remove(); try { map.remove(); } catch (e) {} holder.remove(); };
    self.loaded = new Promise(function (ok, no) { map.on("load", ok); map.on("error", function (e) { if (global.console) console.warn("Atlas map:", e && e.error); if (!ready && !/does not exist in the map's style/.test(String(e && e.error && e.error.message))) no(e && e.error); }) });   // a query made too early is not a failed map
    return self;
  }

  /* one controller whatever draws the map: calls made before MapLibre is up are replayed on it, or on the drawn map if it fails */
  function atlasMount(host, A, o) {
    var self = {}, impl = null, last = {};
    ["fit", "zoom", "upTo", "pick", "resize", "toggleLayers", "alts", "year", "compare", "tilt"].forEach(function (k) {
      self[k] = function () { var a = arguments; if (k !== "zoom" && k !== "toggleLayers" && k !== "alts" && k !== "compare" && k !== "tilt") last[k] = a; if (impl && impl[k]) return impl[k].apply(impl, a); };
    });
    var dead = false;
    function svg() { if (dead) return; impl = atlasSVG(host, A, o); host.classList.add("jst-atlas-flat"); Object.keys(last).forEach(function (k) { if (impl[k]) impl[k].apply(impl, last[k]); }); }
    if (!CFG.onlineMaps || !global.WebGLRenderingContext) svg();
    else atlasLib().then(function (ml) {
      if (dead) return;
      var g = atlasGL(ml, host, A, o); impl = g;
      Object.keys(last).forEach(function (k) { g[k].apply(g, last[k]); });
      g.loaded.catch(function (e) { if (global.console) console.warn("Atlas: MapLibre failed, drawing the flat map instead.", e); if (dead) return; g.destroy(); impl = null; svg(); });
    }, svg);
    self.destroy = function () { dead = true; if (impl) impl.destroy(); };
    return self;
  }
  /* a gathering topic (Pentecost) whose verses overlap the passage */
  function gatherFor(T, ref) {
    var segs = data.segs(ref);
    return ((T && T.topics) || []).filter(function (t) { return t.nations && R.parse(t.ref).some(function (a) { return segs.some(function (b) { return overlap(a, b); }); }); })[0];
  }
  function atlasRouteFor(A, ref) {
    var segs = data.segs(ref);
    return (A.routes || []).filter(function (r) { return r.ranges.some(function (x) { return R.parse(x).some(function (a) { return segs.some(function (b) { return overlap(a, b); }); }); }); })[0];
  }

  /* James's Logos atlases (shelf.json: [id, title, by, year, kind, books, flags]; flag "b" = the atlas carries Bible references).
     An atlas can't be opened AT a passage or a place (checked in Logos 20 Oct 2026: Bible refs send it to its front pages, Factbook
     place keys only work where the atlas happens to have that article), so each link runs a Logos search inside that one atlas:
     the passage as a reference search (<Bible ~ Acts 9>), a place by name. The results list every section with its page, one click
     to open. logos4:Search;kind=BasicSearch;q=…;in=raw:Single|ResourceId=LLS:… was checked against Logos's own search history. */
  var ATLAS_SHORT = { barbourbibatlascomp: "Atlas & Companion", ltmtbbltls: "Ultimate Atlas", hlmnchrtsmaps: "Holman Charts", stdbibatlas: "Standard Atlas", vptlblhst2nd: "Lion Atlas", hlmnbblat: "Holman Atlas" };
  function atlasShort(x) { return ATLAS_SHORT[x[0]] || x[1]; }
  function atlasSearch(x, q) { return "logos4:Search;kind=BasicSearch;q=" + encodeURIComponent(q) + ";in=" + encodeURIComponent("raw:Single|ResourceId=LLS:" + String(x[0]).toUpperCase()); }
  function atlasForRef(x, ref) { return (x[6] || "").indexOf("b") > -1 && ref && !R.web() ? atlasSearch(x, "<Bible ~ " + ref + ">") : R.logos(x[0]); }   // web links (Read along) open the atlas itself
  var ATLAS_PAGES = {};   // atlas-pages.json: {place: {atlas id: page}}, read off Logos's own search results (scheduled task atlas-page-index)
  function atlasLinks(at, place) {   // one short line: the page in each atlas where it treats the place, or a search there when no page is known
    var pg = ATLAS_PAGES[place] || ATLAS_PAGES[String(place).replace(/_/g, " ")] || {};
    var out = at.map(function (x) { return outlink(R.web() ? "https://ref.ly/logosres/" + x[0] + (pg[x[0]] ? "?ref=Page.p+" + encodeURIComponent(pg[x[0]]) : "")   // the web: ref.ly opens the book (at the page when known) for an owner, its logos.com page for anyone else
      : pg[x[0]] ? "logosres:" + x[0] + ";ref=Page.p_" + encodeURIComponent(pg[x[0]]) : atlasSearch(x, place), esc(atlasShort(x))); });
    return out.length ? '<div class="jst-atlas-links"><span class="lbl">' + esc(place) + " in Logos</span> " + out.join(" ") + "</div>" : "";
  }
  /* the other sites proposed for a place, strongest first, with OpenBible's score: the honest answer to "where was it?" */
  function placeRivals(p, full) {
    if (!p.alt || !p.alt.length) return p.tier === "unlocated" ? '<p class="sub u-fs14">No site has been proposed with any confidence.</p>' : "";
    var top = p.alt.filter(function (a) { return a[3] > 0; });
    if (!top.length) return "";
    return '<p class="u-fs14 u-m4-8">' + (full ? "Best-supported site scores " + p.s + " (500+ is high confidence). " : "") + "Other proposed sites: " +
      top.slice(0, full ? 5 : 3).map(function (a) { return esc(a[0]) + " (" + a[3] + ")"; }).join(", ") + "</p>";
  }
  /* public-domain photos of a place (place-photos.json, scripts/build-photos.py: each licence re-checked at its source) */
  var PHOTOS = {};
  /* a place's photos (place-photos.json, Wikimedia Commons, re-checked open licences): big enough to see, captioned with what they
     show; a tap opens the photo full size in the app's own viewer (as the art does). The credits CC BY needs sit once at the end of the card. */
  function photoFull(p) { return String(p.thumb).replace(/\?.*$/, "").replace("/thumb/", "/").replace(/\/\d+px-[^/]+$/, "").replace("//thumb.wikimedia.org/", "//upload.wikimedia.org/"); }   // the original file
  function photoStrip(id) {
    var ph = (PHOTOS[id] || []).slice(0, 4); if (!ph.length || !CFG.onlineMaps) return "";
    return '<div class="jst-photos' + (ph.length === 1 ? " one" : "") + '">' + ph.map(function (p) { return '<figure><button class="jst-photo" data-jst-photo="' + esc(photoFull(p)) + '" data-t="' + esc(p.what) + '" aria-label="' + esc(p.what) + ', full size"><img src="' + esc(String(p.thumb).replace(/\?.*$/, "")) + '" alt="' + esc(p.what) + '" loading="lazy" referrerpolicy="no-referrer"></button><figcaption>' + esc(p.what) + "</figcaption></figure>"; }).join("") + "</div>";
  }
  function photoCredits(id) {
    var ph = (PHOTOS[id] || []).slice(0, 4); if (!ph.length || !CFG.onlineMaps) return "";
    return '<p class="jst-photo-credits">Photos: ' + ph.map(function (p) { return (p.artist ? esc(p.artist) + ", " : "") + (p.licurl ? '<a href="' + esc(p.licurl) + '" target="_blank" rel="noopener">' + esc(p.lic) + "</a>" : esc(p.lic)) + ' (<a href="' + esc(p.page) + '" target="_blank" rel="noopener">source</a>)'; }).join("; ") + ". Wikimedia Commons.</p>";
  }
  /* the "Named in N verses" block, the same on every place card (passage list, search, pin) */
  function placeVerses(pd, id) {
    var refs = placeRefs(pd, id); if (!refs.length) return "";
    return '<div class="lbl u-mt14">Named in ' + refs.length + " verse" + (refs.length > 1 ? "s" : "") + '</div><p class="u-fs15 jst-atlas-refs">' + refs.slice(0, 40).map(function (r) { return '<button class="jst-ref" data-jst-go="' + esc(r) + '">' + esc(r) + "</button>"; }).join(" ") + (refs.length > 40 ? " and " + (refs.length - 40) + " more" : "") + "</p>";
  }
  /* every verse that names a place, from the shared list's verse index (built once) */
  var PLACEREFS = null;
  function placeRefs(pd, id) {
    if (!PLACEREFS) { PLACEREFS = {}; Object.keys(pd.ix).forEach(function (b) { Object.keys(pd.ix[b]).forEach(function (c) { pd.ix[b][c].forEach(function (row) { row.slice(1).forEach(function (v) { (PLACEREFS[row[0]] = PLACEREFS[row[0]] || []).push([b, +c, v]); }); }); }); });
      Object.keys(PLACEREFS).forEach(function (k) { PLACEREFS[k].sort(function (x, y) { return (R.book(x[0]) || {}).order - (R.book(y[0]) || {}).order || x[1] - y[1] || x[2] - y[2]; }); }); }
    return (PLACEREFS[id] || []).map(function (x) { return x[0] + " " + x[1] + ":" + x[2]; });
  }
  /* dig cards: one claimed place with the case for and against (the Passage Map scope's structure); statuses in this order */
  var DIG_STATUS = ["confirmed", "probable", "contested", "unresolved", "rejected"];
  var DIG_PIN = { confirmed: "secure", probable: "likely", contested: "contested", unresolved: "contested", rejected: "rejected" };
  var MEDIA_ICON = { play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.5v11l9-5.5z"/></svg>', pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>',
    stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5h9v9h-9z"/></svg>', north: '<svg viewBox="0 0 16 16" aria-hidden="true"><path class="n" d="M8 1l3.2 7H4.8z"/><path class="s" d="M4.8 8h6.4L8 15z"/></svg>' };
  /* a dig card's sources: a Bible passage is just its reference, opening in the reader (James: no "KJV, Bible Gateway");
     a book the reader doesn't have (2 Maccabees, 2 Esdras) keeps its link out, shown as the reference alone; the same passage twice shows once */
  function digSources(list) {
    var seen = {};
    return (list || []).filter(function (x) { return !/wikipedia\.org/i.test(x.url || ""); }).map(function (x) {
      var m = /^(.*?\d+:\d+[^()]*?)\s*\(([^)]*)\)\s*$/.exec(x.title || ""), bible = m && /LSB|KJV|NRSV|ESV|NIV|NASB|Bible Gateway|eBible|Apocrypha/i.test(m[2]);
      if (!bible) return "<li>" + outlink(x.url, esc(x.title)) + "</li>";
      var ref = m[1].trim(); if (seen[ref]) return ""; seen[ref] = 1;
      var rs = R.parse(ref);
      if (!rs.length) return "<li>" + outlink(x.url, esc(ref)) + "</li>";
      return "<li>" + rs.map(function (r) { var t = r.book + " " + r.c1 + ":" + r.v1 + (r.c2 !== r.c1 ? "\u2013" + r.c2 + ":" + r.v2 : r.v2 !== r.v1 ? "\u2013" + r.v2 : "");
        return '<button class="jst-ref" data-jst-go="' + esc(t.replace("\u2013", "-")) + '">' + esc(t) + "</button>"; }).join(" ") + "</li>";
    }).join("");
  }
  function digCard(c, n) {
    var li = function (a) { return a && a.length ? "<ul>" + a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<p>None.</p>"; };
    var row = function (k, v) { return v ? '<div class="lbl u-mt10">' + k + '</div><p class="u-fs15">' + esc(v) + "</p>" : ""; };
    return '<div class="jst-dig" data-jst-dig="' + n + '"><div class="jst-dig-head"><span class="tt">' + esc(c.name) + '</span> <span class="jst-dig-st ' + esc(c.status) + '">' + esc(c.status) + "</span>" +
      (c.lat != null && c.lat >= 6 && c.lat <= 50 && c.lon >= -12 && c.lon <= 62 ? ' <button class="jst-ref" data-jst-digfly="' + n + '">Show on the map</button>' : c.lat != null ? ' <span class="sub u-fs13">Off this map (' + Math.abs(c.lat).toFixed(1) + "\u00B0" + (c.lat < 0 ? "S" : "N") + ", " + Math.abs(c.lon).toFixed(1) + "\u00B0" + (c.lon < 0 ? "W" : "E") + ")</span>" : ' <span class="sub u-fs13">No site to pin</span>') + "</div>" +
      row("The claim", c.claim) + row("What the text says", c.text) + row("Who", c.who) + row("Digging", c.digging) +
      '<div class="lbl u-mt10">Published, peer-reviewed</div>' + li(c.published_peer) + '<div class="lbl u-mt10">Press, broadcasts and books</div>' + li(c.published_press) +
      row("The case for", c.for) + row("The case against", c.against) + row("What couldn't be checked", c.notes) +
      (c.sources && c.sources.length ? '<div class="lbl u-mt10">Sources</div><ul class="jst-dig-src">' + digSources(c.sources) + "</ul>" : "") + "</div>";
  }
  /* the Atlas page's search: topics, journeys, kingdoms and places, best matches first */
  function atlasFind(self, q) {
    q = q.trim().toLowerCase(); if (q.length < 2) return "";
    var wb = new RegExp("(^|[^a-z])" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));   // a match at the start of a word ranks above one inside a word
    var score = function (name, extra) { var n = name.toLowerCase(), best = n === q ? 0 : n.indexOf(q) === 0 ? 1 : wb.test(n) ? 1.5 : n.indexOf(q) > -1 ? 2.5 : 9;
      (extra || []).forEach(function (a) { a = a.toLowerCase(); best = Math.min(best, a === q ? 0 : a.indexOf(q) === 0 ? 1 : a.indexOf(q) > -1 ? 3 : 9); }); return best; };
    var out = [], add = function (kind, id, name, sub, sc) { if (sc < 9) out.push({ kind: kind, id: id, name: name, sub: sub, sc: sc }); };
    ((self.T && self.T.topics) || []).forEach(function (t) { add("t", t.id, t.name, "Topic \u00B7 " + (t.nations ? t.nations.length + " peoples, " + t.ref : (t.claims || []).length + " claimed places"), score(t.name, t.aliases)); });
    (self.A.routes || []).forEach(function (r) { var stop = realStops(r).some(function (x) { return x.n.toLowerCase() === q; });   // a journey through the place: listed, but after the place itself
      add("r", r.id, r.name, "Journey \u00B7 " + r.ranges[0] + (stop ? " \u00B7 passes through it" : ""), Math.min(score(r.name), stop ? 2 : 9)); });
    var ks = {}; ((self.K && self.K.polities.features) || []).concat((self.K && self.K.regions.features) || []).forEach(function (f) { var p = f.properties, k = ks[p.n] || (ks[p.n] = { f: p.f, t: p.t }); k.f = Math.min(k.f, p.f); k.t = Math.max(k.t, p.t); });
    Object.keys(ks).forEach(function (n) { if (ks[n].t < -2500 || ks[n].f > 400) return; add("k", n, n, "Kingdom \u00B7 " + yearLabel(ks[n].f) + " to " + yearLabel(ks[n].t), score(n)); });
    Object.keys(self.pd.places).forEach(function (id) { var p = self.pd.places[id]; add("p", id, p.n.replace(/\s+\d+$/, ""), "Place \u00B7 " + TIER[p.tier] + (p.n.match(/\d+$/) ? " (" + p.n + ")" : ""), score(p.n.replace(/\s+\d+$/, ""))); });
    var order = { t: 0, r: 1, k: 2, p: 3 };
    out.sort(function (a, b) { return a.sc - b.sc || order[a.kind] - order[b.kind] || a.name.localeCompare(b.name); });
    out = out.slice(0, 24);
    if (!out.length) return '<p class="sub u-fs15">Nothing found for \u201C' + esc(q) + '\u201D.</p>';
    return '<ul class="jst-atlas-results">' + out.map(function (x) { return '<li><button data-jst-asel="' + (x.kind === "r" ? x.id : x.kind + ":" + x.id) + '"><b>' + esc(x.name) + "</b><span>" + esc(x.sub) + "</span></button></li>"; }).join("") + "</ul>";
  }
  define("Maps", { id: "maps", label: "Maps", name: "Maps of this passage", icon: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>' }, {
    prepare: function () { var self = this; return Promise.all([data.names(), data.maps(), getJSON("map-places.json").catch(function () { return null; }), this.o.logos !== false ? data.library().catch(function () { return null; }) : null, getJSON("atlas.json"), this.o.logos !== false ? getJSON("atlas-pages.json").catch(function () { return null; }) : null, data.places(), getJSON("kingdoms.json").catch(function () { return null; }), getJSON("topics.json").catch(function () { return null; }), getJSON("place-photos.json").catch(function () { return null; })]).then(function (r) { self.T = r[8]; if (r[9] && r[9].photos) PHOTOS = r[9].photos; if (r[5] && r[5].pages) ATLAS_PAGES = r[5].pages; self.pd = r[6]; self.K = r[7]; self.nm = r[0]; self.mp = r[2] || {}; self.at = (r[3] && r[3].atlases) || []; self.A = r[4]; }); },
    /* the passage's places from the shared list, with STEPBible's one-line description and its name (the Biblica map index uses it) */
    places: function () { var nm = this.nm; return placesIn(this.pd, this.o.ref).map(function (p) { var st = nm && p.step && nm.p[p.step[0]]; return Object.assign(p, { b: st && st.b, sn: st && st.n }); }); },
    route: function () { var A = this.A, t = this.st.tab; return A && t && t !== "here" && !/^[ptk]:/.test(t) ? A.routes.filter(function (r) { return r.id === t; })[0] : null; },
    /* what the Atlas page has chosen beyond a journey: a place (p:id), a kingdom (k:name) or a topic (t:id) */
    sel: function () { var t = this.st.tab || "", m = /^([ptk]):(.+)$/.exec(t); return m ? { kind: m[1], id: m[2] } : null; },
    view: function () {
      var self = this, A = this.A, atlas = !!this.o.atlas, places = this.places(), pinned = places.filter(function (p) { return p.ll; });
      var gath = gatherFor(this.T, this.o.ref);
      if (A && !this.st.tab) { var auto = atlasRouteFor(A, this.o.ref); this.st.tab = auto ? auto.id : gath ? "t:" + gath.id : "here"; }
      var rt = this.route(), sel = this.sel(), ms = mapsFor(this.o.ref), h = "", side = "";
      if (A) {
        /* Places here, or one of the journeys (grouped Old and New Testament) */
        var grp = function (g, label) { return '<optgroup label="' + label + '">' + A.routes.filter(function (r) { return (r.group || "nt") === g; }).map(function (r) { return '<option value="' + r.id + '"' + (rt === r ? " selected" : "") + ">" + esc(r.name) + "</option>"; }).join("") + "</optgroup>"; };
        var tabs = '<div class="jst-atlas-tabs"><button class="chip' + (!rt && !sel ? " on" : "") + '" data-jst-atab="here">' + (atlas ? "Places in " + esc(this.o.ref) : "Places here") + (pinned.length ? " (" + pinned.length + ")" : "") + "</button>" +
          (gath ? '<button class="chip' + (sel && sel.id === gath.id ? " on" : "") + '" data-jst-atab="t:' + gath.id + '">' + esc(gath.name) + "</button>" : "") +
          '<label class="jst-atlas-pickj' + (rt ? " on" : "") + '"><span class="lbl">Journey</span><select data-jst-aj aria-label="Journey"><option value="">' + (rt ? "Places here" : "Choose a journey") + "</option>" + grp("ot", "Old Testament") + grp("nt", "New Testament") + "</select></label>" + (rt ? this.mediaBtns() : "") + "</div>";
        var map = '<div class="jst-atlas" data-jst-atlas><div class="jst-atlas-ctl"><button data-jst-az="in" aria-label="Zoom in">+</button><button data-jst-az="out" aria-label="Zoom out">\u2212</button><button data-jst-az="fit" aria-label="Fit">\u2922</button>' + (atlas ? "" : '<button data-jst-az="full" aria-label="Full screen">\u26F6</button>') + '<button data-jst-az="layers" aria-label="Layers" title="Layers">\u2630</button><button data-jst-az="swipe" aria-label="Then and now" title="Then and now: drag the divider between the ancient map and today">\u21C6</button></div><div class="jst-atlas-hint">Hold Ctrl or \u2318 and scroll to zoom</div></div>';
        if (!atlas) h += tabs;
        h += '<div class="jst-atlas-wrap' + (atlas ? " jst-atlas-page" : "") + '" data-jst-awrap>' + map + (atlas ? "" : '<div class="jst-atlas-grip" data-jst-agrip role="separator" aria-orientation="horizontal" aria-label="Map height: drag, or use the arrow keys" title="Drag to make the map taller or shorter (double-click to reset)" tabindex="0"><i></i></div>') + '<div class="jst-atlas-side">';   // full screen and the Atlas page: the map, and this column beside it
        if (atlas) h += '<form class="jst-atlas-search" data-jst-asearchf role="search"><input type="search" data-jst-asearch placeholder="Search: a place, journey, kingdom or topic (try Ark)" aria-label="Search the atlas" autocomplete="off" spellcheck="false"></form><div data-jst-aresults></div>' + tabs;
        h += '<div class="jst-atlas-pick" data-jst-apick></div>';
        if (sel) h += this.selBox(sel);
        else if (rt) {
          var rs = realStops(rt);
          h += box("witness", "", '<div class="item"><div class="lbl">' + esc(rt.ranges[0].replace(/-/, "\u2013")) + " \u00B7 " + rs.length + ' stops</div><span class="tt">' + esc(rt.name) + "</span>" +
            (rt.about ? '<p class="u-m4-8 u-fs16 jst-atlas-about">' + esc(rt.about) + "</p>" : "") + travelLine(rt) + '<ol class="jst-atlas-stops">' +
            rs.map(function (s, i) { return '<li><button class="jst-xt" data-jst-astop="' + (i + 1) + '"><b data-jst-c="' + rt.color + '">' + (i + 1) + "</b>" + esc(s.n) + "</button>" + (s.km ? '<span class="jst-atlas-leg">' + s.km.toLocaleString() + " km" + (s.d ? " \u00B7 " + (s.d < 1 ? "under a day" : s.d.toFixed(s.d < 10 ? 1 : 0) + " days") : "") + "</span>" : "") + '<button class="jst-ref" data-jst-go="' + esc(s.ref) + '">' + esc(s.ref) + "</button></li>"; }).join("") + "</ol>" +
            '<div class="lbl u-mt14">Height along the way</div><div data-jst-aprof><p class="sub u-fs14">Reading the heights\u2026</p></div></div>');   // the stops first, the heights under them
        } else if (!pinned.length) h += none("No place in " + esc(this.o.ref) + " has a known position. Pick a journey" + (atlas ? " or search." : " above."));
      }
      if (!rt && !sel) {
        if (places.length) h += '<div class="lbl u-mt14">Places in ' + esc(this.o.ref) + " (" + places.length + ")</div>" + places.map(function (p) {
          var on = (self.mp[p.sn || p.n] || []).filter(function (i) { return MAPBY[i]; }).slice(0, 3);
          return box("witness", "", '<div class="item"><span class="tt">' + esc(p.n) + '</span> <span class="jst-tier ' + p.tier + '">' + TIER[p.tier] + "</span>" + (p.b ? '<p class="sub u-m4-8 u-fs15">' + esc(p.b) + "</p>" : "") + tierNote(p) + placeRivals(p) + photoStrip(p.id) +
            (on.length ? '<div class="chips">' + on.map(function (i) { return '<button class="chip" data-jst-pmap="' + esc(i) + '">' + esc(MAPBY[i].t.replace(/^[^:]+:\s*/, "")) + "</button>"; }).join("") + "</div>" : "") +
            placeVerses(self.pd, p.id) + (p.ll && A ? '<button class="btn u-mt6" data-jst-fly="' + esc(p.id) + '">Show on the map</button>' : "") + (self.o.logos !== false ? atlasLinks(self.at || [], p.n) : "") + photoCredits(p.id) + "</div>"); }).join("");
        else if (!A) h += none("No place is named in " + esc(this.o.ref) + ".");
      }
      if (A) h += "</div></div>";   // end of the side column and the wrap
      if (!atlas) {
        h += '<div class="lbl u-mt14">Bible maps for ' + esc(this.o.ref) + " (" + ms.length + ")</div>" + (ms.length ? box("witness", "", '<div class="item">' + ms.map(function (m) { return '<p class="u-m5"><button class="tt jst-xt" data-jst-pmap="' + esc(m.id) + '">' + esc(m.t.replace(/^[^:]+:\s*/, "")) + "</button></p>"; }).join("") + "</div>") : none("No Biblica map is tied to this passage."));
        if (this.o.logos !== false && (this.at || []).length) h += '<div class="lbl u-mt14">' + (this.o.owner ? "My atlases" : "Atlases") + " in Logos (" + this.at.length + ")</div>" + '<p class="ctx u-fs13">' + (R.web() ? "Each opens in Logos; if you don't own it, its page on logos.com." : "Each one searches that atlas for " + esc(this.o.ref) + ": pick a result to open the page.") + "</p>" + this.at.map(function (x) { return '<p class="u-m5">' + outlink(atlasForRef(x, self.o.ref), esc(x[1])) + ((x[6] || "").indexOf("b") > -1 ? '<span class="sub u-fs13"> \u00B7 ' + esc(self.o.ref) + "</span>" : "") + "</p>"; }).join("");   // (moved from the Shelf's old Maps tab)
        h += '<p class="ctx u-fs13">Coastlines, lakes and rivers: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a> (public domain). Roman roads: <a href="https://zenodo.org/records/17122148" target="_blank" rel="noopener">Itiner-e</a> (CC BY 4.0). Ancient sites: <a href="https://pleiades.stoa.org/" target="_blank" rel="noopener">Pleiades</a> (CC BY 3.0). Kingdoms by year: <a href="https://github.com/Seshat-Global-History-Databank/cliopatria" target="_blank" rel="noopener">Cliopatria</a> (Seshat, CC BY 4.0) and OpenBible.info. Places, sites and how sure scholars are: <a href="https://www.openbible.info/geo/" target="_blank" rel="noopener">OpenBible.info</a> (CC BY 4.0; a score of 500 or more is high confidence); <a href="https://pleiades.stoa.org/" target="_blank" rel="noopener">Pleiades</a> and <a href="https://www.stepbible.org/" target="_blank" rel="noopener">STEPBible</a> (CC BY). Bible maps: <a href="https://github.com/BibleAquifer/BiblicaOpenBibleMaps" target="_blank" rel="noopener">Biblica Open Bible Maps</a> (CC BY-SA 4.0); tap one for full screen. Place photos: public domain, CC0, CC BY and CC BY-SA only, each licence checked on its Wikimedia Commons file page and credited under the photo; tap a photo for its file page.</p>';
      }
      var title = sel ? this.selTitle(sel) : rt ? rt.name : "Where this happens";
      return { kick: (atlas ? "Atlas" : "Maps") + " \u00B7 " + (rt ? realStops(rt).length + " stops" : sel ? { p: "place", k: "kingdom", t: "topic" }[sel.kind] : places.length + " places"), title: title, body: h };
    },
    selTitle: function (sel) {
      if (sel.kind === "p") { var p = this.pd && this.pd.places[sel.id]; return p ? p.n.replace(/\s+\d+$/, "") : "Place"; }
      if (sel.kind === "t") { var t = this.topic(sel.id); return t ? t.name : "Topic"; }
      return sel.id;
    },
    topic: function (id) { return ((this.T && this.T.topics) || []).filter(function (t) { return t.id === id; })[0]; },
    /* the side box for a searched place, kingdom or topic */
    selBox: function (sel) {
      var self = this, al = this.o.logos !== false ? this.at || [] : [];
      if (sel.kind === "p") {
        var p = this.pd && this.pd.places[sel.id]; if (!p) return none("That place isn't in the list.");
        var nm = p.n.replace(/\s+\d+$/, ""), st = this.nm && p.step && this.nm.p[p.step[0]], refs = placeRefs(this.pd, sel.id);
        return box("witness", "", '<div class="item"><span class="tt">' + esc(nm) + '</span> <span class="jst-tier ' + p.tier + '">' + TIER[p.tier] + "</span>" + (st && st.b ? '<p class="u-m4-8 u-fs15">' + esc(st.b) + "</p>" : "") + tierNote(p) + placeRivals(p, true) + photoStrip(sel.id) +
          placeVerses(this.pd, sel.id) + (p.ll ? '<button class="btn u-mt6" data-jst-fly="' + esc(sel.id) + '">Show on the map</button>' : "") +
          atlasLinks(al, nm) + photoCredits(sel.id) + "</div>");
      }
      if (sel.kind === "k") {
        var rows = ((this.K && this.K.polities.features) || []).filter(function (f) { return f.properties.n === sel.id; }).map(function (f) { return f.properties; });
        var reg = ((this.K && this.K.regions.features) || []).filter(function (f) { return f.properties.n === sel.id; })[0];
        var f0 = rows.length ? Math.min.apply(null, rows.map(function (r) { return r.f; })) : reg && reg.properties.f, t0 = rows.length ? Math.max.apply(null, rows.map(function (r) { return r.t; })) : reg && reg.properties.t;
        return box("witness", "", '<div class="item"><span class="tt">' + esc(sel.id) + '</span><p class="u-m4-8 u-fs15">' + (f0 != null ? "On the map from " + esc(yearLabel(f0)) + " to " + esc(yearLabel(t0)) + ". The slider below the map moves through those years. " : "") +
          (reg ? esc(reg.properties.why) + " Area: OpenBible.info, drawn as bands from likely to possible." : "Borders: Cliopatria (Seshat), one reading of borders historians still argue over.") + "</p>" + atlasLinks(al, sel.id.replace(/^(Kingdom|Kingdoms) of (the )?/, "")) + "</div>");
      }
      var t = this.topic(sel.id); if (!t) return none("That topic isn't written yet.");
      if (t.nations) return box("witness", "", '<div class="item"><div class="lbl">' + esc(t.ref.replace(/-/, "\u2013")) + " \u00B7 " + t.nations.length + ' peoples</div><span class="tt">' + esc(t.name) + '</span><p class="u-m4-8 u-fs16 jst-atlas-about">' + esc(t.intro) + "</p>" +
          '<ol class="jst-atlas-stops">' + t.nations.map(function (x, i) { return '<li><button class="jst-xt" data-jst-astop="' + (i + 1) + '"><b>' + (i + 1) + "</b>" + esc(x.n) + '</button> <button class="jst-ref" data-jst-go="' + esc(x.ref) + '">' + esc(x.ref) + '</button><p class="u-fs14 u-m4-8">Today: ' + esc(x.today) + "</p></li>"; }).join("") + "</ol></div>");
      var claims = t.claims || [];
      var rtt = t.route && this.A.routes.filter(function (r) { return r.id === t.route; })[0];
      return box("witness", "", '<div class="item"><span class="tt">' + esc(t.name) + '</span><p class="u-m4-8 u-fs16 jst-atlas-about">' + esc(t.intro) + "</p>" +
          (rtt ? '<p class="u-fs15">' + '<span class="jst-atlas-key route"></span> ' + esc(rtt.name) + ": " + realStops(rtt).map(function (x) { return esc(x.n); }).join(", ") + ' <button class="jst-ref" data-jst-atab="' + rtt.id + '">Open the journey</button></p>' : "") +
          '<p class="u-fs14 sub">Claimed places today, on the map by status: ' + DIG_STATUS.map(function (k) { return '<span class="jst-dig-st ' + k + '">' + k + "</span>"; }).join(" ") + "</p></div>") +
        claims.map(function (c, i) { return digCard(c, i + 1); }).join("") + (t.checked ? '<p class="ctx u-fs13">Last checked ' + esc(t.checked) + ".</p>" : "");
    },
    after: function () {
      var self = this, A = this.A, host = this.el.querySelector("[data-jst-atlas]");
      this.el.querySelectorAll("[data-jst-c]").forEach(function (e) { e.style.background = e.getAttribute("data-jst-c"); });   // route colours
      this.stopPlay(true);
      var pj = this.el.querySelector("[data-jst-aj]");
      if (pj) pj.addEventListener("change", function () { self.st.tab = pj.value || "here"; self.st.pick = 0; self.paint(); });
      this.playBtns();
      this.gripMap();
      if (this._atlas) { this._atlas.destroy(); this._atlas = null; }
      if (!A || !host) return;
      var rt = this.route(), sel = this.sel(), marks, legs = [], pts, kyear = null, kfit = null, self2 = this;
      var srch = this.el.querySelector("[data-jst-asearch]"), res = this.el.querySelector("[data-jst-aresults]");
      if (srch) { srch.value = this.st.q || ""; res.innerHTML = atlasFind(this, srch.value);
        srch.addEventListener("input", function () { self.st.q = srch.value; res.innerHTML = atlasFind(self, srch.value); });
        this.el.querySelector("[data-jst-asearchf]").addEventListener("submit", function (e) { e.preventDefault(); var b = res.querySelector("[data-jst-asel]"); if (b) b.click(); });
        if (this.o.focusSearch) { srch.focus(); this.o.focusSearch = false; } }
      if (sel && sel.kind === "p") {
        var pp = this.pd.places[sel.id]; this._items = pp && pp.ll ? [Object.assign({ id: sel.id }, pp, { n: pp.n.replace(/\s+\d+$/, "") })] : [];
        marks = this._items.map(function (p, i) { var q = atlasXY(A, p.ll); return { x: q.x, y: q.y, ll: p.ll, n: p.n, k: "place", tier: p.tier, i: i + 1 }; });
      } else if (sel && sel.kind === "k") {
        this._items = []; marks = [];
        var rowsK = ((this.K && this.K.polities.features) || []).concat((this.K && this.K.regions.features) || []).filter(function (f) { return f.properties.n === sel.id; });
        if (rowsK.length) { kyear = Math.round((rowsK[0].properties.f + rowsK[0].properties.t) / 2);
          var bb = [90, 180, -90, -180]; rowsK.forEach(function (f) { JSON.stringify(f.geometry.coordinates).replace(/\[(-?[\d.]+),(-?[\d.]+)\]/g, function (m, x, y) { x = +x; y = +y; bb = [Math.min(bb[0], y), Math.min(bb[1], x), Math.max(bb[2], y), Math.max(bb[3], x)]; }); });
          kfit = [[bb[0], bb[1]], [bb[2], bb[3]]].map(function (ll) { var q = atlasXY(A, ll); return { x: q.x, y: q.y, ll: ll }; }); }
      } else if (sel && sel.kind === "t" && (this.topic(sel.id) || {}).nations) {
        /* a gathering (Pentecost): each people's homeland, with a line to where they gathered */
        var tg = this.topic(sel.id); this._topicRoute = null;
        this._items = tg.nations.map(function (x) { return Object.assign({ nation: true }, x); });
        marks = this._items.map(function (x, i) { var q = atlasXY(A, x.ll); return { x: q.x, y: q.y, ll: x.ll, n: x.n.replace(/^(The district of |Visitors from )/, ""), k: "stop", num: i + 1, i: i + 1 }; });
        var to = atlasXY(A, tg.to_ll);
        this._items.forEach(function (x, i) { if (Math.abs(x.ll[0] - tg.to_ll[0]) + Math.abs(x.ll[1] - tg.to_ll[1]) > 0.05) { var q = atlasXY(A, x.ll); legs.push({ x1: q.x, y1: q.y, x2: to.x, y2: to.y, ll1: x.ll, ll2: tg.to_ll, m: "land", i: i + 1 }); } });
        if (tg.year) kyear = tg.year;
      } else if (sel && sel.kind === "t") {
        var tp = this.topic(sel.id), rtt = tp && tp.route && A.routes.filter(function (r) { return r.id === tp.route; })[0], rsT = rtt ? realStops(rtt) : [];
        var onMap = function (c) { return c.lat != null && c.lat >= 6 && c.lat <= 50 && c.lon >= -12 && c.lon <= 62; };   // the map's own area
        var claims = ((tp && tp.claims) || []).filter(onMap);
        this._items = rsT.concat(claims.map(function (c) { return Object.assign({ claim: true, ll: [c.lat, c.lon], n: c.name }, c); }));
        marks = rsT.map(function (st, i) { return { x: st.x, y: st.y, ll: st.ll, n: st.n, k: "stop", num: i + 1, i: i + 1 }; })
          .concat(claims.map(function (c, j) { var q = atlasXY(A, [c.lat, c.lon]); return { x: q.x, y: q.y, ll: [c.lat, c.lon], n: c.name.split(/ \(|:|, | \//)[0].replace(/^"|"$/g, ""), k: "place", tier: DIG_PIN[c.status] || "contested", i: rsT.length + j + 1 }; }));
        if (rtt) { var dn = 0; for (var ti = 1; ti < rtt.stops.length; ti++) { var ta = rtt.stops[ti - 1], tb = rtt.stops[ti]; if (!ta.via) dn++; legs.push({ x1: ta.x, y1: ta.y, x2: tb.x, y2: tb.y, ll1: ta.ll, ll2: tb.ll, m: tb.m, i: dn }); } }
        this._topicRoute = rtt;
      } else if (rt) {
        var rs2 = realStops(rt), done = 0;
        marks = rs2.map(function (s, i) { return { x: s.x, y: s.y, ll: s.ll, n: s.n, k: "stop", num: i + 1, i: i + 1 }; });
        /* legs run through the unnumbered bends too; a leg's i = the stops already reached, so Play shows it when the next stop comes */
        for (var i = 1; i < rt.stops.length; i++) { var a = rt.stops[i - 1], b = rt.stops[i]; if (!a.via) done++;
          legs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, ll1: a.ll, ll2: b.ll, m: b.m, i: done }); }
        this._items = rs2;
      } else {
        this._items = this.places().filter(function (p) { return p.ll; });
        marks = this._items.map(function (p, i) { var q = atlasXY(A, p.ll); return { x: q.x, y: q.y, ll: p.ll, n: p.n, k: "place", tier: p.tier, i: i + 1 }; });
      }
      pts = kfit || marks;
      var hint = host.querySelector(".jst-atlas-hint");
      var py = sel ? null : passageYear(this.K, this.o.ref);
      if (kyear != null) py = { y: kyear, note: sel.kind === "t" ? this.selTitle(sel) + ": " + yearLabel(kyear) : sel.id };
      if (this.o.atlas && rt) { var ry = passageYear(this.K, rt.ranges[0]); if (ry) py = { y: ry.y, note: rt.name + ": " + yearLabel(ry.y) }; }   // the Atlas page: a journey opens on its own date
      if (sel && sel.kind === "t" && this._topicRoute) { var ty = passageYear(this.K, this._topicRoute.ranges[0]); if (ty) py = { y: ty.y, note: this._topicRoute.name + ": " + yearLabel(ty.y) }; }
      if (sel && !py) py = { y: this._atlas && this._atlas.yr || -1000, note: " " };   // a place has no date of its own: keep the slider where it is
      this._atlas = atlasMount(host, A, { marks: marks, legs: legs, color: (rt && rt.color) || (this._topicRoute && sel && sel.kind === "t" && this._topicRoute.color) || (sel && sel.kind === "t" && (this.topic(sel.id) || {}).nations && "#8a3b2a"), label: rt ? rt.name : "Places in " + this.o.ref,
        year: py ? py.y : null, yearNote: py ? (py.note || this.o.ref + ": " + yearLabel(py.y)) : "No date for " + this.o.ref,
        onRoad: function (r) { var b = self.el.querySelector("[data-jst-apick]"); if (!b) return;
          b.innerHTML = '<div class="jst-atlas-card"><div class="lbl">Roman road</div><span class="tt">' + esc((r.n || "Unnamed road").replace(/-/g, " to ")) + '</span><p class="u-fs15 u-m4-8">' + (r.t === "main" ? "A main road" : "A secondary road") + "; the line is " + esc(r.c) + ' (' + ({ certain: "its course is known", conjectured: "its course is worked out from the evidence but not traced on the ground", hypothetical: "a likely link, not traced" }[r.c] || "") + ').</p><p class="sub u-fs13">Itiner-e (de Soto, Pa\u017eout, Brughmans et al., Scientific Data 2025, CC BY 4.0): the roads of the Roman Empire about AD 150. It does not show which roads existed earlier, so at earlier dates on the slider treat it as the later network. Only 2.7% of the road lines are certain.</p></div>'; },
        onTribe: function (tb) { var b = self.el.querySelector("[data-jst-apick]"); if (!b) return;
          var towns = typeof tb.towns === "string" ? JSON.parse(tb.towns) : tb.towns || [], refs = String(tb.r || "").split("; ");
          b.innerHTML = '<div class="jst-atlas-card"><div class="lbl">Tribal land, estimated</div><span class="tt">' + esc(tb.n) + "</span> " + refs.map(function (r) { return '<button class="jst-ref" data-jst-go="' + esc(r) + '">' + esc(r) + "</button>"; }).join(" ") +
            '<p class="u-fs15 u-m4-8">' + (tb.north ? "After failing to hold its first land, Dan took Laish in the far north and renamed it Dan." : "Drawn from the " + tb.k + " towns Joshua gives " + esc(tb.n.replace(/ \(.*\)/, "").replace(/^Dan$/, "Dan")) + " that have a known site: " + esc(towns.join(", ")) + (tb.k > towns.length ? " and more" : "") + ".") + "</p>" +
            '<p class="sub u-fs13">Joshua gives border lines for some tribes and only town lists for others, so these areas are an estimate: each tribe gets the land nearer its own towns than any other tribe\u2019s, kept near its towns and to its side of the Jordan. A town named for two tribes marks their border. Levi received towns, not land (Joshua 13:14). Town sites: OpenBible.info.</p></div>'; },
        onSite: function (st) { var b = self.el.querySelector("[data-jst-apick]"); if (!b) return;
          var kind = { s: "Settlement", f: "Fort", r: "Temple, shrine or church", b: "Tombs or cemetery", p: "Harbour", a: "Archaeological site" }[st.k] || "Site";
          b.innerHTML = '<div class="jst-atlas-card"><div class="lbl">' + kind + '</div><span class="tt">' + esc(st.n) + '</span><p class="u-fs15 u-m4-8" data-jst-sabout></p><p class="u-fs14" data-jst-speriods>In use ' + esc(yearLabel(st.f)) + " to " + esc(yearLabel(st.t)) + '.</p><p class="sub u-fs13">' + outlink("https://pleiades.stoa.org/places/" + st.i, "Pleiades " + st.i) + " (CC BY 3.0)</p></div>";
          getJSON("sites-about.json").then(function (ab) { var p = b.querySelector("[data-jst-sabout]"), q = b.querySelector("[data-jst-speriods]"), r = ab && ab[st.i]; if (!r) return;
            if (p) p.textContent = r[0]; if (q && r[1].length) q.textContent = "Pleiades periods: " + r[1].map(function (j) { return ab._p[j]; }).join("; ") + "."; }); },
        onChange: function (c) { var b = self.el.querySelector("[data-jst-apick]"); if (!b) return;
          b.innerHTML = '<div class="jst-atlas-card"><div class="lbl">Then and now</div><span class="tt">' + esc(c.n) + '</span><p class="u-fs15 u-m4-8">' + esc(c.x) + '</p><p class="sub u-fs13">Source: ' + esc(c.src) + "</p></div>"; },
        onKingdom: function (k, y) { var b = self.el.querySelector("[data-jst-apick]"); if (!b) return;
          b.innerHTML = '<div class="jst-atlas-card"><div class="lbl">In ' + esc(yearLabel(y)) + '</div><span class="tt">' + esc(k.n) + '</span><p class="u-fs14 u-m4-8">' +
            (k.why ? esc(k.why) + " Its area: OpenBible.info, drawn as bands from likely to possible." : "This border: " + esc(yearLabel(k.f)) + " to " + esc(yearLabel(k.t)) + ", from Cliopatria (Seshat), one reading of borders historians still argue over.") +
            "</p>" + (self.o.logos !== false ? atlasLinks(self.at || [], k.n.replace(/^(Kingdom|Kingdoms) of (the )?/, "")) : "") + "</div>"; },   // no Wikipedia, ever (James): his own atlases instead
        onPick: function (i) { self.pickItem(i, true); },
        onHint: function () { hint.classList.add("on"); clearTimeout(self._ht); self._ht = setTimeout(function () { hint.classList.remove("on"); }, 1400); } });
      this._pts = pts; this._atlas.fit(pts);
      if (sel && sel.kind === "p" && this._items[0]) { var it0 = this._items[0]; this._atlas.alts(it0.alt ? it0.alt.map(function (a) { return { n: a[0], ll: [a[1], a[2]], s: a[3], from: it0.ll }; }) : []); }
      var pslot = this.el.querySelector("[data-jst-aprof]");
      if (rt && pslot && CFG.onlineMaps) profileOf(rt.stops.map(function (s) { return { ll: s.ll, n: s.via ? null : s.n, sea: s.m === "sea" }; })).then(function (P) { if (pslot.isConnected) pslot.innerHTML = profileSVG(P, rt.color, pslot.clientWidth) || '<p class="sub u-fs14">No heights here.</p>'; }, function () { pslot.innerHTML = '<p class="sub u-fs14">The heights didn\'t load here.</p>'; });
      if (this.st.pick) this.pickItem(this.st.pick, false);
    },
    /* show one stop or place under the map: its name, the verse (in the first version the text has), and a link to open it */
    pickItem: function (i, fly, quiet) {   // quiet: from a card's own "Show on the map", so no second card above the list
      var self = this, it = (this._items || [])[i - 1], box_ = this.el.querySelector("[data-jst-apick]"), rt = this.route();
      if (!it || !box_) return;
      this.st.pick = i; this._atlas.pick(i);
      var sl = this.sel();
      if (sl && sl.kind === "t") { if (fly) this._atlas.fit([it], 500, 560);
        box_.innerHTML = it.nation ? '<div class="jst-atlas-card"><div class="lbl">' + i + " of " + this._items.length + '</div><span class="tt">' + esc(it.n) + '</span><p class="u-m4-8 u-fs15">' + esc(it.then) + '</p><p class="u-fs15"><b>Today:</b> ' + esc(it.today) + '</p><button class="jst-ref" data-jst-go="' + esc(it.ref) + '">' + esc(it.ref) + "</button></div>" : it.claim ? digCard(it, i) : '<div class="jst-atlas-card"><span class="tt">' + esc(it.n) + '</span> <button class="jst-ref" data-jst-go="' + esc(it.ref) + '">' + esc(it.ref) + "</button></div>"; return; }
      if (sl && sl.kind === "p") { box_.innerHTML = ""; return; }
      if (fly) { var q = rt ? it : atlasXY(this.A, it.ll); this._atlas.fit([q], 500, 560); }
      this.el.querySelectorAll("[data-jst-astop]").forEach(function (b) { b.classList.toggle("on", +b.getAttribute("data-jst-astop") === i); });
      var al = this.o.logos !== false ? this.at || [] : [];
      if (!rt && quiet) { box_.innerHTML = ""; this._atlas.alts(it.alt && it.ll ? it.alt.map(function (a) { return { n: a[0], ll: [a[1], a[2]], s: a[3], from: it.ll }; }) : []); return; }
      if (!rt) { box_.innerHTML = '<div class="jst-atlas-card"><span class="tt">' + esc(it.n) + '</span> <span class="jst-tier ' + it.tier + '">' + TIER[it.tier] + "</span>" + tierNote(it) + (it.b ? '<p class="u-m4-8 u-fs15">' + esc(it.b) + "</p>" : "") + placeRivals(it, true) + photoStrip(it.id) + placeVerses(this.pd, it.id) + atlasLinks(al, it.n) + photoCredits(it.id) + "</div>";
        this._atlas.alts(it.alt && it.ll ? it.alt.map(function (a) { return { n: a[0], ll: [a[1], a[2]], s: a[3], from: it.ll }; }) : []);
        var others = (this._items || []).filter(function (p) { return p !== it && p.ll; });
        if (others.length && CFG.onlineMaps) box_.querySelector(".jst-atlas-card").insertAdjacentHTML("beforeend", '<div class="lbl u-mt14">Height from ' + esc(it.n) + ' to</div><div class="chips">' + others.slice(0, 12).map(function (p) { return '<button class="chip" data-jst-prof2="' + esc(p.id) + '">' + esc(p.n) + "</button>"; }).join("") + '</div><div data-jst-aprof2></div>');
        return; }
      this._atlas.alts([]);
      box_.innerHTML = '<div class="jst-atlas-card"><div class="lbl">Stop ' + i + " of " + realStops(rt).length + '</div><span class="tt">' + esc(it.n) + '</span><p class="u-m4-8 u-fs15" data-jst-averse>…</p><button class="jst-ref" data-jst-go="' + esc(it.ref) + '">' + esc(it.ref) + "</button>" + atlasLinks(al, it.n) + "</div>";
      data.text(it.ref).then(function (rows) {
        var p = box_.querySelector("[data-jst-averse]"); if (!p || self.st.pick !== i) return;
        var t = rows && rows[0] && rows[0].texts, ver = t && (t.LSB ? "LSB" : Object.keys(t)[0]);
        p.innerHTML = ver ? esc(String(t[ver]).replace(/<[^>]+>/g, "")) + ' <span class="sub">(' + ver + ")</span>" : "";
      });
    },
    play: function () {
      var self = this, rt = this.route(); if (!rt || !this._atlas) return;
      var n = this._resumeN || 1;   // Resume carries on from the stop where Pause left it
      this._resumeN = 0; this._playN = n; this._play = true; this.playBtns();
      this._atlas.upTo(n);
      var inLev = rt.stops.every(function (s) { return s.ll[0] >= LEVANT[0] && s.ll[0] <= LEVANT[2] && s.ll[1] >= LEVANT[1] && s.ll[1] <= LEVANT[3]; });
      this._atlas.tilt(true, inLev);
      (function step() {
        if (!self._play) return;
        self._atlas.upTo(n); self.pickItem(n, false);
        var rs = realStops(rt), a = rs[Math.max(0, n - 2)], b = rs[n - 1];
        self._atlas.fit([a, b], 900, 420);
        if (n >= rs.length) { self._pt = setTimeout(function () { self.stopPlay(); self._atlas.fit(self._pts, 900); }, 1600); return; }
        n++; self._playN = n; self._pt = setTimeout(step, 1900);
      })();
    },
    /* the map's height in the panel: drag the bar under it (or arrow keys); remembered on this device, double-click to reset */
    gripMap: function () {
      var g = this.el.querySelector("[data-jst-agrip]"), m = this.el.querySelector("[data-jst-atlas]"); if (!g || !m) return;
      var set = function (h, save) { if (!h) { m.style.height = ""; m.classList.remove("jst-atlas-sized"); } else { h = Math.max(220, Math.min(Math.round(h), Math.round(innerHeight * .92))); m.style.height = h + "px"; m.classList.add("jst-atlas-sized"); }
        if (save) try { if (h) localStorage.setItem("ws.atlasH", h); else localStorage.removeItem("ws.atlasH"); } catch (e) {} };
      var saved = 0; try { saved = +localStorage.getItem("ws.atlasH") || 0; } catch (e) {}
      if (saved) set(saved);
      var y0 = 0, h0 = 0, drag = false;
      g.addEventListener("pointerdown", function (e) { drag = true; y0 = e.clientY; h0 = m.getBoundingClientRect().height; try { g.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
      g.addEventListener("pointermove", function (e) { if (drag) set(h0 + e.clientY - y0); });
      g.addEventListener("pointerup", function () { if (!drag) return; drag = false; set(m.getBoundingClientRect().height, true); });
      g.addEventListener("dblclick", function () { set(0, true); });
      g.addEventListener("keydown", function (e) { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); set(m.getBoundingClientRect().height + (e.key === "ArrowUp" ? -40 : 40), true); } });
    },
    /* the journey's player, right beside the journey list: play/pause, stop, and keep north up (remembered on this device) */
    mediaBtns: function () {
      var nu = !!atlasPrefs().northup;
      return '<span class="jst-atlas-media"><button data-jst-aplay></button><button data-jst-astopplay aria-label="Stop" title="Stop">' + MEDIA_ICON.stop + "</button>" +
        '<button class="jst-atlas-north' + (nu ? " on" : "") + '" data-jst-anorth aria-pressed="' + nu + '" aria-label="Keep north at the top" title="Keep north at the top">' + MEDIA_ICON.north + "</button></span>";
    },
    /* Pause: keep the map where it is (tilted, the route drawn so far) and remember the next stop */
    pausePlay: function () {
      clearTimeout(this._pt); this._play = false; this._resumeN = this._playN || 1; this.playBtns();
    },
    playBtns: function () {
      var b = this.el.querySelector("[data-jst-aplay]"), x = this.el.querySelector("[data-jst-astopplay]");
      var lb = this._play ? "Pause" : this._resumeN ? "Resume" : "Play the journey";
      if (b) { b.innerHTML = this._play ? MEDIA_ICON.pause : MEDIA_ICON.play; b.setAttribute("aria-label", lb); b.title = lb; b.classList.toggle("on", !!(this._play || this._resumeN)); }
      if (x) x.disabled = !(this._play || this._resumeN);
    },
    stopPlay: function (quiet) {
      clearTimeout(this._pt); this._play = false; this._resumeN = 0; this._playN = 0;
      if (this._atlas) this._atlas.tilt(false);
      if (quiet) return;
      if (this._atlas) { this._atlas.tilt(false); this._atlas.upTo(null); }
      this.playBtns();
    },
    click: function (e) {
      var t = e.target.closest("[data-jst-atab]");
      if (t) { e.stopPropagation(); this.stopPlay(true); this.st.tab = t.getAttribute("data-jst-atab"); this.st.pick = 0; this.paint(); return; }
      var z = e.target.closest("[data-jst-az]");
      if (z && this._atlas) { e.stopPropagation(); var k = z.getAttribute("data-jst-az"), host = this.el.querySelector("[data-jst-atlas]");
        if (k === "swipe") { z.classList.toggle("on", !!this._atlas.compare()); } else if (k === "layers") this._atlas.toggleLayers(); else if (k === "in") this._atlas.zoom(1.6); else if (k === "out") this._atlas.zoom(1 / 1.6); else if (k === "fit") this._atlas.fit(this._pts, 400);
        else if (k === "full") { var wr = host.closest("[data-jst-awrap]") || host;   // the map and its column go full screen together
          if (document.fullscreenElement) document.exitFullscreen(); else if (wr.requestFullscreen) wr.requestFullscreen().catch(function () { wr.classList.toggle("jst-atlas-big"); }); else wr.classList.toggle("jst-atlas-big"); }
        return; }
      var as = e.target.closest("[data-jst-asel]");
      if (as) { e.stopPropagation(); this.stopPlay(true); this.st.tab = as.getAttribute("data-jst-asel"); this.st.pick = 0; this.st.q = ""; this.paint(); return; }
      var df = e.target.closest("[data-jst-digfly]");
      if (df && this._atlas) { e.stopPropagation(); var tpp = this._topicRoute ? realStops(this._topicRoute).length : 0, cl = (this._items || []).filter(function (x) { return x.claim; }), k2 = +df.getAttribute("data-jst-digfly"), c2 = this.topic(this.sel().id).claims[k2 - 1];
        var idx = cl.indexOf(cl.filter(function (x) { return x.id === c2.id; })[0]); if (idx > -1) this.pickItem(tpp + idx + 1, true); return; }
      var p2 = e.target.closest("[data-jst-prof2]");
      if (p2) { e.stopPropagation(); var from = (this._items || [])[this.st.pick - 1], to = (this._items || []).filter(function (p) { return p.id === p2.getAttribute("data-jst-prof2"); })[0], slot = this.el.querySelector("[data-jst-aprof2]");
        if (from && to && slot) { slot.innerHTML = '<p class="sub u-fs14">Reading the heights\u2026</p>'; profileOf([{ ll: from.ll, n: from.n }, { ll: to.ll, n: to.n }]).then(function (P) { slot.innerHTML = profileSVG(P, "#8a5a2b", slot.clientWidth); }); } return; }
      var nb = e.target.closest("[data-jst-anorth]");
      if (nb) { e.stopPropagation(); var pf = atlasPrefs(); pf.northup = !pf.northup; atlasSavePrefs(pf); document.querySelectorAll("[data-jst-anorth]").forEach(function (b) { b.classList.toggle("on", pf.northup); b.setAttribute("aria-pressed", pf.northup); }); return; }   // the Maps panel and the Atlas page show one setting   // Play reads it at each leg
      var pl = e.target.closest("[data-jst-aplay]");
      if (pl) { e.stopPropagation(); if (this._play) this.pausePlay(); else this.play(); return; }
      var sp = e.target.closest("[data-jst-astopplay]");
      if (sp) { e.stopPropagation(); this.stopPlay(); if (this._atlas) this._atlas.fit(this._pts, 900); return; }
      var s = e.target.closest("[data-jst-astop]");
      if (s && this._resumeN) { e.stopPropagation(); var si = +s.getAttribute("data-jst-astop"); this._atlas.upTo(si); this.pickItem(si, false); this._resumeN = si; return; }   // paused: look at any stop; Resume goes on from there
      if (s) { e.stopPropagation(); this.stopPlay(); this.pickItem(+s.getAttribute("data-jst-astop"), true); return; }   // the page stays where it is scrolled (James)
      var ph = e.target.closest("[data-jst-photo]");
      if (ph) { e.stopPropagation(); mapViewer({ id: "photo-" + ph.getAttribute("data-jst-photo"), t: ph.getAttribute("data-t"), img: ph.getAttribute("data-jst-photo") }); return; }   // full size in the app, as the art opens
      var m = e.target.closest("[data-jst-pmap]");
      if (m) { e.stopPropagation(); mapViewer(MAPBY[m.getAttribute("data-jst-pmap")]); return; }
      var f = e.target.closest("[data-jst-fly]");
      if (f && this._atlas) { e.stopPropagation(); var id = f.getAttribute("data-jst-fly"), i = (this._items || []).map(function (p) { return p.id; }).indexOf(id);
        if (i > -1) { this.pickItem(i + 1, true, true); var mp2 = this.el.querySelector("[data-jst-atlas]"); if (mp2 && mp2.scrollIntoView) mp2.scrollIntoView({ block: "nearest", behavior: "smooth" }); } return; }
      Panel.prototype.click.call(this, e);
    },
    destroy: function () { this.stopPlay(true); clearTimeout(this._ht); if (this._atlas) { this._atlas.destroy(); this._atlas = null; } Panel.prototype.destroy.call(this); }
  }, {}, function (d) {   // places named plus Bible maps for the verses
    if (!d || !PLACESD || !MAPIDX) return null;
    return placesIn(PLACESD, d.ref).filter(function (p) { return p.ll; }).length + mapsFor(d.ref).length; });

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
        getJSON("relics.json").then(function (d) { self.relics = ((d && d.relics) || []).filter(function (x) { return hits(x.refs); }); }).catch(function () { self.relics = []; }),
        this.o.logos !== false ? data.library().then(function (l) { self.at = l.atlases || []; }).catch(function () { self.at = []; }) : null
      ]);
    },
    view: function () {
      if (!CFG.onlineMaps) return { kick: "Art", title: "Art of this passage", body: none("Pictures from other sites can't show here. Open the app on jayms.com or your desk.") };
      var self = this;
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
          (x.museum ? '<span class="when">' + esc(x.museum) + "</span>" : "") + '<span class="tt">' + esc(x.t) + "</span>" + (x.x ? '<p class="u-m4-8 u-fs15">' + esc(x.x) + "</p>" : "") +
          '<p class="sub u-fs13">' + esc(x.refs.join(" \u00B7 ")) + "</p>" + (self.o.logos !== false ? atlasLinks(self.at || [], x.t.replace(/\s*\(.*\)$/, "")) : "") + "</div>"); };   // no Wikipedia (James): his own atlases instead
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
      h += '<p class="ctx u-fs13">Paintings: works museums have tagged with the scene’s <a href="https://iconclass.org/" target="_blank" rel="noopener">Iconclass</a> subject, from Wikidata, and Wikimedia Commons scene collections; photos on Wikimedia Commons (each Source link has the details). Objects and relics: photos from Wikimedia Commons (licence per file). Tap a picture for full screen.</p>';
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
  /* his own order first, then the fallback order; hidden ones out (hidden is by book, so a hidden one is gone from every passage), but never the core stack */
  function cfgSort(list, idOf, part, fallback) {
    var pos = function (x) { var i = part.order.indexOf(idOf(x)); return i < 0 ? 1e6 : i; };
    return list.filter(function (x) { return CORE_IDS[idOf(x)] || part.hidden.indexOf(idOf(x)) < 0; }).sort(function (a, b) { return pos(a) - pos(b) || fallback(a, b); });
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
    prepare: function () { var self = this, own = this.o.owner, lg = this.o.logos !== false; return Promise.all([data.notes(this.o.ref), lg ? data.shelf() : null, lg ? data.library() : null, data.maps(), own ? data.vaultBooks() : null]).then(function (r) { self.notes = r[0]; self.sh = r[1]; self.lib = r[2]; self.vb = r[4]; }); },
    /* the Vault tab: books in his Obsidian BOOKS vault, for the authors Logos doesn't cover. Books about this Bible book first, then his authors in order */
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
      return '<div class="lbl">' + (this.o.owner ? "My study Bibles" : "Study Bibles") + " in Logos (" + sb.length + ')</div><div class="box v-witness"><div class="item">' + sb.map(function (x) {
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
      var st = this.st, c = this.cfg(), own = this.o.owner, all = (this.notes || []).filter(function (n) { return c.sb.hidden.indexOf("open:" + n.src.code) < 0 && (own || !n.src.own); });
      var have = {}; all.forEach(function (n) { have[n.src.code] = (have[n.src.code] || 0) + 1; });
      var on = st.src || "all", list = all.filter(function (n) { return on === "all" || n.src.code === on; });
      var where = function (n) { var one = (R.book(n.book) || {}).chapters === 1, a = (one ? "" : n.c1 + ":") + n.v1; if (n.c2 === 999) return "Introduction to " + n.book; if (n.c1 === n.c2 && n.v1 === n.v2) return "Verse " + a; return (n.c1 === n.c2 ? "Verses " + a + "-" + n.v2 : a + " to " + n.c2 + ":" + n.v2); };
      var h = '<div class="lbl u-mt14">Study notes (' + all.length + ")</div>";
      if (!all.length) return h + none("No study note covers " + esc(this.o.ref) + ".");
      var srcs = Object.keys(NOTE_SRC).filter(function (k) { return have[k]; });
      if (srcs.length > 1) h += '<div class="chips"><button class="chip' + (on === "all" ? " on" : "") + '" data-jst-nsrc="all">' + (srcs.length > 2 ? "All" : "Both") + '</button>' + srcs.map(function (k) { return '<button class="chip' + (on === k ? " on" : "") + '" data-jst-nsrc="' + k + '">' + esc(NOTE_SRC[k].short) + " (" + have[k] + ")</button>"; }).join("") + "</div>";
      h += list.map(function (n) { return box({ T: "explain", F: "wording", N: "scripture" }[n.src.code] || "apparatus", "", '<div class="item"><span class="when">' + esc(where(n)) + '</span><div class="jst-note">' + noteHTML(n.text) + "</div></div>"); }).join("");
      h += '<p class="ctx u-fs13">' + (on === "all" && srcs.length > 1 ? srcs.map(function (k) { return { T: "Olive edge: Tyndale.", B: "Grey edge: Biblica.", N: "Gold edge: NET.", F: "Purple edge: Faithlife." }[k]; }).join(" ") + " " : "") + srcs.map(function (k) { var x = NOTE_SRC[k]; return '<a href="' + x.url + '" target="_blank" rel="noopener">' + esc(x.name) + "</a> (" + x.licence + ")"; }).join(" and ") + ". A verse in a note opens in the reader.</p>";
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
      var lg = this.o.logos !== false;   // Hide Logos: no Logos lists, just the open study notes (and, on the desk, the vault)
      var TABS = own ? (lg ? [["com", "Commentaries"], ["sb", "Study Bibles"], ["vault", "Vault"], ["other", "Others"]] : [["sb", "Study notes"], ["vault", "Vault"]])
                     : (lg ? [["com", "Commentaries"], ["sb", "Study notes"]] : [["sb", "Study notes"]]);   // maps live in the Maps panel
      var tab = TABS.some(function (t) { return t[0] === SHELF_TAB; }) ? SHELF_TAB : TABS[0][0];
      var tabs = '<div class="chips u-mb10">' + TABS.map(function (t) { return '<button class="chip' + (tab === t[0] ? " on" : "") + '" data-jst-stab="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>";
      var kick = (own ? "My shelf" : "Shelf") + (segs.length ? " \u00B7 " + segs.map(function (s) { return bookLabel(s.book); }).join(", ") : "");
      if (tab === "sb") return { kick: kick, title: own && lg ? "Study Bibles" : "Study notes", body: tabs + (lg ? this.studyBiblesHTML() : "") + this.notesHTML() };
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
      var notCore = function (x) { return !CORE_IDS[x.id]; };
      segs.forEach(function (s) {
        /* the core stack: the same layers on every book; a volume split by chapters shows the part the passage is in */
        var core = (CORE[s.book] || []).filter(function (x) { return !x.ch || (s.c1 <= x.ch[1] && (s.c2 || s.c1) >= x.ch[0]); });
        var all = order(sh[s.book] || []).filter(notCore), tr = all.filter(mine), rest = all.filter(function (x) { return !mine(x); });
        if (segs.length > 1) h += '<div class="lbl">' + esc(bookLabel(s.book)) + "</div>";
        if (core.length) h += '<div class="lbl">Core stack</div>' + core.map(function (x) {
          return box("witness", "", '<div class="item"><span class="when">' + esc(x.layer) + '</span><span class="tt">' + esc(x.title) + '</span><span class="sub">' + esc(shortBy(x.by)) + "</span>" +
            outlink(x.at ? logosRes(x.id, s) : R.logos(x.id), "Open") + "</div>"); }).join("");
        if (tr.length) h += '<div class="lbl">' + (own ? "My first picks" : "First picks") + "</div>" + tr.map(card(s)).join("");
        if (rest.length) h += '<div class="lbl">' + (tr.length ? "The rest of the shelf" : "On " + esc(bookLabel(s.book))) + " (" + rest.length + ")</div>" + rest.map(card(s)).join("");
        if (!all.length && !core.length) h += none((own ? "You don't own" : "No") + " commentary on " + esc(bookLabel(s.book)) + " in Logos.");
      });
      var s0 = segs[0], wide = order((sh[R.book(s0.book) && R.book(s0.book).order < 39 ? "_ot" : "_nt"] || []).concat(sh._bible || [])).filter(notCore);
      if (wide.length) h += '<details class="jst-past"><summary class="lbl">Whole Bible and whole Testament (' + wide.length + ")</summary>" + wide.map(card(s0)).join("") + "</details>";
      h += '<p class="ctx">' + (own ? "Each link opens Logos at the start of the passage in that book (the topical books open at their start). Core stack: always shown. First picks: ranked in Config, or by your authors."
                                    : "Each link opens the book in Logos at this passage. If you don't own it, it opens the book's page on logos.com.") + (hidden ? " " + hidden + " hidden in Config." : "") + "</p>";
      return { kick: kick, title: "Commentaries", body: h };
    }
  }, { owner: false, config: null }, function (d) { return d && d.ref in NOTEN ? NOTEN[d.ref] : null; });

  // ------------------------------------------------------------------ ShelfConfig
  /* Config for the shelf: rank and add authors, rank and hide commentaries (every one he owns: a hidden one is gone from every book), rank and hide study Bibles.
     options: config() -> the saved settings (as shelfCfg reads them)
     sends:   shelfcfg ({key: "authors"|"commentaries"|"studyBibles"|"dock", value}) */
  define("ShelfConfig", { id: "config", label: "Config", name: "Shelf settings", icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>', owner: true }, {
    prepare: function () { var self = this; return Promise.all([data.shelf(), data.library(), data.vaultBooks()]).then(function (r) { self.sh = r[0]; self.lib = r[1]; self.vb = r[2];
      /* an author with no book in Logos or the BOOKS vault doesn't belong on the list: a saved list drops them once both are loaded */
      var saved = self.o.config && self.o.config(), names = saved && saved.authors && saved.authors.names, lib = (r[1] && r[1].lib) || [], vba = (r[2] && r[2].authors) || [];
      if (names && names.length && r[2]) {
        var keep = names.filter(function (nm) { return lib.some(function (x) { return byAuthor(nm, x[2]); }) || vba.some(function (a) { return byAuthor(nm, a.by); }); });
        if (keep.length < names.length) self.emit("shelfcfg", { key: "authors", value: { names: keep } });
      } }); },
    rowHTML: function (i, n, label, sub, hidden, kind, core) {
            return '<div class="askrow u-gap6 u-m3' + (hidden ? " u-faded" : "") + '" data-jst-crow="' + esc((label + " " + sub).toLowerCase()) + '"><span class="u-minw22">' + (hidden ? "" : (i + 1) + ".") + '</span><span class="u-flex1">' + esc(label) + (sub ? ' <span class="sub">' + esc(sub) + "</span>" : "") + "</span>" +
        (hidden ? "" : '<button class="btn" data-jst-cmv="' + kind + "|" + i + '|-1"' + (i ? "" : " disabled") + ' aria-label="Move up">\u2191</button><button class="btn" data-jst-cmv="' + kind + "|" + i + '|1"' + (i < n - 1 ? "" : " disabled") + ' aria-label="Move down">\u2193</button>') +
        (core ? '<span class="sub">Core</span></div>' : '<button class="btn" data-jst-chide="' + kind + "|" + i + "|" + (hidden ? 1 : 0) + '">' + (kind === "authors" ? "\u00D7" : hidden ? "Show" : "Hide") + "</button></div>");
    },
    /* the list a section works on, in its current order: shown ones first (ranked), then hidden ones */
    lists: function () {
      var c = shelfCfg(this.o), sh = this.sh || {}, lib = this.lib || {}, q = data.segs(this.o.ref)[0];
      var names = c.authors, rank = function (by) { var r = authorRank(names, by); return r < 0 ? 999 : r; };
      var com = [], seen = {};
      /* the core stack first, then every commentary on the shelf, each once */
      [].concat.apply([], Object.keys(CORE).map(function (b) { return CORE[b]; }).concat(Object.keys(sh).map(function (b) { return sh[b]; })))
        .forEach(function (x) { if (!seen[x.id]) { seen[x.id] = 1; com.push(x); } });
      var comShown = cfgSort(com, function (x) { return x.id; }, c.com, function (a, b) { return rank(a.by) - rank(b.by) || (b.year || 0) - (a.year || 0); });
      var sbAll = (lib.studyBibles || []).map(function (x) { return { id: x[0], t: x[1], by: x[2] }; }).concat(OPEN_SB.map(function (x) { return { id: x[0], t: x[1], by: "" }; }));
      var sbShown = cfgSort(sbAll, function (x) { return x.id; }, c.sb, function (a, b) { return rank(a.by) - rank(b.by) || String(a.t).localeCompare(b.t); });
      var hid = function (part) { return function (x) { return !CORE_IDS[x.id] && part.hidden.indexOf(x.id) > -1; }; };
      return { c: c, book: q ? q.book : "", com: { shown: comShown, hidden: com.filter(hid(c.com)) },
               sb: { shown: sbShown, hidden: sbAll.filter(hid(c.sb)) } };
    },
    view: function () {
      var st = this.st, sec = st.sec || "authors", L2 = this.lists(), self = this, lib = (this.lib && this.lib.lib) || [];
      var tabs = '<div class="chips u-mb10">' + [["authors", "Authors"], ["com", "Commentaries"], ["sb", "Study Bibles"], ["dock", "Buttons"]].map(function (t) { return '<button class="chip' + (sec === t[0] ? " on" : "") + '" data-jst-csec="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>";
      var h = tabs;
      if (sec === "authors") {
        var vba = (this.vb && this.vb.authors) || [];
        var names = L2.c.authors, count = function (nm) { return lib.filter(function (x) { return byAuthor(nm, x[2]); }).length; },
            vcount = function (nm) { return vba.filter(function (a) { return byAuthor(nm, a.by); }).reduce(function (n, a) { return n + a.books.length; }, 0); },
            label = function (nm) { var n = count(nm), v = vcount(nm); return (n ? n + " in Logos" : "none in Logos") + (v ? " \u00B7 " + v + " in your vault" : ""); };
        h += '<p class="ctx">Your authors, in order. Higher shows first on the shelf and lifts their commentaries and study Bibles.</p>';
        h += names.map(function (nm, i) { var n = count(nm); return self.rowHTML(i, names.length, nm, label(nm), false, "authors"); }).join("");
        h += '<div class="ask"><label class="lbl">Add an author</label><input class="jst-in" data-jst-anew placeholder="Michael Heiser, or Heiser, Michael"><div class="askrow"><button class="btn" data-jst-aadd>Add</button><span class="jst-msg">' + esc(st.msg || "") + "</span></div></div>";
      } else if (sec === "dock") {
        /* the side buttons: show or hide each one (Config itself always stays) */
        var dk = (this.o.config && this.o.config().dock) || { tools: [], hidden: [] };
        h += '<p class="ctx">The side buttons. Hide the ones you don\'t use.</p>';
        h += dk.tools.map(function (t) { var off = dk.hidden.indexOf(t.id) > -1;
          return '<div class="askrow u-gap6 u-m3' + (off ? " u-faded" : "") + '"><span class="u-flex1">' + esc(t.label) + ' <span class="sub">' + esc(t.name) + '</span></span><button class="btn" data-jst-dock="' + esc(t.id) + '">' + (off ? "Show" : "Hide") + "</button></div>"; }).join("");
      } else {
        var part = sec === "com" ? L2.com : L2.sb;
        h += '<p class="ctx">' + (sec === "com" ? "Every commentary you own (" + part.shown.length + "). Hide one and it's gone from every book. The order you set holds on every book. Core ones are always shown." : "Your study Bibles, Logos and open. Hide one to drop it from the shelf.") + "</p>";
        h += '<input class="jst-in u-mb10" data-jst-cfind placeholder="Find a title or author">';
        h += part.shown.map(function (x, i) { return self.rowHTML(i, part.shown.length, x.title || x.t, sec === "com" ? [x.series || shortBy(x.by), x.year].filter(Boolean).join(" \u00B7 ") : shortBy(x.by), false, sec, !!CORE_IDS[x.id]); }).join("");
        if (part.hidden.length) h += '<div class="lbl u-mt10">Hidden (' + part.hidden.length + ")</div>" + part.hidden.map(function (x, i) { return self.rowHTML(i, 0, x.title || x.t, "", true, sec); }).join("");
        if (st.msg) h += '<p class="jst-msg">' + esc(st.msg) + "</p>";
      }
      return { kick: "Config", title: "Shelf settings", body: h };
    },
    after: function () {
      var f = this.el.querySelector("[data-jst-cfind]"), el = this.el, st = this.st; if (!f) return;
      var run = function () { var q = f.value.trim().toLowerCase(); st.find = f.value; el.querySelectorAll("[data-jst-crow]").forEach(function (r) { r.hidden = !!q && r.getAttribute("data-jst-crow").indexOf(q) < 0; }); };
      f.value = st.find || ""; f.addEventListener("input", run); if (st.find) run();
    },
    save: function (key, value, msg) { this.st.msg = msg || ""; this.emit("shelfcfg", { key: key, value: value }); this.paint(); },
    click: function (e) {
      var t = e.target, sc = t.closest("[data-jst-csec]"), mv = t.closest("[data-jst-cmv]"), hd = t.closest("[data-jst-chide]"), ad = t.closest("[data-jst-aadd]");
      if (sc) { e.stopPropagation(); this.st.sec = sc.getAttribute("data-jst-csec"); this.st.msg = ""; this.paint(); return; }
      var dkb = t.closest("[data-jst-dock]");
      if (dkb) { e.stopPropagation(); var id = dkb.getAttribute("data-jst-dock"), cur0 = ((this.o.config && this.o.config().dock) || {}).hidden || [], was = cur0.indexOf(id) > -1;
        return this.save("dock", { hidden: was ? cur0.filter(function (x) { return x !== id; }) : cur0.concat([id]) }); }
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
