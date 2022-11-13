// give your cache a name
const cacheName = "lidysisku-cache";

// put the static assets and routes you want to cache here
const filesToCache = [
  "/",
  "index.html",
  "sozysozbot_jvozba/docs/rafsi_list.js",
  "sozysozbot_jvozba/docs/scoring.js",
  "sozysozbot_jvozba/docs/tools.js",
  "sozysozbot_jvozba/docs/jvokaha.js",
  "sozysozbot_jvozba/docs/jvozba.js",
  "jvs-en.json",
  "jvs-ja.json",
  "jvs-jbo.json",
];

self.addEventListener("activate", (e) => self.clients.claim());

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(cacheName).then((cache) => cache.addAll(filesToCache))
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches
      .match(e.request)
      .then((response) => (response ? response : fetch(e.request)))
  );
});
