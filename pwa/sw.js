/* Bible Study App service worker: what makes the app installable and lets it open with no connection.
   Served from https://jayms.com/bible-study-app/sw (no .js: the host answers .js addresses itself; snippet 254 relays it from GitHub Pages), so it covers the app's own
   address, /bible-study-app/. The app's files themselves come from GitHub Pages (the page's <base>); this worker keeps copies.
     - The page and the app's code, styles, help and plans: saved when the app is installed, so it always opens.
     - Bible text, study notes and the other data: saved the first time each piece is read, then shown from the copy at once
       while a fresh copy is fetched behind it (so a new build arrives on the next visit).
     - jayms.com's live data (posts, glossary): fresh when online, the last copy when not.
     - Everything else (YouTube, BibleProject, podcasts, Claude): straight to the network, untouched.
   scripts/build-public.py fills in v157 on every build; a new version replaces the old app copy. */
const VERSION = "v157";
const GH = "https://sixcore-droid.github.io/bible-study-app/";
const PAGE = "/bible-study-app/";
const SHELL = "bsa-shell-" + VERSION, DATA = "bsa-data", LIVE = "bsa-live";
const SHELL_FILES = [PAGE].concat(["jayms-ref.js", "jayms-store.js", "x-discuss.js", "jayms-study.js", "jayms-study.css", "help.html",
  "version.json", "plans/index.json", "pwa/icon-192.png", "pwa/icon-512.png"].map(function (f) { return GH + f; }));

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(SHELL_FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("bsa-shell-") === 0 && k !== SHELL; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* the saved copy at once, a fresh one fetched behind it for next time */
function staleWhileRevalidate(req, name) {
  return caches.open(name).then(function (c) {
    return c.match(req).then(function (hit) {
      var fresh = fetch(req).then(function (r) { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; });
      if (hit) { fresh.catch(function () {}); return hit; }
      return fresh;
    });
  });
}
/* the network first; the saved copy when there's no connection (or it takes more than 4 seconds) */
function networkFirst(req, name, key) {
  key = key || req;
  return caches.open(name).then(function (c) {
    return new Promise(function (resolve) {
      var done = false, give = function (r) { if (!done && r) { done = true; resolve(r); } };
      fetch(req).then(function (r) { if (r && r.ok) c.put(key, r.clone()); give(r); })
        .catch(function () { c.match(key).then(function (hit) { if (hit) give(hit); else if (!done) { done = true; resolve(Response.error()); } }); });
      setTimeout(function () { c.match(key).then(give); }, 4000);
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (req.mode === "navigate" && url.origin === location.origin && url.pathname === PAGE) {
    e.respondWith(networkFirst(req, SHELL, PAGE)); return;   // every visit to the app, whatever its ?query, shares one saved page
  }
  if (req.url.indexOf(GH) === 0) {
    e.respondWith(caches.match(req, { cacheName: SHELL }).then(function (hit) { return hit || staleWhileRevalidate(req, DATA); }));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") { e.respondWith(staleWhileRevalidate(req, DATA)); return; }
  if (url.origin === location.origin && url.pathname.indexOf("/wp-json/") === 0) { e.respondWith(networkFirst(req, LIVE)); return; }
});
