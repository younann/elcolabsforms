/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/\.netlify\//] }));

// update prompt
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('push', (e) => {
  let p: { title?: string; body?: string; url?: string; badge?: boolean } = {};
  try {
    p = e.data?.json() ?? {};
  } catch {
    p = { body: e.data?.text() };
  }
  // dot until the app opens and sets the real count
  if (p.badge) void self.navigator.setAppBadge?.().catch(() => {});
  e.waitUntil(
    self.registration.showNotification(p.title ?? 'ELCO', {
      body: p.body,
      data: { url: p.url ?? '/' },
      icon: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'he',
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data as { url?: string })?.url ?? '/', self.location.origin).href;
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) {
        await win.focus();
        await win.navigate(url).catch(() => {});
      } else await self.clients.openWindow(url);
    })(),
  );
});
