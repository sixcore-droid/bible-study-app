#!/usr/bin/env python3
"""The books in James's Obsidian BOOKS vault (~/Vault/BOOKS/ZZZ-BOOKS/<Author>/<Title>.md) -> vault-books.json, for the
Shelf's Books tab: his authors' books that aren't in Logos, each opening in Obsidian. Desk only (not in the public build).
One entry per book: the .md (or a .pdf with no .md of the same name), duplicates dropped ("duplicate_..." and "<title> 1").
"bk" names the Bible books a title is about ("IVP BBC OT - 1 Kings", "Galatians - N. T. Wright"), so the tab can lift them.
Run: python3 scripts/build-vault-books.py   (refresh-daily.py runs it too)
"""
import json, os, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent; os.chdir(ROOT)
# the kit (setup/) sets these for someone else's vault
VAULT = pathlib.Path(os.environ.get("BOOKS_VAULT") or pathlib.Path.home() / "Vault/BOOKS")
SHELF = VAULT / os.environ.get("BOOKS_FOLDER", "ZZZ-BOOKS")
VAULT_NAME = os.environ.get("BOOKS_VAULT_NAME", "BOOKS")
OUT = os.environ.get("VAULT_BOOKS_OUT", "vault-books.json")
SKIP = {"Bibles", "Unattributed", "Qur'an", "The Urantia Book", "The Passion Translation"}   # not an author's books
_src = open("jayms-ref.js", encoding="utf-8").read()
BOOKS = [b[0] for b in json.loads(_src[_src.index("/*BOOKS*/") + 9: _src.index("/*END*/")])]
ALIAS = {"Psalms": "Psalm", "Song of Solomon": "Song of Songs"}
names = sorted(BOOKS + list(ALIAS), key=len, reverse=True)
BK = re.compile(r"(?<![\w])(" + "|".join(re.escape(n) for n in names) + r")(?![\w])")

def title_of(stem, folder):
    t = re.sub(r"^duplicate_", "", stem)
    last = folder.split(",")[0].strip()
    parts = t.split(" - ")
    if len(parts) > 1 and last.lower() in parts[-1].lower(): parts = parts[:-1]          # "Miracles - C. S. Lewis"
    if len(parts) > 1 and last.lower() in parts[0].lower(): parts = parts[1:]            # "Lewis, C.S. - Narnia 1 - ..."
    t = " - ".join(parts)
    t = re.sub(r"\s+by\s+[^-]*" + re.escape(last) + r"\s*$", "", t, flags=re.I)          # "Mere Christianity by C. S. Lewis"
    return re.sub(r"\s+", " ", t).strip()

def has_text(f):
    """A Markdown file with real reading in it: at least 150 words of prose, and not one of the commentary's charts, maps or adverts."""
    if re.search(r"Charts and Maps|Comparative Ancient Near Eastern Chronology|Finding the Textbook", f.stem): return False
    try: body = re.sub(r"^---\n.*?\n---\n", "", f.read_text(encoding="utf-8", errors="ignore"), count=1, flags=re.S)
    except OSError: return False
    return len(re.findall(r"[A-Za-z]{3,}", body)) >= 150

out = []
if SHELF.is_dir():
    for d in sorted(p for p in SHELF.iterdir() if p.is_dir() and not p.name.startswith(".") and p.name not in SKIP):
        seen, books = {}, []
        files = sorted(f for f in d.iterdir() if f.is_file() and f.suffix.lower() in (".md", ".pdf"))
        mds = {f.stem for f in files if f.suffix.lower() == ".md"}
        for f in files:
            if f.suffix.lower() == ".pdf" and f.stem in mds: continue
            if f.stem.startswith("duplicate_") or re.search(r" \d$", f.stem) and f.stem[:-2] in mds: continue
            if f.suffix.lower() == ".md" and not has_text(f): continue                  # a chart, a map's labels, an advert: nothing to read
            t = title_of(f.stem, d.name)
            last = re.sub(r"[^a-z0-9]", "", d.name.split(",")[0].lower())
            key = re.sub(r"^(the)", "", re.sub(r"^" + re.escape(last), "", re.sub(r"[^a-z0-9]", "", t.lower())))
            slug = " " not in t                                   # "lewis-surprised-by-joy": a copy under a file-style name
            if slug: t = re.sub(r"^" + re.escape(last) + r"[-_ ]*", "", t, flags=re.I).replace("-", " ").replace("_", " ").strip().capitalize()
            if not key: continue
            bk = sorted({ALIAS.get(m, m) for m in BK.findall(t)})
            ch = sorted({c for a, b in re.findall(r"(?:" + "|".join(re.escape(n) for n in names) + r")\s+(\d{1,3})(?:-(\d{1,3}))?(?![\d:])", t)
                         for c in range(int(a), int(b or a) + 1)}) if bk else []          # "Romans 1-7" -> 1..7
            item = {"t": t, "f": str(f.relative_to(VAULT)), **({"bk": bk} if bk else {}), **({"ch": ch} if ch else {})}   # "Psalm 23": only beside that chapter
            if key in seen:
                if seen[key][0] and not slug: books[books.index(seen[key][1])] = item; seen[key] = (slug, item)   # keep the readable title
                continue
            seen[key] = (slug, item); books.append(item)
        if books: out.append({"by": d.name, "books": books})
json.dump({"_about": "Books in James's Obsidian BOOKS vault, by author folder. Built by scripts/build-vault-books.py.", "vault": VAULT_NAME, "authors": out},
          open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("vault books:", sum(len(a["books"]) for a in out), "books by", len(out), "authors")
