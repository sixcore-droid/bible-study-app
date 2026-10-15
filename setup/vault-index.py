#!/usr/bin/env python3
"""Your Obsidian notes that cite a Bible passage, for the app's Obsidian button: setup/mine/vault-index.json.
Reads every .md in the vault named in setup/settings.json (notesVaultPath) and files each reference it finds under its chapter,
with a line of the note around it. Run by setup/setup.py; run it again (python3 setup/setup.py --refresh) after you write more notes.
"""
import json, os, re, sys, glob
SETUP = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, SETUP)
from refs import ROW, refs_in, rng
s = json.load(open(os.path.join(SETUP, "settings.json"), encoding="utf-8"))
VAULT = os.path.expanduser(s.get("notesVaultPath") or "")
if not os.path.isdir(VAULT): raise SystemExit("No notes vault folder in settings.json (notesVaultPath); skipped the Obsidian index.")
plain = lambda t: re.sub(r"\s+", " ", t).strip()
rows, shared = {}, {}
for path in glob.glob(os.path.join(VAULT, "**", "*.md"), recursive=True):
    rel = os.path.relpath(path, VAULT).replace(os.sep, "/")
    if rel.startswith((".obsidian", ".trash")): continue
    try: text = open(path, encoding="utf-8", errors="ignore").read()
    except Exception: continue
    cites = list(refs_in(text))
    if not cites or len({(x[0]["book"], x[0]["c1"]) for x in cites}) > 150: continue   # a reading plan or a list, not a study note
    for sg, m in cites:
        row = [rel] + rng(sg) + [plain(re.sub(r"[#>\[\]|]", " ", text[max(0, m.start() - 120): m.end() + 140]))[:260]]
        for c in range(sg["c1"], min(sg["c2"], ROW[sg["book"]]["chapters"]) + 1):
            rows.setdefault(ROW[sg["book"]]["slug"], {}).setdefault(str(c), []).append(row)
    shared[rel] = {"t": os.path.basename(path)[:-3], "path": rel}
os.makedirs(os.path.join(SETUP, "mine"), exist_ok=True)
json.dump({"rows": rows, "shared": shared}, open(os.path.join(SETUP, "mine", "vault-index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("Obsidian:", len(shared), "notes cite a passage")
