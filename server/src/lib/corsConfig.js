export const isOriginAllowed = (origin) => {
  // Allow requests without Origin header (cron jobs, curl, server-to-server, uptime monitors)
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/$/, "");

  // Check explicit CLIENT_URL (supports comma-separated list and trailing slashes)
  if (process.env.CLIENT_URL) {
    const envOrigins = process.env.CLIENT_URL.split(",")
      .map((u) => u.trim().replace(/\/$/, ""))
      .filter(Boolean);
    if (envOrigins.includes(normalized)) return true;
  }

  // Allow all Vercel deployments (*.vercel.app) or preview deployments when configured
  try {
    const parsed = new URL(normalized);
    if (parsed.hostname.endsWith(".vercel.app")) {
      return true;
    }
  } catch {
    // Ignore invalid URL parse
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
    // Requests without origin (cron jobs, server-to-server, curl) or allowed origins
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      // Use callback(null, false) so browser rejects CORS without crashing Express with 500
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
};
