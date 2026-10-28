/*! JaymsFolder — one folder on the user's own computer, chosen once, that a page can save into.
 *
 *   JaymsFolder.supported()                    -> true where the browser can do it (Chrome, Edge, Opera on a computer)
 *   await JaymsFolder.load()                   -> "none" | "prompt" | "ready" | "unsupported"; call once at start-up
 *   await JaymsFolder.pick()                   -> the user chooses a folder (needs a tap); resolves to the state
 *   await JaymsFolder.reconnect()              -> after a browser restart: asks permission again (needs a tap)
 *   JaymsFolder.disconnect()                   -> forget the folder (the files stay where they are)
 *   JaymsFolder.state() / .ready() / .name()   -> where things stand; the chosen folder's name
 *   JaymsFolder.on("state", fn)                -> fn(state) whenever it changes
 *   await JaymsFolder.write("Notes/John 3.md", text)   -> {mtime}     (makes the sub-folders it needs)
 *   await JaymsFolder.read("Notes/John 3.md")          -> {text, mtime} or null
 *   await JaymsFolder.stat("Notes/John 3.md")          -> {mtime, size} or null
 *   await JaymsFolder.list("Notes")                    -> [{name, mtime, size}]   (files only)
 *   await JaymsFolder.remove("Notes/John 3.md")
 *   await JaymsFolder.readJSON("Data/progress.json") / .writeJSON(path, value)
 *
 * Nothing leaves the computer: the browser gives the page access to that one folder only, after the user picks it, and
 * the page reads and writes it directly. The folder's handle is kept in this browser's IndexedDB so it is remembered;
 * after a restart the browser may ask permission again, which is the "prompt" state (reconnect() needs a tap).
 * Tests replace window.showDirectoryPicker with  async () => navigator.storage.getDirectory()  (the browser's private
 * file system has the same handle interface), so no human is needed to exercise it.
 */
