/* C-Diary service worker
 * - Keeps a copy of Today, Calendar and Matters so they open with no signal (e.g. in a courtroom)
 * - Shows hearing reminders sent as push notifications
 * Bump VERSION when this file changes so phones pick up the new copy.
 */
const VERSION = 'v1';
const STATIC_CACHE = `cdiary-static-${VERSION}`;
const PAGE_CACHE = 'cdiary-pages'; // cleared on sign-out (see components/SignOutButton.tsx)
const OFFLINE_PAGES = ['/today', '/calendar', '/matters'];
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/brand/c-diary-mark.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cdiary-static-') && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isPage = (req) => req.mode === 'navigate' && req.method === 'GET';
const offlinePath = (url) => OFFLINE_PAGES.find((p) => url.pathname === p);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Built JS/CSS files never change once published: serve from cache, fetch once.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC_CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  // Pages: always try the network first so the diary is current. Save Today, Calendar and Matters
  // after each successful visit, and fall back to the saved copy when there's no signal.
  if (isPage(req)) {
    const keep = offlinePath(url);
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only keep real pages for signed-in users, not redirects to the sign-in page.
          if (keep && res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(keep, copy));
          }
          return res;
        })
        .catch(async () => (keep && (await caches.match(keep, { cacheName: PAGE_CACHE }))) || (await caches.match('/today', { cacheName: PAGE_CACHE })) || caches.match('/offline.html')),
    );
  }
});

// ---------- Push notifications ----------
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'C-Diary';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/today' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/today', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { w.navigate(target); return w.focus(); }
      }
      return self.clients.openWindow(target);
    }),
  );
});
