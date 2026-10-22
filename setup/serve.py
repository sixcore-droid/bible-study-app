#!/usr/bin/env python3
"""Your own copy of the Bible Study App, on your computer: http://localhost:8940/
Run: python3 setup/serve.py        (from the folder you downloaded; leave the window open while you use it)

It serves the app from this download, with your desk turned on: your Logos shelf, your Obsidian vault, your Speechify voice
and your Claude project, all read from setup/settings.json and setup/mine/ (made by setup/setup.py). Nothing here is sent anywhere.
"""
import http.server, os, functools, json, re, time, hashlib, urllib.request, urllib.parse, html as _html
SETUP = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(SETUP); MINE = os.path.join(SETUP, "mine")
def settings():
    try: return json.load(open(os.path.join(SETUP, "settings.json"), encoding="utf-8"))
    except Exception: return {}
def mine(name):
    f = os.path.join(MINE, name); return json.load(open(f, encoding="utf-8")) if os.path.isfile(f) else None

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                      ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8"}
    def send(self, code, body, ctype):
        if isinstance(body, str): body = body.encode("utf-8")
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def vault_note(self, root, folder):
        """POST /api/vault-note {path, content, updatedAt, ifNewer}: the note's copy in the Obsidian vault, written by this server, so a
        saved note is in the vault with no Open in Obsidian click. Only .md files inside the study folder. ifNewer: write only when the
        vault has no copy or the app's copy is newer (the start-up catch-up never overwrites an edit made in Obsidian)."""
        try:
            n = int(self.headers.get("Content-Length") or 0); d = json.loads(self.rfile.read(n) or b"{}")
            rel = str(d.get("path", "")).replace("\\", "/")
            if not root or not os.path.isdir(root): return self.json_out(409, {"error": "no vault folder"})
            if not rel.startswith(folder.rstrip("/") + "/") or not rel.endswith(".md") or ".." in rel.split("/"): return self.json_out(400, {"error": "not in the study folder"})
            f = os.path.join(root, rel)
            if d.get("ifNewer") and os.path.exists(f) and os.path.getmtime(f) * 1000 >= float(d.get("updatedAt") or 0): return self.json_out(200, {"written": False, "path": rel})
            os.makedirs(os.path.dirname(f), exist_ok=True)
            with open(f, "w", encoding="utf-8") as fh: fh.write(str(d.get("content", "")))
            return self.json_out(200, {"written": True, "path": rel})
        except Exception as e:
            return self.json_out(500, {"error": str(e)[:200]})
    def json_out(self, code, obj): self.send(code, json.dumps(obj, ensure_ascii=False, separators=(",", ":")), "application/json; charset=utf-8")
    def page(self):
        s = settings()
        mine_ = {"chunks": True, "notesVault": s.get("notesVault", ""), "studyFolder": s.get("studyFolder") or "Bible Study",
                 "claudeProject": s.get("claudeProject", ""), "ddd": ""}
        body = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
                "<title>Bible Study</title><script>window.JAYMS_SETTINGS = " + json.dumps(mine_).replace("</", "<\\/") + ";</script></head><body>"
                + open(os.path.join(SETUP, "desk.html"), encoding="utf-8").read() + "</body></html>")
        self.send(200, body, "text/html; charset=utf-8")
    def index_piece(self, name):
        """/index/<book>-<n>.json: the site's piece, with the notes in your vault that cite those chapters added"""
        f = os.path.join(ROOT, "index", name)
        if not os.path.isfile(f): return self.send(404, "", "text/plain")
        d = json.load(open(f, encoding="utf-8")); vi = mine("vault-index.json")
        if vi:
            rows = vi.get("rows", {}).get(name.rsplit("-", 1)[0], {})
            n = int(name.rsplit("-", 1)[1][:-5])                     # piece n holds chapters 10n+1 .. 10n+10
            for c, r in rows.items():
                if (int(c) - 1) // 10 == n: d.setdefault("chapters", {}).setdefault(c, {})["vault"] = r
        self.json_out(200, d)
    def podcasts(self):
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query)); feed = re.sub(r"\D", "", q.get("feed", ""))
        s = settings(); key, sec = s.get("podcastIndexKey"), s.get("podcastIndexSecret")
        try:
            if key and sec:
                t = str(int(time.time()))
                h = {"X-Auth-Key": key, "X-Auth-Date": t, "Authorization": hashlib.sha1((key + sec + t).encode()).hexdigest(), "User-Agent": "bible-study-app/1.0"}
                r = json.load(urllib.request.urlopen(urllib.request.Request("https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=%s&max=1000&fulltext" % feed, headers=h), timeout=60))
                eps = [{"t": e.get("title", ""), "link": e.get("link", ""), "date": e.get("datePublished", 0), "dur": e.get("duration", 0), "audio": e.get("enclosureUrl", ""),
                        "desc": re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", " ", e.get("description", "")))).strip()[:600]} for e in r.get("items", [])]
                return self.json_out(200, {"feed": feed, "fetched": int(time.time()), "episodes": eps})
            # no key of your own: the jayms.com app's relay, which serves the same list
            req = urllib.request.Request("https://jayms.com/wp-json/jayms-bsa/v1/podcasts?feed=" + feed, headers={"User-Agent": "Mozilla/5.0"})
            return self.send(200, urllib.request.urlopen(req, timeout=60).read(), "application/json; charset=utf-8")
        except Exception as e:
            return self.json_out(502, {"error": str(e)[:200]})
    def art(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        iid = re.sub(r"[^0-9a-f-]", "", (q.get("id") or [""])[0]); w = (q.get("w") or ["400"])[0]
        if w not in ("400", "843", "1686"): w = "400"
        if not iid: return self.send(400, "", "text/plain")
        try:
            req = urllib.request.Request(f"https://www.artic.edu/iiif/2/{iid}/full/{w},/0/default.jpg", headers={"User-Agent": "Mozilla/5.0"})
            return self.send(200, urllib.request.urlopen(req, timeout=30).read(), "image/jpeg")
        except Exception:
            return self.send(502, "", "text/plain")
    def do_GET(self):
        name = urllib.parse.urlparse(self.path).path
        if name in ("/", "/index.html"): return self.page()
        if name == "/help.html": return self.send(200, open(os.path.join(SETUP, "help-full.html"), encoding="utf-8").read(), "text/html; charset=utf-8")
        if name.startswith("/api/podcasts"): return self.podcasts()
        if name.startswith("/api/art"): return self.art()
        if name == "/speechify/speechify-reader.js": return self.send(200, open(os.path.join(SETUP, "speechify-reader.js"), encoding="utf-8").read(), "text/javascript; charset=utf-8")
        if name == "/speechify/speechify-key.js":
            s = settings()
            if not s.get("speechifyKey"): return self.send(404, "", "text/plain")
            opts = {"key": s["speechifyKey"], "voice": s.get("speechifyVoice") or "geffen_32", "speed": 0}
            return self.send(200, "window.SPEECHIFY_OPTS = " + json.dumps(opts) + ";", "text/javascript; charset=utf-8")
        if name in ("/shelf.json", "/vault-books.json"):
            d = mine(name[1:]); return self.json_out(200, d) if d is not None else self.send(404, "", "text/plain")
        if name == "/index/_chats.json": return self.json_out(200, {})        # synced Claude chat summaries: the original desk's own, none here
        if name.startswith("/fsb/"): return self.json_out(200, {"n": []})       # the original desk's Faithlife notes: not part of a download
        if name == "/index/_vault.json":
            vi = mine("vault-index.json"); return self.json_out(200, (vi or {}).get("shared", {}))
        if re.fullmatch(r"/index/[a-z0-9-]+-\d+\.json", name): return self.index_piece(name.rsplit("/", 1)[1])
        rng = self.headers.get("Range", "")
        if rng.startswith("bytes="):   # a map is read out of its bundle without the whole file
            f = self.translate_path(name)
            if os.path.isfile(f):
                size = os.path.getsize(f); a, _, b = rng[6:].partition("-"); a = int(a or 0); b = min(int(b) if b else size - 1, size - 1)
                if a <= b < size:
                    with open(f, "rb") as fh: fh.seek(a); body = fh.read(b - a + 1)
                    self.send_response(206); self.send_header("Content-Type", self.guess_type(f)); self.send_header("Content-Range", "bytes %d-%d/%d" % (a, b, size))
                    self.send_header("Content-Length", str(len(body))); self.send_header("Accept-Ranges", "bytes"); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()
    def do_POST(self):
        s = settings()
        if urllib.parse.urlparse(self.path).path == "/api/vault-note": return self.vault_note(os.path.expanduser(s.get("notesVaultPath") or ""), s.get("studyFolder") or "Bible Study")
        self.send_response(404); self.end_headers()
    def end_headers(self): self.send_header("Cache-Control", "no-store"); super().end_headers()
    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(settings().get("port") or 8940)
    print(f"Bible Study App: open http://localhost:{port}/  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(H, directory=ROOT)).serve_forever()
