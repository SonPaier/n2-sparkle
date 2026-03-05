/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

const navigationHandler = new NetworkFirst({
  cacheName: 'navigation-cache',
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
  ],
});

registerRoute(new NavigationRoute(navigationHandler));

registerRoute(
  ({ url }) => url.origin.includes('supabase'),
  new NetworkFirst({
    cacheName: 'supabase-api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 }),
    ],
  })
);

registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
);

interface PushNotificationData {
  title?: string;
  body?: string;
  icon?: string;
  url?: string;
  tag?: string;
}

// Push notification handler
self.addEventListener('push', (event) => {
  let data: PushNotificationData = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (_e) {
      data = { body: event.data.text() };
    }
  }

  const options: NotificationOptions = {
    body: data.body || 'Nowa aktywność',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'notification-' + Date.now(),
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Powiadomienie', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return (client as WindowClient).navigate(url);
            }
          });
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => {
  console.log('[SW] Installing');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return !['navigation-cache', 'supabase-api-cache', 'static-assets', 'workbox-precache-v2'].some(
              (keep) => cacheName.includes(keep)
            );
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
