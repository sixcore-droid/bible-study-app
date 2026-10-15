#!/usr/bin/env python3
"""Set up your own copy of the Bible Study App: answer a few questions, and it builds your desk.
Run: python3 setup/setup.py             asks, saves setup/settings.json, then builds
     python3 setup/setup.py --refresh   builds again with the saved answers (after new Logos books or new notes)
Every question can be skipped (press Enter): that part of the desk just stays off.
Your answers and keys stay in setup/settings.json on this computer. Don't share that file.
"""
import json, os, sys, glob, sqlite3, subprocess
SETUP = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(SETUP); MINE = os.path.join(SETUP, "mine")
CFG = os.path.join(SETUP, "settings.json")
s = json.load(open(CFG, encoding="utf-8")) if os.path.exists(CFG) else {}

QUESTIONS = [
    ("notesVault", "Obsidian: the name of the vault your study notes go in (as Obsidian shows it)", ""),
    ("notesVaultPath", "Obsidian: that vault's folder on this computer (drag the folder in here)", ""),
    ("studyFolder", "Obsidian: the folder inside it for the app's notes, vocabulary and wrap-ups", "Bible Study"),
    ("booksVault", "Obsidian, optional: a second vault of books, one folder per author (its name)", ""),
    ("booksVaultPath", "  that vault's folder on this computer", ""),
    ("booksFolder", "  the folder inside it that holds the author folders (Enter if they sit at the top)", ""),
    ("claudeProject", "Claude: the link to your claude.ai Project for Bible study (claude.ai/project/...)", ""),
    ("speechifyKey", "Speechify: your API key (speechify.ai, API section) for the Read voice", ""),
    ("speechifyVoice", "  the Speechify voice to read with", "geffen_32"),
    ("podcastIndexKey", "Podcast Index, optional: API key (podcastindex.org; Enter to use the jayms.com relay)", ""),
    ("podcastIndexSecret", "  and its secret", ""),
]

def ask():
    print(__doc__.split("\n")[0], "\n")
    for k, q, d in QUESTIONS:
        cur = s.get(k) or d
        shown = (cur[:4] + "...") if cur and ("Key" in k or "Secret" in k) else cur
        a = input(f"{q}\n  [{shown}]: ").strip().strip("'\"")
        s[k] = os.path.expanduser(a) if a else cur
    s.setdefault("port", 8940)
    json.dump(s, open(CFG, "w", encoding="utf-8"), indent=1)
    print("\nSaved", CFG)

def logos_catalog():
    """Logos keeps its library list in LibraryCatalog/catalog.db: on a Mac under Application Support, on Windows under LocalAppData"""
    pats = [os.path.expanduser("~/Library/Application Support/Logos4/Data/*/LibraryCatalog/catalog.db"),
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "Logos", "Data", "*", "LibraryCatalog", "catalog.db"),
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "Logos4", "Data", "*", "LibraryCatalog", "catalog.db")]
    for p in pats:
        hit = glob.glob(p)
        if hit: return max(hit, key=os.path.getmtime)
    return None

def run(script, env):
    r = subprocess.run([sys.executable, os.path.join(SETUP, script)], env={**os.environ, **env}, cwd=ROOT, capture_output=True, text=True)
    print("  " + (r.stdout.strip() or r.stderr.strip().splitlines()[-1] if (r.stdout or r.stderr) else "done"))

def build():
    os.makedirs(MINE, exist_ok=True)
    print("\nLogos")
    cat = logos_catalog()
    if cat:
        copy = os.path.join(MINE, "logos-catalog.db")
        src = sqlite3.connect(f"file:{cat}?mode=ro", uri=True); dst = sqlite3.connect(copy); src.backup(dst); dst.close(); src.close()
        r = subprocess.run([sys.executable, os.path.join(SETUP, "build-shelf.py"), copy], env={**os.environ, "SHELF_OUT": os.path.join(MINE, "shelf.json")}, cwd=ROOT, capture_output=True, text=True)
        print("  " + (r.stdout.strip().splitlines()[0] if r.returncode == 0 else "couldn't read it: " + r.stderr.strip()[-200:]))
    else:
        print("  Logos isn't installed here (or hasn't opened yet): the Shelf shows the open study notes only.")
    print("Obsidian")
    if s.get("notesVaultPath"): run("vault-index.py", {})
    else: print("  no notes vault given: skipped")
    if s.get("booksVaultPath"):
        run("build-vault-books.py", {"BOOKS_VAULT": s["booksVaultPath"], "BOOKS_FOLDER": s.get("booksFolder", ""), "BOOKS_VAULT_NAME": s.get("booksVault", ""),
                                     "VAULT_BOOKS_OUT": os.path.join(MINE, "vault-books.json")})
    print("Speechify:", "on" if s.get("speechifyKey") else "off (no key)")
    print("Claude:", "your Project" if s.get("claudeProject") else "off (no Project link)")
    print(f"\nReady. Start it with:  python3 setup/serve.py   then open http://localhost:{s.get('port', 8940)}/")

if "--refresh" not in sys.argv: ask()
build()
