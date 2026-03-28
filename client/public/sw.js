/*
 * sw.js — Service Worker for TRKR PWA.
 * Handles background push notifications from ntfy.sh.
 */

self.addEventListener('push', (event) => {
  let data = {};
  
  if (event.data) {
    try {
      // ntfy.sh usually sends JSON for web push
      data = event.data.json();
    } catch (e) {
      // Fallback to plain text if it's not JSON
      data = { message: event.data.text() };
    }
  }

  // ntfy.sh JSON format usually uses 'message' or 'body'
  const message = data.message || data.body || (typeof data === 'string' ? data : 'New alert from TRKR');
  const title = data.title || 'TRKR Alert';
  const clickUrl = data.click || data.url || '/dashboard';

  const options = {
    body: typeof message === 'object' ? JSON.stringify(message) : message,
    icon: '/icon-192.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    tag: 'trkr-notification',
    renotify: true,
    data: {
      url: clickUrl
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
