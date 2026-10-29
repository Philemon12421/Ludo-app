/* Ludoka service worker – offline support.
   Strategy: stale-while-revalidate for same-origin GET requests, so the app loads
   instantly (and offline) and picks up new deployments on the next visit.
   Bump VERSION to force old caches to be cleared. */

const VERSION = 'ludoka-v2';
const PRECACHE = [
    '/',
    '/index.html',
    '/index.css',
    '/index.js',
    '/manifest.webmanifest',
    '/favicon.ico',
    '/icons/favicon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(VERSION)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.open(VERSION).then(async (cache) => {
            const cached = await cache.match(request, { ignoreSearch: true });

            const network = fetch(request)
                .then((response) => {
                    if (response && response.ok) cache.put(request, response.clone());
                    return response;
                })
                .catch(() => null);

            if (cached) {
                event.waitUntil(network);
                return cached;
            }

            const fresh = await network;
            if (fresh) return fresh;

            // Offline and not cached: fall back to the app shell for page navigations
            if (request.mode === 'navigate') {
                const shell = await cache.match('/index.html');
                if (shell) return shell;
            }
            return new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
});
