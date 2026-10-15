#!/usr/bin/env python3
"""Build shelf.json: James's Logos commentaries, by the Bible book they cover.

Source: a copy of the Logos LibraryCatalog/catalog.db (default /tmp/logos-catalog.db).
Books come from the catalog's own subject headings ("Bible. O.T. Psalms--Commentaries."),
group headings (Pentateuch, Pastoral Epistles, Epistles of John, Gospels) and, for the
untagged sets, titles like "1 Chronicles thru Job" or "Luke & John". Whole-Bible and
whole-testament commentaries go in _bible / _ot / _nt. Trusted voices (claude-instructions.md)
sort first. Run: python3 scripts/build-shelf.py [catalog.db]
"""
import json, re, os, sqlite3, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / "jayms-ref.js").read_text()
BOOKS = json.loads(re.search(r"/\*BOOKS\*/(.*?)/\*END\*/", src, re.S).group(1).rstrip().rstrip(";"))
NAMES = [b[0] for b in BOOKS]
OT, NT = NAMES[:39], NAMES[39:]
ALIAS = {"Song of Solomon": "Song of Songs", "Song of Songs": "Song of Songs", "Levitictus": "Leviticus",
         "Psalms": "Psalm", "Psalm": "Psalm"}
GROUPS = {"Pentateuch": NAMES[:5], "Pastoral Epistles": ["1 Timothy", "2 Timothy", "Titus"],
          "Epistles of John": ["1 John", "2 John", "3 John"], "Gospels": NAMES[39:43]}
TRUSTED = ["Heiser", "Walton", "Wright, N", "Wright, Tom", "Bailey, Kenneth", "Evans, Craig", "Carson", "Bruce, F",
           "Bauckham", "Metzger", "Collins, John J", "VanderKam", "Nickelsburg", "Stuckenbruck", "Hurtado",
           "Keener", "Beale", "Aune", "deSilva", "Lewis, C", "Mackie", "Wesley, John", "Bock", "Beckwith"]

def norm(n):
    n = n.strip()
    n = ALIAS.get(n, n)
    return n if n in NAMES else None

def span(a, b):
    a, b = norm(a), norm(b)
    if not a or not b: return []
    i, j = NAMES.index(a), NAMES.index(b)
    return NAMES[i:j + 1] if i <= j else []

RANGE = r"(?:\s+\d+(?::\d+)?(?:[-–]\d+(?::\d+)?)?)?"   # "Genesis 1-16", "Ecclesiastes 1:1-5:6", "Matthew 5:1-7:29"
def covers(subjects):
    """the books of the Bible a resource's subject headings name"""
    out = []
    for sj in (subjects or "").split("\t"):
        m = re.match(r"Bible\.\s*(O\.T\.|N\.T\.)?\s*(?:Apocrypha\.\s*)?([^-]*?)" + RANGE + r"--", sj.strip())
        if not m: continue
        name = m.group(2).strip()
        if not name: out.append("_ot" if m.group(1) == "O.T." else "_nt" if m.group(1) == "N.T." else "_bible")
        elif name in GROUPS: out += GROUPS[name]
        elif norm(name): out.append(norm(name))
    return sorted(set(out), key=lambda b: (NAMES + ["_ot", "_nt", "_bible"]).index(b))

def books_for(subjects, title):
    out, whole = [], None
    for s in subjects.split("\t"):
        m = re.match(r"Bible\.\s*(O\.T\.|N\.T\.)?\s*(?:Apocrypha\.\s*)?([^-]*?)" + RANGE + r"--(?:Commentaries|Translating)", s.strip())   # "Genesis 1-16", UBS handbooks too
        if m:
            t, name = m.group(1), m.group(2).strip()
            if not name: whole = whole or ("_ot" if t == "O.T." else "_nt" if t == "N.T." else "_bible")
            elif name in GROUPS: out += GROUPS[name]
            elif norm(name): out.append(norm(name))
        elif s.strip().startswith("Bible--Commentaries"): whole = whole or "_bible"
    if not out:
        m = re.match(r"^(.+?)\s+(?:thru|through|-)\s+(.+?)$", title)
        if m: out = span(m.group(1), m.group(2))
        else:
            parts = [norm(p) for p in re.split(r"\s*(?:&|,| and )\s*", title)]
            if parts and all(parts): out = parts
    seen = []
    for b in out:
        if b not in seen: seen.append(b)
    return seen, (None if seen else whole)

def trusted(authors):
    for i, t in enumerate(TRUSTED):
        if t.lower() in authors.lower(): return i
    return None

db = sqlite3.connect(sys.argv[1] if len(sys.argv) > 1 else "/tmp/logos-catalog.db")
rows = db.execute("select ResourceId, Title, Authors, Series, PublicationDate, Subjects from Records "
                  "where Type like 'text.monograph.commentary%'").fetchall()
