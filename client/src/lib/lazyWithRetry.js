// Lazy import with one retry for flaky networks / mid-deploy chunk 404s.
// Without this, a single failed chunk fetch hard-crashes into the error
// boundary (red screen). Retried once; a persistent failure surfaces the
// original import error so callers can render a graceful fallback.
import { lazy } from "react";

export const lazyWithRetry = (importer) =>
  lazy(async () => {
    try {
      return await importer();
    } catch {
      // Likely a new deploy invalidated the hashed chunk URL, or a network
      // blip. One retry after a short backoff; bust the SW/HTTP cache.
      await new Promise((r) => setTimeout(r, 800));
      try {
        return await importer();
      } catch (err2) {
        console.error("[lazyWithRetry] chunk failed twice:", err2?.message || err2);
        throw err2;
      }
    }
  });

export default lazyWithRetry;
