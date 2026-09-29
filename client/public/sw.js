// StressCare service worker. It exists for one job: receive push messages from the
// server and show them as system notifications, even when the site isn't open.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // If the app is open and in front, the in-app toast already covers it. Tell the
    // page to refresh its inbox instead of popping a second alert on top.
    const focused = windows.filter((w) => w.visibilityState === 'visible' && w.focused);
    if (focused.length) {
      focused.forEach((w) => w.postMessage({ type: 'notification-arrived' }));
      return;
    }

    windows.forEach((w) => w.postMessage({ type: 'notification-arrived' }));
    await self.registration.showNotification(data.title || 'StressCare', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      // Same tag replaces the previous one, so a busy group chat stays a single alert.
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/notifications' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/notifications', self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse a tab that's already on StressCare rather than opening another.
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        client.postMessage({ type: 'navigate', url: target });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
