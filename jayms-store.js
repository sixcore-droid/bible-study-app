/*!
 * JaymsStore — one way to save everything James saves, on any page.
 *
 *   const store = JaymsStore.create({ collections: {
 *     notes:  { sync: true },                  // private: only James, synced to his account
 *     pub:    { sync: true, public: true },    // public: anyone who can open the page reads it, only James writes
 *     drafts: { sync: false }                  // this browser only
 *   }});
 *   store.c("notes").save("psalm-82", { text: "..." })   -> stamps createdAt / updatedAt, writes every layer
 *   store.c("notes").peek("psalm-82")                    -> the cached doc, synchronously (or null)
 *   store.c("notes").all()                               -> every cached doc, as [{id, ...}]
 *   store.c("notes").remove("psalm-82")
 *   store.c("notes").on(fn)                               -> called with (id, doc|null) on any change, local or remote
 *   store.attach(JaymsStore.adapters.artifactDb(db, uid)) -> add a remote layer later, then:
 *   store.sync("notes")                                   -> merge both layers, newest updatedAt wins, both sides end equal
 *
 * Layers (adapters) all have the same four async methods: get(coll, id), set(coll, id, doc), remove(coll, id),
 * list(coll) -> [{id, ...doc}], plus an optional watch(coll, cb). Built in:
 *   local(prefix)         this browser (localStorage). Always present; it is the cache and the offline copy.
 *   artifactDb(db, uid)   a claude.ai Artifact database. Private collections live in data/users/<uid> as "<coll>~<id>",
 *                         public ones in a top-level collection of their own name.
 *   rest(base, headers)   a JSON endpoint (GET/PUT/DELETE base/<coll>/<id>, GET base/<coll>): the shape for jayms.com.
 *
 * Ids are passage keys from JaymsRef ("psalm-82") or any other stable string. A doc never needs to carry its own id.
 */
