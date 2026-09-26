// Pulse Messenger Service Worker: Web Push, offline shell & runtime caching.
// NOTE: __BUILD_ID__ is replaced with the git SHA / timestamp at build time
// (see scripts/stamp-sw-dist.js) so every deploy gets a fresh cache and old
// cached shells can never mix with new hashed chunks across releases.

const CACHE_NAME = "pulse-cache-__BUILD_ID__";
const STATIC_ASSETS = ["/", "/index.html", "/offline.html", "/favicon.png", "/manifest.json"];

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
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

const isApiRequest = (url) =>
  url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io/");

const isStaticAsset = (url) =>
  url.origin === self.location.origin &&
  /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|json)$/i.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // API + realtime traffic must never be cached
  if (isApiRequest(url)) return;

  // Navigations: network first, fall back to cached shell, then offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Never poison the shell with error pages.
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match("/index.html").then((cached) => cached || caches.match("/offline.html"))
        )
    );
    return;
  }

  // Versioned static assets: stale-while-revalidate with LRU cap.
  // Media excluded (mp3/wav/webm/mp4) — never cache voice notes/calls.
  if (isStaticAsset(url)) {
    if (/\.(mp3|wav|webm|mp4)$/i.test(url.pathname)) return;
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then(async (cache) => {
                try {
                  await cache.put(request, copy);
                  // LRU cap ~120 entries.
                  const keys = await cache.keys();
                  if (keys.length > 120) {
                    await cache.delete(keys[0]);
                  }
                } catch {}
              }).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

// Web Push event listener
self.addEventListener("push", (event) => {
  let data = {
    title: "Pulse Messenger",
    body: "New encrypted message received",
    url: "/",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const isCall = data?.data?.type === "call" || data?.type === "call";
  const tag = isCall
    ? `pulse-call-${data?.data?.callerId || data?.callerId || "unknown"}`
    : `pulse-chat-${data?.data?.chatType || "dm"}-${data?.data?.chatId || "unknown"}`;

  const options = {
    body: data.body || (isCall ? "Incoming call" : "New activity in Pulse Messenger"),
    icon: data.icon || "/favicon.png",
    badge: data.badge || "/favicon.png",
    vibrate: isCall ? [300, 100, 300, 100, 300] : [150, 80, 150],
    tag,
    renotify: true,
    requireInteraction: isCall,
    data: {
      url: data.url || pushTargetUrl(data?.data || data),
      ...(data?.data || {}),
    },
    actions: [
      { action: "open", title: isCall ? "Open App" : "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Deep-link target derived from the push payload when the sender didn't
// include an explicit url: ?chat=<type>:<id> or ?callFrom=<userId>.
function pushTargetUrl(d) {
  try {
    if (!d) return "/";
    if (d.type === "message" && d.chatId) {
      return `/?chat=${encodeURIComponent(`${d.chatType || "user"}:${d.chatId}`)}`;
    }
    if (d.type === "call" && d.callerId) {
      return `/?callFrom=${encodeURIComponent(d.callerId)}`;
    }
    return d.url || "/";
  } catch {
    return "/";
  }
}

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Prefer a tab already on the target conversation
      try {
        const target = new URL(targetUrl, self.location.origin);
        const targetChat = target.searchParams.get("chat");
        for (const client of windowClients) {
          const clientUrl = new URL(client.url);
          if (
            targetChat &&
            clientUrl.pathname === target.pathname &&
            clientUrl.searchParams.get("chat") === targetChat &&
            "focus" in client
          ) {
            return client.focus();
          }
        }
      } catch {}
      for (const client of windowClients) {
        if ("focus" in client) {
          client.postMessage
            ? client.postMessage({ type: "pulse:push-open", url: targetUrl })
            : null;
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
