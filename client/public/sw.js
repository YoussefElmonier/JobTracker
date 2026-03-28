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

  // Bulletproof extraction: check all common keys
  const title = data.title || data.t || 'TRKR Alert';
  let message = data.message || data.body || data.m || data.text;

  // If we still don't have a string message, use a fallback or stringify what we have
  if (!message || typeof message !== 'string') {
    if (typeof data === 'string') {
      message = data;
    } else if (data.message && typeof data.message === 'string') {
      message = data.message;
    } else {
      message = 'New job search update detected!';
    }
  }

  const clickUrl = data.click || data.url || data.link || '/dashboard';

  const options = {
    body: message, 
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