(function (global) {
  "use strict";

  function now() { return Date.now(); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  // ------------------------------------------------------------------ adapters
  var adapters = {
    local: function (prefix) {
      prefix = prefix || "js:";
      var k = function (c, id) { return prefix + c + ":" + id; };
      return {
        name: "local", sync: true,
        getSync: function (c, id) { try { var v = localStorage.getItem(k(c, id)); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
        listSync: function (c) {
          var out = [], p = prefix + c + ":";
          try { for (var i = 0; i < localStorage.length; i++) { var key = localStorage.key(i); if (key && key.indexOf(p) === 0) { var d = JSON.parse(localStorage.getItem(key)); if (d) { d.id = key.slice(p.length); out.push(d); } } } } catch (e) {}
          return out;
        },
        get: function (c, id) { return Promise.resolve(this.getSync(c, id)); },
        set: function (c, id, d) { try { localStorage.setItem(k(c, id), JSON.stringify(d)); } catch (e) {} return Promise.resolve(); },
        remove: function (c, id) { try { localStorage.removeItem(k(c, id)); } catch (e) {} return Promise.resolve(); },
        list: function (c) { return Promise.resolve(this.listSync(c)); }
      };
    },
    artifactDb: function (db, uid, publicNames) {
      var pub = {}; (publicNames || []).forEach(function (n) { pub[n] = 1; });
      function ref(c, id) { return pub[c] ? db.collection(c).doc(id) : (uid ? db.collection("data/users/" + uid).doc(c + "~" + id) : null); }
      return {
        name: "db",
        get: function (c, id) { var r = ref(c, id); return r ? r.get().then(function (s) { return s.exists ? s.data() : null; }).catch(function () { return null; }) : Promise.resolve(null); },
        set: function (c, id, d) { var r = ref(c, id); if (!r) return Promise.resolve(); var x = clone(d); delete x.id; if (!pub[c]) x._c = c; return r.set(x); },
        remove: function (c, id) { var r = ref(c, id); return r ? r.delete().catch(function () {}) : Promise.resolve(); },
        list: function (c) {
          var q = pub[c] ? db.collection(c) : (uid ? db.collection("data/users/" + uid).where("_c", "==", c) : null);
          if (!q) return Promise.resolve([]);
          return q.get().then(function (s) { return s.docs.map(function (x) { var d = clone(x.data()); delete d._c; d.id = pub[c] ? x.id : x.id.slice(c.length + 1); return d; }); }).catch(function () { return []; });
        },
        watch: function (c, cb) {
          var q = pub[c] ? db.collection(c) : (uid ? db.collection("data/users/" + uid).where("_c", "==", c) : null);
          if (!q) return null;
          return q.onSnapshot(function (s) {
            s.docChanges().forEach(function (ch) { var d = clone(ch.doc.data()); delete d._c; cb(pub[c] ? ch.doc.id : ch.doc.id.slice(c.length + 1), ch.type === "removed" ? null : d); });
          }, function () {});
        }
      };
    },
    rest: function (base, headers) {
      var h = Object.assign({ "Content-Type": "application/json" }, headers || {});
      var u = function (c, id) { return base + encodeURIComponent(c) + (id != null ? "/" + encodeURIComponent(id) : ""); };
      return {
        name: "rest",
        get: function (c, id) { return fetch(u(c, id), { headers: h }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); },
        set: function (c, id, d) { return fetch(u(c, id), { method: "PUT", headers: h, body: JSON.stringify(d) }); },
        remove: function (c, id) { return fetch(u(c, id), { method: "DELETE", headers: h }); },
        list: function (c) { return fetch(u(c), { headers: h }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }); }
      };
    }
  };

  // ------------------------------------------------------------------ the store
  function create(opts) {
    opts = opts || {};
    var defs = opts.collections || {}, local = adapters.local(opts.prefix), remote = null;
    var cache = {}, subs = {}, unwatch = {};
    Object.keys(defs).forEach(function (c) { cache[c] = {}; subs[c] = []; local.listSync(c).forEach(function (d) { var id = d.id; delete d.id; cache[c][id] = d; }); });

    function emit(c, id, d) { (subs[c] || []).forEach(function (fn) { try { fn(id, d); } catch (e) {} }); }
    function def(c) { if (!defs[c]) throw new Error("JaymsStore: no collection named " + c); return defs[c]; }

    function collection(c) {
      def(c);
      return {
        name: c,
        peek: function (id) { var d = cache[c][id]; return d ? clone(d) : null; },
        all: function () { return Object.keys(cache[c]).map(function (id) { return Object.assign({ id: id }, clone(cache[c][id])); }); },
        save: function (id, doc) {
          var prev = cache[c][id], t = now();
          var d = Object.assign({}, clone(doc), { createdAt: (prev && prev.createdAt) || doc.createdAt || t, updatedAt: doc.updatedAt || t });
          delete d.id; cache[c][id] = d; local.set(c, id, d); emit(c, id, clone(d));
          return remote && defs[c].sync ? Promise.resolve(remote.set(c, id, d)).catch(function () {}) : Promise.resolve();
        },
        remove: function (id) {
          delete cache[c][id]; local.remove(c, id); emit(c, id, null);
          return remote && defs[c].sync ? Promise.resolve(remote.remove(c, id)).catch(function () {}) : Promise.resolve();
        },
        on: function (fn) { subs[c].push(fn); return function () { subs[c] = subs[c].filter(function (f) { return f !== fn; }); }; }
      };
    }

    /* merge one collection with the remote layer: newest updatedAt wins; both layers end equal */
    function sync(c) {
      if (!remote || !defs[c].sync) return Promise.resolve();
      return Promise.resolve(remote.list(c)).then(function (rows) {
        var seen = {}, writes = [];
        (rows || []).forEach(function (r) {
          var id = r.id; delete r.id; seen[id] = 1;
          var mine = cache[c][id];
          if (!mine || (r.updatedAt || 0) > (mine.updatedAt || 0)) { cache[c][id] = r; local.set(c, id, r); emit(c, id, clone(r)); }
          else if ((mine.updatedAt || 0) > (r.updatedAt || 0)) writes.push(remote.set(c, id, mine));
        });
        /* things only this browser has: push them up, unless the collection is public and this viewer only reads it */
        if (!defs[c].public || opts.canWritePublic) Object.keys(cache[c]).forEach(function (id) { if (!seen[id]) writes.push(remote.set(c, id, cache[c][id])); });
        return Promise.all(writes.map(function (p) { return Promise.resolve(p).catch(function () {}); }));
      }).then(function () {
        if (remote.watch && !unwatch[c]) unwatch[c] = remote.watch(c, function (id, d) {
          var mine = cache[c][id];
          if (d === null) { if (mine) { delete cache[c][id]; local.remove(c, id); emit(c, id, null); } return; }
          if (!mine || (d.updatedAt || 0) >= (mine.updatedAt || 0)) { cache[c][id] = d; local.set(c, id, d); emit(c, id, clone(d)); }
        });
      });
    }

    return {
      c: collection,
      collections: function () { return Object.keys(defs); },
      attach: function (adapter, more) { remote = adapter; Object.assign(opts, more || {}); },
      sync: sync,
      syncAll: function () { return Promise.all(Object.keys(defs).map(sync)); },
      local: local,
      /* small per-device settings (layout, widths, chosen version): this browser only, never synced */
      prefs: {
        get: function (k, d) { try { var v = localStorage.getItem((opts.prefsPrefix || "ws.") + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
        set: function (k, v) { try { localStorage.setItem((opts.prefsPrefix || "ws.") + k, JSON.stringify(v)); } catch (e) {} }
      }
    };
  }

  /* the shape JaymsX (x-discuss.js) wants, backed by a store collection */
  function forJaymsX(col) {
    return { load: function (k) { return Promise.resolve(col.peek(k)); }, save: function (k, t) { return col.save(k, t); }, remove: function (k) { return col.remove(k); } };
  }

  global.JaymsStore = { create: create, adapters: adapters, forJaymsX: forJaymsX, version: "1.0.0" };
})(typeof window !== "undefined" ? window : this);
