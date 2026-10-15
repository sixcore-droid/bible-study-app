#!/usr/bin/env python3
"""Bible references: the book list (from jayms-ref.js) and the same parsing rules as JaymsRef.parse and JaymsRef.refsIn.
Shared by build-data.py and the set-up kit's vault index (setup/vault-index.py), so a reference means the same thing everywhere.
"""
import json, re, os
# ------------------------------------------------------------------ books + references (from jayms-ref.js)
src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "jayms-ref.js"), encoding="utf-8").read()   # scripts/ or setup/ sits beside it
BOOKS = json.loads(src[src.index("/*BOOKS*/") + 9: src.index("/*END*/")])
ROW, BY = {}, {}
for name, slug, il, ib, chs, aliases in BOOKS:
    ROW[name] = {"name": name, "slug": slug, "il": il, "ib": ib, "chapters": chs}
    for a in [name, slug, il, ib] + aliases: BY[a.lower().replace(".", "")] = name
def book(n): return BY.get(re.sub(r"\s+", " ", str(n or "").lower().replace(".", "")).strip())

def seg(b, c1, v1, c2, v2): return {"book": b, "c1": c1, "v1": v1, "c2": c2, "v2": v2}
def parse(text):
    """Same rules as JaymsRef.parse."""
    out, b, chap = [], None, None
    for part in re.split(r"\s*[;·]\s*", str(text or "").strip()):
        m = re.match(r"^((?:[1-3]|i{1,3})?\s*[A-Za-z][A-Za-z. ]*?)\s+(\d.*)$", part, re.I)
        rest = part
        if not m and book(part):  # a bare book name is the whole book
            b = book(part); chap = None; out.append(seg(b, 1, 1, ROW[b]["chapters"], 999)); continue
        if m and book(m.group(1)): b = book(m.group(1)); rest = m.group(2); chap = None
        if not b: continue
        had_colon = ":" in rest
        for bit in re.split(r"\s*,\s*", rest):
            if ROW[b]["chapters"] == 1 and ":" not in bit:
                a = re.match(r"^(\d+)(?:\s*[-–]\s*(\d+))?$", bit)
                if a: out.append(seg(b, 1, int(a.group(1)), 1, int(a.group(2) or a.group(1)))); chap = 1; continue
            a = re.match(r"^(\d+):(\d+)(?:\s*[-–]\s*(?:(\d+):)?(\d+))?$", bit)
            if a:
                chap = int(a.group(1)); c2 = int(a.group(3)) if a.group(3) else chap; v2 = int(a.group(4)) if a.group(4) else int(a.group(2))
                out.append(seg(b, chap, int(a.group(2)), c2, v2)); chap = c2; continue
            a = re.match(r"^(\d+)(?:\s*[-–]\s*(\d+))?$", bit)
            if a:
                if chap is not None and had_colon: out.append(seg(b, chap, int(a.group(1)), chap, int(a.group(2) or a.group(1)))); continue
                out.append(seg(b, int(a.group(1)), 1, int(a.group(2) or a.group(1)), 999)); chap = int(a.group(1))
    return out

pos = lambda c, v: c * 1000 + v
def overlap(a, b): return a["book"] == b["book"] and pos(a["c1"], a["v1"]) <= pos(b["c2"], b["v2"]) and pos(b["c1"], b["v1"]) <= pos(a["c2"], a["v2"])
def rng(s): return [s["c1"], s["v1"], s["c2"], s["v2"]]

# references written in prose: "Ps 82:6", "Deut. 32:8-9", "John 10:34", "Psalm 82"
NAMES = sorted(set(BY) | {n.lower() for n in ROW}, key=len, reverse=True)
REF_RE = re.compile(r"\b(" + "|".join(re.escape(n) for n in NAMES) + r")\.?\s+(\d{1,3})(?::(\d{1,3})(?:\s*[-–]\s*(\d{1,3})(?::(\d{1,3}))?)?)?(?![\d:])", re.I)
def refs_in(text):
    for m in REF_RE.finditer(text):
        if m.group(1)[0].islower(): continue   # "is 2 ways", "I am 5": a book name in prose is capitalised (same rule as JaymsRef.refsIn)
        b = book(m.group(1))
        if not b: continue
        c = int(m.group(2))
        if ROW[b]["chapters"] == 1 and not m.group(3): s = seg(b, 1, c, 1, c)
        elif m.group(3):
            v1 = int(m.group(3))
            s = seg(b, c, v1, int(m.group(4)), int(m.group(5))) if m.group(5) else seg(b, c, v1, c, int(m.group(4) or v1))
        else:
            if c > ROW[b]["chapters"]: continue
            s = seg(b, c, 1, c, 999)
        yield s, m

