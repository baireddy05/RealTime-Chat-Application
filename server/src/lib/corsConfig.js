export const isOriginAllowed = (origin) => {
  // Null origin (curl, cron, server-to-server) has no cookies to protect;
  // credentialed CORS is decided per-request by the cors middleware below.
  if (!origin) return false;

  const normalized = origin.trim().replace(/\/$/, "");

  // Check explicit CLIENT_URL (supports comma-separated list and trailing slashes)
  if (process.env.CLIENT_URL) {
    const envOrigins = process.env.CLIENT_URL.split(",")
      .map((u) => u.trim().replace(/\/$/, ""))
      .filter(Boolean);
    if (envOrigins.includes(normalized)) return true;
  }

  // Vercel preview deployments: only allow when explicitly opted in, never
  // with credentials by default (prevents any *.vercel.app from getting cookies).
  if (process.env.ALLOW_VERCEL_PREVIEWS === "true") {
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname.endsWith(".vercel.app")) {
        return true;
      }
    } catch {
      // Ignore invalid URL parse
    }
  }

  // Allow local development origins
  if (
    normalized.startsWith("http://localhost:") ||
    normalized.startsWith("http://127.0.0.1:")
  ) {
    return true;
  }

  return false;
};

export const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS origin not allowed: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
};
