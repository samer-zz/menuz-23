const CACHE_NAME = "menuz-pwa-v4";
const IMAGE_CACHE_NAME = "menuz-images-v4";
const MAX_CACHED_IMAGES = 80;

const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/branding/menuz1_logo.png",
  "/branding/menuz2_logo.png",
  "/branding/menuz_mark_white.png",
  "/branding/menuz_mark_navy.png",
  "/branding/samerz_logo.png",
  "/branding/indomito_logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          // Only clean up old MENUZ caches; never delete third-party/other-app caches
          if (
            key.startsWith("menuz-") &&
            key !== CACHE_NAME &&
            key !== IMAGE_CACHE_NAME
          ) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

async function trimImageCache() {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const keys = await cache.keys();
  if (keys.length > MAX_CACHED_IMAGES) {
    const excess = keys.length - MAX_CACHED_IMAGES;
    await Promise.all(keys.slice(0, excess).map((req) => cache.delete(req)));
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache APIs, auth routes, or private admin/dashboard pages
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/auth")
  ) {
    return;
  }

  // Navigation requests: Network first with offline cache fallback (marks stale cached copy)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            const headers = new Headers(cached.headers);
            headers.set("x-menuz-offline-cache", "1");
            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers,
            });
          }
          return caches.match("/offline");
        })
    );
    return;
  }

  // Public images & branding assets: Stale-while-revalidate with bounded cache
  if (
    request.destination === "image" ||
    url.pathname.startsWith("/branding/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches
                .open(IMAGE_CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .then(() => trimImageCache())
                .catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});

// Web Push notification receiver (for explicitly subscribed users)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {
    title: "مينوز | MENUZ",
    body: "عرض جديد متاح الآن في المنيو",
    icon: "/icons/icon-192.png",
    url: "/",
  };
  try {
    const parsed = event.data.json();
    payload = { ...payload, ...parsed };
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir: "rtl",
      lang: "ar",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
