/*
 * sw.js — Service Worker for TRKR PWA. v4
 * Handles background push notifications from ntfy.sh.
 */

// Force new SW to take over from old one immediately
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { message: event.data.text() };
    }
  }

  // Surgical extraction from ntfy schema
  const title   = data.title || 'TRKR Alert';
  const message = data.message || (typeof data === 'string' ? data : 'Job search update detected!');
  const click   = data.click || data.url || '/dashboard';

  const options = {
    body: message, 
    icon: '/icon-192.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    tag: 'trkr-notification',
    renotify: true,
    data: {
      url: click
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* Handle clicking on the notification banner */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Open the target dashboard URL or focus an existing window
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if we already have the dashboard open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
