/*!
 * JaymsRef — one reference module for every Bible tool. A passage is always addressed by its reference;
 * every file, saved note and link derives from it. The Python build reads the BOOKS table out of this file,
 * so the table lives in exactly one place.
 *
 *   JaymsRef.parse("Daniel 10:13, 20-21")  -> [{book:"Daniel", c1:10, v1:13, c2:10, v2:13}, {..., v1:20, v2:21}]
 *   JaymsRef.key("Ps 82")                  -> "psalm-82"         (the canonical key: notes, done marks, files)
 *   JaymsRef.format(segs)                  -> "Psalm 82"
 *   JaymsRef.book("Song of Solomon")       -> the book's row
 *   JaymsRef.chapters(segs)                -> [{book, c}] every chapter a passage touches
 *   JaymsRef.overlap(a, b)                 -> do two segments share a verse
 *
 * Verse numbers are English numbering throughout. The build converts the Hebrew and Greek data to English
 * with the versification map, so nothing downstream ever has to think about it.
 * v2 = 999 means "to the end of the chapter".
 */
(function (global) {
  "use strict";

  /* name, slug (site + outline + data files), il (interlinear-data file name), ib (Interleaved Bible's book key),
     chapters (English), aliases (lower case). */
  var BOOKS = /*BOOKS*/[
    ["Genesis","genesis","genesis","Genesis",50,["gen","gn","ge"]],
    ["Exodus","exodus","exodus","Exodus",40,["exod","ex","exo"]],
    ["Leviticus","leviticus","leviticus","Leviticus",27,["lev","lv"]],
    ["Numbers","numbers","numbers","Numbers",36,["num","nm","nu"]],
    ["Deuteronomy","deuteronomy","deuteronomy","Deuteronomy",34,["deut","dt","de"]],
    ["Joshua","joshua","joshua","Joshua",24,["josh","jos"]],
    ["Judges","judges","judges","Judges",21,["judg","jdg"]],
    ["Ruth","ruth","ruth","Ruth",4,["ru","rth"]],
    ["1 Samuel","1-samuel","1samuel","1 Samuel",31,["1 sam","1sam","1 sa","i samuel"]],
    ["2 Samuel","2-samuel","2samuel","2 Samuel",24,["2 sam","2sam","2 sa","ii samuel"]],
    ["1 Kings","1-kings","1kings","1 Kings",22,["1 kgs","1kgs","1 ki","i kings"]],
    ["2 Kings","2-kings","2kings","2 Kings",25,["2 kgs","2kgs","2 ki","ii kings"]],
    ["1 Chronicles","1-chronicles","1chronicles","1 Chronicles",29,["1 chr","1chr","1 chron","i chronicles"]],
    ["2 Chronicles","2-chronicles","2chronicles","2 Chronicles",36,["2 chr","2chr","2 chron","ii chronicles"]],
    ["Ezra","ezra","ezra","Ezra",10,["ezr"]],
    ["Nehemiah","nehemiah","nehemiah","Nehemiah",13,["neh"]],
    ["Esther","esther","esther","Esther",10,["esth","est"]],
    ["Job","job","job","Job",42,["jb"]],
    ["Psalm","psalms","psalms","Psalms",150,["psalms","ps","psa","pss","psalm"]],
    ["Proverbs","proverbs","proverbs","Proverbs",31,["prov","prv","pr"]],
    ["Ecclesiastes","ecclesiastes","ecclesiastes","Ecclesiastes",12,["eccl","eccles","qoheleth"]],
    ["Song of Songs","song-of-solomon","songofsolomon","Song of Solomon",8,["song of solomon","song","sos","canticles"]],
    ["Isaiah","isaiah","isaiah","Isaiah",66,["isa","is"]],
    ["Jeremiah","jeremiah","jeremiah","Jeremiah",52,["jer"]],
    ["Lamentations","lamentations","lamentations","Lamentations",5,["lam"]],
    ["Ezekiel","ezekiel","ezekiel","Ezekiel",48,["ezek","eze"]],
    ["Daniel","daniel","daniel","Daniel",12,["dan","dn"]],
    ["Hosea","hosea","hosea","Hosea",14,["hos"]],
    ["Joel","joel","joel","Joel",3,["jl"]],
    ["Amos","amos","amos","Amos",9,["am"]],
    ["Obadiah","obadiah","obadiah","Obadiah",1,["obad","ob"]],
    ["Jonah","jonah","jonah","Jonah",4,["jon"]],
    ["Micah","micah","micah","Micah",7,["mic"]],
    ["Nahum","nahum","nahum","Nahum",3,["nah"]],
    ["Habakkuk","habakkuk","habakkuk","Habakkuk",3,["hab"]],
    ["Zephaniah","zephaniah","zephaniah","Zephaniah",3,["zeph"]],
    ["Haggai","haggai","haggai","Haggai",2,["hag"]],
    ["Zechariah","zechariah","zechariah","Zechariah",14,["zech"]],
    ["Malachi","malachi","malachi","Malachi",4,["mal"]],
    ["Matthew","matthew","matthew","Matthew",28,["matt","mt"]],
    ["Mark","mark","mark","Mark",16,["mk","mrk"]],
    ["Luke","luke","luke","Luke",24,["lk","luk"]],
    ["John","john","john","John",21,["jn","jhn"]],
    ["Acts","acts","acts","Acts",28,["ac"]],
    ["Romans","romans","romans","Romans",16,["rom","rm"]],
    ["1 Corinthians","1-corinthians","1corinthians","1 Corinthians",16,["1 cor","1cor","i corinthians"]],
    ["2 Corinthians","2-corinthians","2corinthians","2 Corinthians",13,["2 cor","2cor","ii corinthians"]],
    ["Galatians","galatians","galatians","Galatians",6,["gal"]],
    ["Ephesians","ephesians","ephesians","Ephesians",6,["eph"]],
    ["Philippians","philippians","philippians","Philippians",4,["phil","php"]],
    ["Colossians","colossians","colossians","Colossians",4,["col"]],
    ["1 Thessalonians","1-thessalonians","1thessalonians","1 Thessalonians",5,["1 thess","1thess","1 th"]],
    ["2 Thessalonians","2-thessalonians","2thessalonians","2 Thessalonians",3,["2 thess","2thess","2 th"]],
    ["1 Timothy","1-timothy","1timothy","1 Timothy",6,["1 tim","1tim"]],
    ["2 Timothy","2-timothy","2timothy","2 Timothy",4,["2 tim","2tim"]],
    ["Titus","titus","titus","Titus",3,["tit"]],
    ["Philemon","philemon","philemon","Philemon",1,["phlm","philem","phm"]],
    ["Hebrews","hebrews","hebrews","Hebrews",13,["heb"]],
    ["James","james","james","James",5,["jas","jm"]],
    ["1 Peter","1-peter","1peter","1 Peter",5,["1 pet","1pet","1 pt"]],
    ["2 Peter","2-peter","2peter","2 Peter",3,["2 pet","2pet","2 pt"]],
    ["1 John","1-john","1john","1 John",5,["1 jn","1jn","1 jhn"]],
    ["2 John","2-john","2john","2 John",1,["2 jn","2jn"]],
    ["3 John","3-john","3john","3 John",1,["3 jn","3jn"]],
    ["Jude","jude","jude","Jude",1,["jud"]],
    ["Revelation","revelation","revelation","Revelation",22,["rev","rv","apocalypse"]]
  ]/*END*/;

  var BY = {}, ROWS = BOOKS.map(function (b, i) {
    var row = { name: b[0], slug: b[1], il: b[2], ib: b[3], chapters: b[4], order: i, aliases: b[5] };
    [b[0], b[1], b[2], b[3]].concat(b[5]).forEach(function (a) { BY[String(a).toLowerCase().replace(/\./g, "")] = row; });
    return row;
  });

  function book(name) { return BY[String(name || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim()] || null; }

  function seg(b, c1, v1, c2, v2) { return { book: b, c1: c1, v1: v1, c2: c2, v2: v2 }; }

  /* "Daniel 10:13, 20-21" · "Jude 6; 2 Peter 2:4" · "Psalm 81:1-82:8" · "Psalm 82" */
  function parse(text) {
    var out = [], b = null, chap = null;
    String(text || "").split(/\s*[;·]\s*/).forEach(function (part) {
      var m = part.match(/^((?:[1-3]|i{1,3})?\s*[A-Za-z][A-Za-z. ]*?)\s+(\d.*)$/i), rest = part;
      /* a bare book name ("Obadiah", "Romans") is the whole book */
      if (!m && book(part)) { b = book(part); chap = null; out.push(seg(b.name, 1, 1, b.chapters, 999)); return; }
      if (m && book(m[1])) { b = book(m[1]); rest = m[2]; chap = null; }
      if (!b) return;
      var hadColon = rest.indexOf(":") > -1;
      rest.split(/\s*,\s*/).forEach(function (bit) {
        var a;
        if (b.chapters === 1 && bit.indexOf(":") < 0 && (a = bit.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/))) {
          out.push(seg(b.name, 1, +a[1], 1, +(a[2] || a[1]))); chap = 1; return;
        }
        if ((a = bit.match(/^(\d+):(\d+)(?:\s*[-–]\s*(?:(\d+):)?(\d+))?$/))) {
          chap = +a[1]; var c2 = a[3] ? +a[3] : chap, v2 = a[4] ? +a[4] : +a[2];
          out.push(seg(b.name, chap, +a[2], c2, v2)); chap = c2; return;
        }
        if ((a = bit.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/))) {
          if (chap !== null && hadColon) { out.push(seg(b.name, chap, +a[1], chap, +(a[2] || a[1]))); return; }
          out.push(seg(b.name, +a[1], 1, +(a[2] || a[1]), 999)); chap = +a[1];
        }
      });
    });
    return out;
  }

  /* segments -> "Daniel 10:13, 20-21; 2 Peter 2:4" */
  /* keyForm: the old spelling that note keys were built from ("Jude 1"); the display drops the "1" for a whole one-chapter book */
  function format(segs, keyForm) {
    if (typeof segs === "string") segs = parse(segs);
    var out = [], lastBook = null, lastChap = null;
    segs.forEach(function (s) {
      var bk = book(s.book), single = bk && bk.chapters === 1, txt;
      if (s.v1 === 1 && s.v2 === 999) txt = single && !keyForm ? "" : s.c1 === s.c2 ? String(s.c1) : s.c1 + "-" + s.c2;
      else if (s.c1 !== s.c2) txt = s.c1 + ":" + s.v1 + "-" + s.c2 + ":" + s.v2;
      /* in a key, verse 1 alone of a one-chapter book is "1:1", so it can't share the whole book's key ("jude-1") */
      else txt = (single ? (keyForm && s.v1 === 1 && s.v2 === 1 ? "1:" : "") : s.c1 + ":") + s.v1 + (s.v2 !== s.v1 ? "-" + s.v2 : "");
      if (s.book === lastBook && s.c1 === lastChap && s.c1 === s.c2 && !(s.v1 === 1 && s.v2 === 999)) out[out.length - 1] += ", " + (single ? txt : txt.replace(/^\d+:/, ""));
      else out.push(((s.book === lastBook ? "" : s.book + " ") + txt).trim());
      lastBook = s.book; lastChap = s.c2;
    });
    return out.join("; ").replace(/; (\d)/g, "; $1");
  }

  function key(ref) {
    var segs = typeof ref === "string" ? parse(ref) : ref;
    var txt = segs.length ? format(segs, true) : String(ref);
    return txt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  var pos = function (c, v) { return c * 1000 + v; };
  function overlap(a, b) { return a.book === b.book && pos(a.c1, a.v1) <= pos(b.c2, b.v2) && pos(b.c1, b.v1) <= pos(a.c2, a.v2); }
  function chapters(segs) {
    if (typeof segs === "string") segs = parse(segs);
    var out = [], seen = {};
    segs.forEach(function (s) { for (var c = s.c1; c <= s.c2; c++) { var k = s.book + "|" + c; if (!seen[k]) { seen[k] = 1; out.push({ book: s.book, c: c }); } } });
    return out;
  }
  function contains(segs, b, c, v) { return segs.some(function (s) { return s.book === b && pos(s.c1, s.v1) <= pos(c, v) && pos(c, v) <= pos(s.c2, s.v2); }); }

  /* Logos links. A logosres: link opens the Logos app itself at the passage (Logos registers the scheme on James's Mac);
     ref.ly only sends the browser to Logos on the web, so it is the fallback for a version not in his library.
     A list ("Daniel 10:13, 20-21") gets one link per part; Song of Songs must be "Song".
     Checked 3 Oct 2026 by opening links in Logos: LSB 1 Kings 22:19, Song 2:4, NLT Psalm 82:1-8, a study Bible at 1 Kings 22:19. */
  var LOGOS_ID = { LSB: "LGCYSTNDRDBBLSB", NLT: "1.0.171", ESV: "1.0.710", NET: "NETBIBLE2ED", KJV: "KJV1900", CSB: "CSB", NASB: "NASB2020", NIV: "NIV2011", NKJV: "1.0.30" };
  function logosRef(s) {
    var bk = book(s.book), tok = REFLY_BOOK[s.book] || s.book.replace(/\s+/g, ""), one = bk && bk.chapters === 1, r;
    if (s.v1 === 1 && s.v2 === 999) r = s.c1 === s.c2 ? (one ? "1" : String(s.c1)) : s.c1 + "-" + s.c2;
    else if (s.c1 !== s.c2) r = s.c1 + "." + s.v1 + "-" + s.c2 + "." + s.v2;
    else r = (one ? "1." : s.c1 + ".") + s.v1 + (s.v2 !== s.v1 ? "-" + s.v2 : "");
    return "Bible." + tok + r;
  }
  /* any Logos resource (a Bible, commentary, study Bible) opened in the app, at a passage when one is given */
  function logos(resourceId, seg) { return "logosres:" + String(resourceId).replace(/^LLS:/i, "") + (seg ? ";ref=" + logosRef(seg) : ""); }
  var REFLY_BOOK = { "Song of Songs": "Song" };   // Logos's own token for a book, where it isn't the name without spaces
  /* "Open in Logos" links for a passage in a given version: [{label, url}] (one per segment) */
  function refly(segs, translation) {
    if (typeof segs === "string") segs = parse(segs);
    translation = (translation || "LSB").toUpperCase();
    return segs.map(function (s) {
      /* a version he doesn't have in Logos (BSB) opens the LSB in the app; ref.ly would go to Logos on the web */
      return { label: format([s]), url: logos(LOGOS_ID[translation] || LOGOS_ID.LSB, s) };
    });
  }

  /* references written in prose ("Ps 82:6", "Deut. 32:8-9", "Psalm 82"): [{seg, index}]. Same rules as build-data.py refs_in. */
  var PROSE = null;
  function refsIn(text) {
    if (!PROSE) {
      var names = Object.keys(BY).concat(ROWS.map(function (r) { return r.name.toLowerCase(); }));
      names = names.filter(function (n, i) { return names.indexOf(n) === i; }).sort(function (a, b) { return b.length - a.length; });
      PROSE = new RegExp("\\b(" + names.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"); }).join("|") + ")\\.?\\s+(\\d{1,3})(?::(\\d{1,3})(?:\\s*[-\u2013]\\s*(\\d{1,3})(?::(\\d{1,3}))?)?)?(?![\\d:])", "gi");
    }
    var out = [], m; PROSE.lastIndex = 0;
    while ((m = PROSE.exec(String(text || "")))) {
      /* a book name in prose is capitalised: "is 2 ways", "I am 5" are not Isaiah 2 or Amos 5 */
      if (/^[a-z]/.test(m[1])) continue;
      var bk = book(m[1]); if (!bk) continue;
      var c = +m[2], s;
      if (bk.chapters === 1 && !m[3]) s = seg(bk.name, 1, c, 1, c);
      else if (m[3]) { var v1 = +m[3]; s = m[5] ? seg(bk.name, c, v1, +m[4], +m[5]) : seg(bk.name, c, v1, c, m[4] ? +m[4] : v1); }
      else { if (c > bk.chapters) continue; s = seg(bk.name, c, 1, c, 999); }
      out.push({ seg: s, index: m.index });
    }
    return out;
  }

  global.JaymsRef = { books: ROWS, book: book, parse: parse, format: format, key: key, overlap: overlap, chapters: chapters, contains: contains, refly: refly, logos: logos, logosRef: logosRef, refsIn: refsIn, version: "1.3.2" };
})(typeof window !== "undefined" ? window : this);
