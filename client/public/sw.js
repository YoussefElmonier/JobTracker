/*
 * sw.js — Service Worker for TRKR PWA.
 * Handles background push notifications from ntfy.sh.
 */

self.addEventListener('push', (event) => {
  if (!(self.notificationPermission === 'granted')) {
    // console.log('Permission not granted');
  }

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    // Falls back to simple text if JSON parsing fails
    data = { message: event.data ? event.data.text() : 'New alert from TRKR' };
  }

  const title = data.title || 'TRKR Alert';
  const options = {
    body: data.message || data.body || 'Job search update detected!',
    icon: '/icon-192.png',
    badge: '/favicon.png', // Small icon for notification tray
    vibrate: [200, 100, 200],
    tag: 'trkr-notification', // Replaces old notifications with new ones of the same tag
    renotify: true,
    data: {
      url: data.click || '/dashboard'
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