shelf, skipped = {}, 0
for rid, title, authors, series, date, subjects in rows:
    bks, whole = books_for(subjects or "", title or "")
    if not bks and not whole:          # filed only under "Criticism, interpretation" (Walk Genesis!, Exploring the OT): the books its subjects name
        cv = covers(subjects)
        bks = [b for b in cv if not b.startswith("_")]; whole = None if bks else ("_bible" if len(cv) > 1 else cv[0] if cv else None)
    keys = [JB for JB in bks] or ([whole] if whole else [])
    if not keys: skipped += 1; continue
    yr = re.search(r"\d{4}", date or "")
    item = {"id": rid.replace("LLS:", "").lower(), "title": title, "by": "; ".join(a.strip() for a in (authors or "").split("\t") if a.strip()),
            "series": series or "", "year": int(yr.group()) if yr else None}
    t = trusted(item["by"])
    if t is not None: item["trusted"] = 1
    for k in keys: shelf.setdefault(k, []).append((t if t is not None else 99, item))
# ---- the rest of the library, for the author shelf: every text resource with an author, and the books of the Bible it covers (covers())
KIND = {"text.monograph.study.bible": "Study Bible", "text.monograph.encyclopedia": "Reference", "text.monograph.lexicon": "Lexicon",
        "text.monograph.systematic-theology": "Theology", "text.monograph.grammar": "Grammar", "text.serial.journal": "Journal",
        "text.monograph.courseware": "Course"}
SKIP = ("text.monograph.commentary", "text.monograph.bible", "text.serial.magazine", "text.monograph.concordance.bible", "text.monograph.lectionary.bible")
# Bibles whose own notes make them study Bibles in practice (the NET's translators' notes live inside the Bible resource)
NOTED_BIBLES = {"LLS:NETBIBLE2ED": "The NET Bible, Second Edition (translators' notes)"}
lib, sb, atlases = [], [], []
for rid, title, authors, typ, date, subjects in db.execute("select ResourceId, Title, Authors, Type, PublicationDate, Subjects from Records where Type like 'text.%'"):
    if rid in NOTED_BIBLES: title, typ = NOTED_BIBLES[rid], "text.monograph.study.bible"
    if typ.startswith(SKIP) and typ != "text.monograph.study.bible": continue
    yr = re.search(r"\d{4}", date or "")
    by = "; ".join(a.strip() for a in (authors or "").split("\t") if a.strip())
    row = [rid.replace("LLS:", "").lower(), title, by, int(yr.group()) if yr else None, KIND.get(typ, ""), covers(subjects)]
    if typ == "text.monograph.study.bible": sb.append(row)
    elif typ == "text.monograph.atlas": atlases.append(row)
    elif by: lib.append(row)

# ---- the core stack (James, 15 Oct 2026): the same layers on every book, always shown on the Shelf and never hidden by Config.
# Each entry: (layer, resource id, books it serves, chapters (c1, c2) or None, opens at the passage?)
NT_ALL, OT_ALL = NT, OT
WRIGHT = [("EVRY61MT01", ["Matthew"], (1, 15)), ("EVRY61MT02", ["Matthew"], (16, 28)), ("EVRY62MK", ["Mark"], None), ("EVRY63LU", ["Luke"], None),
          ("EVRY64JN01", ["John"], (1, 10)), ("EVRY64JN02", ["John"], (11, 21)), ("EVRY65AC01", ["Acts"], (1, 12)), ("EVRY65AC02", ["Acts"], (13, 28)),
          ("EVRY66RO01", ["Romans"], (1, 8)), ("EVRY66RO02", ["Romans"], (9, 16)), ("EVRY67CO1", ["1 Corinthians"], None), ("EVRY68CO2", ["2 Corinthians"], None),
          ("EVRY69GA", ["Galatians", "1 Thessalonians", "2 Thessalonians"], None), ("EVRYPRISEP", ["Ephesians", "Philippians", "Colossians", "Philemon"], None),
          ("EVRYPASTEP", ["1 Timothy", "2 Timothy", "Titus"], None), ("HEBEVRY", ["Hebrews"], None),
          ("EVRY80JAM", ["James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude"], None), ("EVRY87REV", ["Revelation"], None)]
