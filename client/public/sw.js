/*
 * sw.js — Service Worker for TRKR PWA. v7
 * Handles background push notifications from ntfy.sh.
 */

// Force the new Service Worker to take over immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  
  if (event.data) {
    const rawText = event.data.text();
    try {
      // 1. Try native JSON parsing from the push event
      data = event.data.json();
    } catch (e) {
      try {
        // 2. Fallback: Parse the raw text manually if it's a JSON string
        data = JSON.parse(rawText);
      } catch (e2) {
        // 3. Last Fallback: It's just raw text
        data = { message: rawText };
      }
    }
  }

  // Pick out the actual message and title using all possible keys ntfy uses
  const title   = data.title || data.t || 'TRKR Alert';
  let message = data.message || data.body || data.m || data.text;

  // Final Safety check: ensure we don't display [object Object]
  if (!message || typeof message !== 'string') {
    if (typeof data === 'string') {
      message = data;
    } else {
      // If we're stuck with an object we can't parse, just say job update
      message = 'New job search update detected!';
    }
  }

  const clickUrl = data.click || data.url || data.link || '/dashboard';

  const options = {
    body: message,
    icon: '/icon-192.png',
    badge: '/favicon.png', // Small icon for tray
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