(function (global) {
  "use strict";
  var DB_NAME = global.JAYMS_FOLDER_DB || "jayms-folder", STORE = "handles", KEY = "folder";   // the test copy names its own
  var dir = null, st = "none", subs = [];

  function supported() { return typeof global.showDirectoryPicker === "function"; }
  function setState(s) { if (s === st) return; st = s; subs.slice().forEach(function (fn) { try { fn(s); } catch (e) {} }); }

  /* the remembered handle: IndexedDB can store a directory handle as it is */
  function idb() {
    return new Promise(function (ok, no) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(r.error); };
    });
  }
  function idbDo(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (ok, no) {
        var tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
        tx.oncomplete = function () { db.close(); ok(req && req.result); };
        tx.onerror = tx.onabort = function () { db.close(); no(tx.error); };
      });
    });
  }

  function perm(h, ask) {
    if (!h || !h.queryPermission) return Promise.resolve(true);   // the browser's own file system never asks
    var o = { mode: "readwrite" };
    return h.queryPermission(o).then(function (p) {
      if (p === "granted") return true;
      return ask ? h.requestPermission(o).then(function (q) { return q === "granted"; }) : false;
    });
  }

  /* the folder must really be writable: write a small file and take it away again */
  function check(h) {
    return h.getFileHandle(".jayms-folder-check", { create: true }).then(function (fh) {
      return fh.createWritable().then(function (w) { return w.write("ok").then(function () { return w.close(); }); })
        .then(function () { return h.removeEntry(".jayms-folder-check"); });
    });
  }

  function load() {
    if (!supported() || !global.indexedDB) { setState("unsupported"); return Promise.resolve(st); }
    return idbDo("readonly", function (s) { return s.get(KEY); }).then(function (h) {
      if (!h) { setState("none"); return st; }
      dir = h;
      return perm(h, false).then(function (ok) { setState(ok ? "ready" : "prompt"); return st; });
    }).catch(function () { setState("none"); return st; });
  }

  function connect(h) {
    return check(h).then(function () { return idbDo("readwrite", function (s) { return s.put(h, KEY); }); })
      .then(function () { dir = h; setState("ready"); return st; });
  }
  function pick() {
    if (!supported()) return Promise.reject(new Error("This browser cannot choose a folder."));
    return global.showDirectoryPicker({ id: "jayms-bible-study", mode: "readwrite" }).then(connect);
  }
  function reconnect() {
    if (!dir) return Promise.resolve(st);
    return perm(dir, true).then(function (ok) { setState(ok ? "ready" : "prompt"); return st; });
  }
  function disconnect() {
    dir = null; setState("none");
    return idbDo("readwrite", function (s) { return s.delete(KEY); }).catch(function () {});
  }

  /* paths are "Sub/Folder/file.md", relative to the chosen folder */
  function split(path) { var p = String(path).split("/").filter(Boolean); return { dirs: p.slice(0, -1), name: p[p.length - 1] }; }
  function walk(dirs, create) {
    return dirs.reduce(function (pr, d) { return pr.then(function (h) { return h.getDirectoryHandle(d, { create: !!create }); }); }, Promise.resolve(dir));
  }
  function need() {
    if (st !== "ready" || !dir) return Promise.reject(new Error("The folder is not connected."));
    return Promise.resolve();
  }
  /* a lost permission turns the state to "prompt" so the page can show Reconnect */
  function guard(e) { if (e && e.name === "NotAllowedError") setState("prompt"); throw e; }
  function missing(e) { return e && (e.name === "NotFoundError" || e.name === "TypeMismatchError"); }

  function write(path, text) {
    var p = split(path);
    return need().then(function () { return walk(p.dirs, true); })
      .then(function (d) { return d.getFileHandle(p.name, { create: true }); })
      .then(function (fh) { return fh.createWritable().then(function (w) { return w.write(text).then(function () { return w.close(); }); }).then(function () { return fh.getFile(); }); })
      .then(function (f) { return { mtime: f.lastModified }; }).catch(guard);
  }
  function fileOf(path) {
    var p = split(path);
    return need().then(function () { return walk(p.dirs, false); }).then(function (d) { return d.getFileHandle(p.name); }).then(function (fh) { return fh.getFile(); });
  }
  function read(path) {
    return fileOf(path).then(function (f) { return f.text().then(function (t) { return { text: t, mtime: f.lastModified }; }); })
      .catch(function (e) { if (missing(e)) return null; return guard(e); });
  }
  function stat(path) {
    return fileOf(path).then(function (f) { return { mtime: f.lastModified, size: f.size }; }).catch(function (e) { if (missing(e)) return null; return guard(e); });
  }
  function list(sub) {
    return need().then(function () { return walk(String(sub || "").split("/").filter(Boolean), false); }).then(function (d) {
      var out = [];
      return (function next(it) {
        return it.next().then(function (r) {
          if (r.done) return out;
          var h = r.value[1];
          if (h.kind !== "file") return next(it);
          return h.getFile().then(function (f) { out.push({ name: h.name, mtime: f.lastModified, size: f.size }); return next(it); });
        });
      })(d.entries());
    }).catch(function (e) { if (missing(e)) return []; return guard(e); });
  }
  function remove(path) {
    var p = split(path);
    return need().then(function () { return walk(p.dirs, false); }).then(function (d) { return d.removeEntry(p.name); })
      .catch(function (e) { if (missing(e)) return; return guard(e); });
  }
  function readJSON(path) { return read(path).then(function (r) { if (!r) return null; try { return JSON.parse(r.text); } catch (e) { return null; } }); }
  function writeJSON(path, v) { return write(path, JSON.stringify(v, null, 1)); }

  global.JaymsFolder = {
    supported: supported, load: load, pick: pick, connect: connect, reconnect: reconnect, disconnect: disconnect,
    state: function () { return st; }, ready: function () { return st === "ready"; }, name: function () { return dir ? dir.name : ""; },
    on: function (ev, fn) { if (ev === "state") subs.push(fn); },
    write: write, read: read, stat: stat, list: list, remove: remove, readJSON: readJSON, writeJSON: writeJSON
  };
})(typeof window !== "undefined" ? window : this);
