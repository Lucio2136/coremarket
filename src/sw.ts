/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let payload: { title: string; body: string; url?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Coremarket", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:    payload.body,
      icon:    "/pwa-icon.svg",
      badge:   "/pwa-icon.svg",
      tag:     "coremarket-push",
      data:    { url: payload.url ?? "/" },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url: string = event.notification.data?.url ?? "/";
  event.waitUntil(
    (self as any).clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: WindowClient[]) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        return (self as any).clients.openWindow(url);
      })
  );
});