GOLDINGAY = [("EVRY01GE_01", ["Genesis"], (1, 16)), ("EVRY01GE_02", ["Genesis"], (17, 50)), ("EVRY02EX", ["Exodus", "Leviticus"], None),
             ("EVRY04NU", ["Numbers", "Deuteronomy"], None), ("EVRY06JOS", ["Joshua", "Judges", "Ruth"], None), ("EVRY09SA1", ["1 Samuel", "2 Samuel"], None),
             ("EVRY11KI1", ["1 Kings", "2 Kings"], None), ("EVRY13CH1", ["1 Chronicles", "2 Chronicles"], None), ("EVRY15EZR", ["Ezra", "Nehemiah", "Esther"], None),
             ("EVRY18JOB", ["Job"], None), ("EVRY19PS", ["Psalm"], (1, 72)), ("EVRY19PS2", ["Psalm"], (73, 150)),
             ("EVRY20PR", ["Proverbs", "Ecclesiastes", "Song of Songs"], None), ("EVRY23IS", ["Isaiah"], None), ("EVRY24JE", ["Jeremiah"], None),
             ("EVRY25LA", ["Lamentations", "Ezekiel"], None), ("EVRY27DA", ["Daniel"] + NAMES[27:39], None)]
ZIBBC = [("ZIBBCNT01", NAMES[39:42]), ("ZIBBCNT02A", ["John"]), ("ZIBBCNT02B", ["Acts"]), ("ZIBBCNT03", NAMES[44:57]), ("ZIBBCNT04", NAMES[57:66]),
         ("ZIBBCOT01", NAMES[0:5]), ("ZIBBCOT02", NAMES[5:10]), ("ZIBBCOT03", NAMES[10:17]), ("ZIBBCOT04", ["Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel"]),
         ("ZIBBCOT05", ["Job", "Psalm", "Proverbs", "Ecclesiastes", "Song of Songs"] + NAMES[27:39])]
CORE = [("Reading companion", r, b, ch, True) for r, b, ch in WRIGHT + GOLDINGAY] + [
    ("Background, entry", "NVCLTRLBCBBLNTS", NAMES, None, True),
    ("Background, verse by verse", "VPBBLBCKSCNDDTN", NT_ALL, None, True),
    ("Background, verse by verse", "29.2.10", OT_ALL, None, True)] + [
    ("Background, illustrated", r, b, None, True) for r, b in ZIBBC] + [
    ("Topical: honor and shame", "HNRPTRNGKNS2NDD", NT_ALL, None, False),
    ("Topical: Middle Eastern reading", "JESUSMIDEASTEYE", NAMES[39:43], None, False),
    ("Topical: Middle Eastern reading", "PTPSNTPSPRBLSLK", ["Luke"], None, False),
    ("Topical: Middle Eastern reading", "PAULMEDITBAILEY", ["1 Corinthians"], None, False),
    ("Topical: lookup", "14.0.23", NT_ALL, None, False),
    ("Topical: survey", "BCKGRNDSCHRSTNT", NT_ALL, None, False),
    ("How they thought", "ANCNETHTOT2ED", OT_ALL, None, False),
    ("Primary texts", "ANET", OT_ALL, None, False),
    ("Between the Testaments", "SILVAOTAPOCRYPHA", OT_ALL, None, False),
    ("Between the Testaments", "SCRPTRLTLSTMJWS", OT_ALL, None, False)]
core, missing_core = {}, []
for layer, rid, books, ch, at in CORE:
    r = db.execute("select Title, Authors, PublicationDate from Records where ResourceId = ?", ("LLS:" + rid,)).fetchone()
    if not r: missing_core.append(rid); continue
    yr = re.search(r"\d{4}", r[2] or "")
    item = {"layer": layer, "id": rid.lower(), "title": r[0], "by": "; ".join(a.strip() for a in (r[1] or "").split("\t") if a.strip()), "year": int(yr.group()) if yr else None}
    if ch: item["ch"] = list(ch)
    if at: item["at"] = 1
    for b in books: core.setdefault(b, []).append(item)
out = {"_about": "Logos commentaries James owns, by book. Built by scripts/build-shelf.py from the Logos library catalog. Links: https://ref.ly/logosres/<id>?ref=Bible.<Book><c>.<v>",
       "books": {k: [i for _, i in sorted(v, key=lambda x: (x[0], -(x[1]["year"] or 0)))] for k, v in shelf.items()},
       "lib": lib, "studyBibles": sb, "atlases": atlases, "core": core}
pathlib.Path(os.environ.get("SHELF_OUT") or ROOT / "shelf.json").write_text(json.dumps(out, ensure_ascii=True, separators=(",", ":")))
print(len(rows), "commentaries,", skipped, "with no book;", len(out["books"]), "shelves;",
      sum(1 for v in out["books"].values() for i in v if i.get("trusted")), "trusted placements")
missing = [n for n in NAMES if n not in out["books"]]
print("books with no commentary:", missing)
print(len(lib), "other books with an author,", len(sb), "study Bibles;", sum(len(v) for v in core.values()), "core placements;", "missing core:", missing_core)
