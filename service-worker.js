// Stale-while-revalidate: answer from the cache, then refresh it in the
// background, so returning visitors get updates on their next load.
const cacheName = "lidysisku-v2";

// Files the first visit fetches before this worker is in control. A missing
// file is skipped rather than failing the install.
const filesToPrecache = [
  "./",
  "main.js",
  "favicon.png",
  "latkerlo-jvotci/js/docs/data.js",
  "latkerlo-jvotci/js/docs/rafsi.js",
  "latkerlo-jvotci/js/docs/tarmi.js",
  "latkerlo-jvotci/js/docs/tools.js",
  "latkerlo-jvotci/js/docs/jvozba.js",
  "latkerlo-jvotci/js/docs/katna.js",
  "etymo.json",
  "boxnotes.json",
  "jvs-en.json",
  "jvs-ja.json",
  "jvs-jbo.json",
  "notes-en.json",
  "notes-ja.json",
  "notes-jbo.json",
];

const appPath = new URL("./", self.location).pathname;

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await Promise.allSettled(
        filesToPrecache.map((file) =>
          cache.add(new Request(file, { cache: "reload" }))
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== cacheName) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  // The app rewrites its URL to ?lang#query; all of those are the same page.
  const key = url.pathname === appPath ? "./" : e.request;

  e.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(key, { ignoreVary: true });
      const fresh = fetch(e.request).then(async (response) => {
        if (response.ok) await cache.put(key, response.clone());
        return response;
      });
      if (!cached) return fresh;
      e.waitUntil(fresh.catch(() => {}));
      return cached;
    })()
  );
});
