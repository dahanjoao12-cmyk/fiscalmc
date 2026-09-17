const CACHE = "moreira-castro-shell-v2";
// Keep this prefix in sync with BASE_PATH in src/lib/base-path.ts — this file
// is a static public/ asset, not processed by the bundler, so it can't import it.
const BASE_PATH = "/emissor";
const SHELL = [`${BASE_PATH}/`, `${BASE_PATH}/app`, `${BASE_PATH}/app/emitir`, `${BASE_PATH}/manifest.webmanifest`, `${BASE_PATH}/icon-192.svg`, `${BASE_PATH}/icon-512.svg`];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === location.origin) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || new Response("Você precisa estar conectado à internet para emitir uma NFS-e.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }))));
});
