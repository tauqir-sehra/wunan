// wunan's service worker: lets members add wunan to their home screen and shows device
// notifications (FR-031a; contracts/notifications.md).
//
// Only the app's own built files and icons are cached. Pages are never cached: they contain
// members' messages and details, and phones and computers are sometimes shared.
import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';
import { self } from '$app/service-worker';

const CACHE = `wunan-${version}`;
const SHELL = [...immutable, ...assets].map((file) => file.path);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark">
<title>Offline · wunan</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5">
<h1 style="font-size: 1.5rem">You're offline</h1>
<p>wunan needs an internet connection. Everything will be here when you're back online.</p>
</body></html>`;

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((cached) => cached ?? fetch(request)));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () => new Response(OFFLINE_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } })
      )
    );
  }
});

type Payload = { title: string; body: string; url: string };

self.addEventListener('push', (event) => {
  let payload: Payload | null;
  try {
    payload = event.data?.json() as Payload;
  } catch {
    payload = null;
  }
  const title = payload?.title || 'Something new in wunan';
  // Quiet by design: no sound, no vibration, no urgency (constitution V).
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload?.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      silent: true,
      data: { url: safePath(payload?.url) }
    })
  );
});

/** Opens only paths on this site, never other sites. */
function safePath(path: unknown) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/';
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = safePath((event.notification.data as { url?: unknown } | null)?.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        await open.navigate(path);
      } else {
        await self.clients.openWindow(path);
      }
    })()
  );
});
