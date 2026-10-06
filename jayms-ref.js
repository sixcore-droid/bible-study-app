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
  var LOGOS_ID = { LSB: "LGCYSTNDRDBBLSB", NLT: "1.0.171", ESV: "1.0.710", NET: "NETBIBLE2ED", KJV: "KJV1900", CSB: "CSB", NASB: "NASB2020", MSG: "1.0.165", NIV: "NIV2011", NKJV: "1.0.30" };
  function logosRef(s) {
    var bk = book(s.book), tok = REFLY_BOOK[s.book] || s.book.replace(/\s+/g, ""), one = bk && bk.chapters === 1, r;
    if (s.v1 === 1 && s.v2 === 999) r = s.c1 === s.c2 ? (one ? "1" : String(s.c1)) : s.c1 + "-" + s.c2;
    else if (s.c1 !== s.c2) r = s.c1 + "." + s.v1 + "-" + s.c2 + "." + s.v2;
    else r = (one ? "1." : s.c1 + ".") + s.v1 + (s.v2 !== s.v1 ? "-" + s.v2 : "");
    return "Bible." + tok + r;
  }
  /* any Logos resource (a Bible, commentary, study Bible) opened in the app, at a passage when one is given */
  function logos(resourceId, seg) { return "logosres:" + String(resourceId).replace(/^LLS:/i, "") + (seg ? ";ref=" + logosRef(seg) : ""); }
  /* the number of verses in every chapter (English numbering), written by scripts/build-versecounts.py */
  var VERSES = /*VERSES*/{"Genesis":[31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26],"Exodus":[22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38],"Leviticus":[17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34],"Numbers":[54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13],"Deuteronomy":[46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12],"Joshua":[18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33],"Judges":[36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25],"Ruth":[22,23,18,22],"1 Samuel":[28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13],"2 Samuel":[27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25],"1 Kings":[53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53],"2 Kings":[18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30],"1 Chronicles":[54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30],"2 Chronicles":[17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23],"Ezra":[11,70,13,24,17,22,28,36,15,44],"Nehemiah":[11,20,32,23,19,19,73,18,38,39,36,47,31],"Esther":[22,23,15,17,14,14,10,17,32,3],"Job":[22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17],"Psalm":[6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6],"Proverbs":[33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31],"Ecclesiastes":[18,26,22,16,20,12,29,17,18,20,10,14],"Song of Songs":[17,17,11,16,16,13,13,14],"Isaiah":[31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24],"Jeremiah":[19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34],"Lamentations":[22,22,66,22,22],"Ezekiel":[28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35],"Daniel":[21,49,30,37,31,28,28,27,27,21,45,13],"Hosea":[11,23,5,19,15,11,16,14,17,15,12,14,16,9],"Joel":[20,32,21],"Amos":[15,16,15,13,27,14,17,14,15],"Obadiah":[21],"Jonah":[17,10,10,11],"Micah":[16,13,12,13,15,16,20],"Nahum":[15,13,19],"Habakkuk":[17,20,19],"Zephaniah":[18,15,20],"Haggai":[15,23],"Zechariah":[21,13,10,14,11,15,14,23,17,12,17,14,9,21],"Malachi":[14,17,18,6],"Matthew":[25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20],"Mark":[45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20],"Luke":[80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53],"John":[51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25],"Acts":[26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31],"Romans":[32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27],"1 Corinthians":[31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24],"2 Corinthians":[24,17,18,18,21,18,16,24,15,18,33,21,14],"Galatians":[24,21,29,31,26,18],"Ephesians":[23,22,21,32,33,24],"Philippians":[30,30,21,23],"Colossians":[29,23,25,18],"1 Thessalonians":[10,20,13,18,28],"2 Thessalonians":[12,17,18],"1 Timothy":[20,15,16,16,25,21],"2 Timothy":[18,26,17,22],"Titus":[16,15,15],"Philemon":[25],"Hebrews":[14,18,19,16,14,20,28,13,28,39,40,29,25],"James":[27,26,18,17,20],"1 Peter":[25,25,22,19,14],"2 Peter":[21,22,18],"1 John":[10,29,24,21,21],"2 John":[13],"3 John":[15],"Jude":[25],"Revelation":[20,29,22,11,14,17,17,13,21,11,19,18,18,20,8,21,18,24,21,15,27,21]}/*ENDVERSES*/;
  /* "" when every verse in the reference exists, else a short reason: "Revelation 22 has 21 verses." */
  function check(segs) {
    if (typeof segs === "string") segs = parse(segs);
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i], bk = book(s.book), counts = VERSES[s.book];
      if (!bk) return "";
      if (s.c1 < 1 || s.c2 > bk.chapters) return (bk.ib || bk.name) + " has " + bk.chapters + " chapter" + (bk.chapters > 1 ? "s" : "") + ".";
      if (!counts) continue;
      var last1 = counts[s.c1 - 1], last2 = counts[s.c2 - 1], ch = bk.chapters === 1 ? bk.name : bk.name + " " + s.c1;
      if (s.v1 < 1 || (s.v2 !== 999 && s.v1 > last1)) return ch + " has " + last1 + " verses.";
      if (s.v2 !== 999 && s.v2 > last2) return (bk.chapters === 1 ? bk.name : bk.name + " " + s.c2) + " has " + last2 + " verses.";
    }
    return "";
  }
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

  global.JaymsRef = { books: ROWS, book: book, parse: parse, format: format, key: key, overlap: overlap, chapters: chapters, contains: contains, refly: refly, logos: logos, logosRef: logosRef, refsIn: refsIn, check: check, verses: function (b, c) { return (VERSES[b] || [])[c - 1] || 0; }, version: "1.4.0" };
})(typeof window !== "undefined" ? window : this);
