// On-device translation — free, unlimited, no server quota.
// Primary: Chrome/Edge built-in Translator + LanguageDetector APIs (on-device AI,
// no network, no key). Fallback: caller falls back to server (gtx endpoint).
// https://developer.chrome.com/docs/ai/translator-api

const translatorCache = new Map(); // `${src}=>${tgt}` -> Translator instance
const availabilityCache = new Map();

const getTranslatorNS = () => {
  if (typeof self !== "undefined" && self.Translator) return self.Translator;
  if (typeof window !== "undefined" && window.Translator) return window.Translator;
  return null;
};

const getDetectorNS = () => {
  if (typeof self !== "undefined" && self.LanguageDetector) return self.LanguageDetector;
  if (typeof window !== "undefined" && window.LanguageDetector) return window.LanguageDetector;
  return null;
};

export const isOnDeviceTranslateSupported = () => !!getTranslatorNS();

export const getOnDeviceEngineLabel = () => {
  if (getTranslatorNS()) return "on-device";
  return null;
};

const normalizeLang = (code) => {
  if (!code || typeof code !== "string") return "en";
  // BCP47 primary subtag only ("en-US" -> "en", "zh-Hans" -> "zh")
  return code.trim().toLowerCase().split(/[-_]/)[0] || "en";
};

export const detectLanguageOnDevice = async (text) => {
  const Detector = getDetectorNS();
  if (!Detector) return "auto";
  try {
    const sample = String(text || "").slice(0, 1000);
    if (!sample.trim()) return "auto";
    if (typeof Detector.availability === "function") {
      const avail = await Detector.availability();
      if (avail === "unavailable") return "auto";
    }
    const detector = await Detector.create();
    try {
      const results = await detector.detect(sample);
      const top = Array.isArray(results) ? results[0] : results;
      const lang = top?.detectedLanguage || top?.language;
      if (lang && lang !== "und") return normalizeLang(lang);
    } finally {
      try {
        detector.destroy?.();
      } catch {}
    }
  } catch {}
  return "auto";
};

const checkAvailability = async (Translator, src, tgt) => {
  const key = `${src}=>${tgt}`;
  if (availabilityCache.has(key)) return availabilityCache.get(key);
  try {
    if (typeof Translator.availability === "function") {
      const status = await Translator.availability({ sourceLanguage: src, targetLanguage: tgt });
      availabilityCache.set(key, status);
      return status;
    }
    // Older implementations without availability(): assume creatable.
    availabilityCache.set(key, "available");
    return "available";
  } catch {
    availabilityCache.set(key, "unavailable");
    return "unavailable";
  }
};

/**
 * Translate fully on-device. Throws with `code`:
 *  - "UNSUPPORTED" (no Translator API in this browser)
 *  - "UNAVAILABLE" (language pair not installed / can't download)
 *  - "FAILED" (translation error)
 */
export const translateOnDevice = async (rawText, targetLang, opts = {}) => {
  const Translator = getTranslatorNS();
  if (!Translator) {
    const err = new Error("On-device translator not supported in this browser");
    err.code = "UNSUPPORTED";
    throw err;
  }
  const text = String(rawText || "");
  if (!text.trim()) {
    const err = new Error("No text to translate");
    err.code = "FAILED";
    throw err;
  }
  const tgt = normalizeLang(targetLang || "en");
  let src = normalizeLang(opts.sourceLang || "");
  if (!opts.sourceLang || opts.sourceLang === "auto") {
    const detected = await detectLanguageOnDevice(text);
    src = detected === "auto" ? "en" : detected;
    // Same-language shortcut — no model needed.
    if (src === tgt) {
      return { text, sourceLang: src, targetLang: tgt, engine: "on-device" };
    }
  }

  const status = await checkAvailability(Translator, src, tgt);
  if (status === "unavailable") {
    const err = new Error(`Language pair ${src}→${tgt} not available on-device`);
    err.code = "UNAVAILABLE";
    throw err;
  }

  const cacheKey = `${src}=>${tgt}`;
  let translator = translatorCache.get(cacheKey);
  if (!translator) {
    try {
      translator = await Translator.create({
        sourceLanguage: src,
        targetLanguage: tgt,
        ...(opts.monitorProgress && typeof opts.onProgress === "function"
          ? {
              monitor: (m) => {
                try {
                  m.addEventListener?.("downloadprogress", (e) => {
                    opts.onProgress(e.loaded ?? 0);
                  });
                } catch {}
              },
            }
          : {}),
      });
      translatorCache.set(cacheKey, translator);
    } catch (e) {
      const err = new Error("Could not create on-device translator");
      err.code = "UNAVAILABLE";
      err.cause = e;
      throw err;
    }
  }

  // Chrome handles long input, but chunk to stay safe on large messages.
  const chunks = [];
  const CHUNK = 1500;
  for (let i = 0; i < text.length; i += CHUNK) chunks.push(text.slice(i, i + CHUNK));
  try {
    const out = [];
    for (const c of chunks) out.push(await translator.translate(c));
    return { text: out.join(""), sourceLang: src, targetLang: tgt, engine: "on-device" };
  } catch (e) {
    // Drop broken instance so next try re-creates.
    try {
      translatorCache.delete(cacheKey);
      translator.destroy?.();
    } catch {}
    const err = new Error("On-device translation failed");
    err.code = "FAILED";
    err.cause = e;
    throw err;
  }
};

/** Pre-warm: check pair availability without translating (for UI badges). */
export const probeOnDevicePair = async (sourceLang, targetLang) => {
  const Translator = getTranslatorNS();
  if (!Translator) return "unsupported";
  try {
    return await checkAvailability(Translator, normalizeLang(sourceLang || "en"), normalizeLang(targetLang || "en"));
  } catch {
    return "unavailable";
  }
};
