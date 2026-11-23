/* Radio Chat Unlimited M0XOO web app - always loads the newest version; uses the last copy only when offline */
var C = "rcu-web";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method != "GET" || new URL(r.url).origin != location.origin) return;
  e.respondWith(fetch(r, { cache: "no-cache" }).then(function (res) {
    if (res.ok) { var c = res.clone(); caches.open(C).then(function (k) { k.put(r, c); }); }
    return res;
  }).catch(function () { return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match("./"); }); }));
});
