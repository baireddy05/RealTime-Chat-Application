import { useState, useEffect, useCallback } from "react";

export const usePWAInstall = () => {
  const isInitiallyStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator?.standalone === true);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(Boolean(isInitiallyStandalone));

  useEffect(() => {
    if (isInitiallyStandalone) {
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      // Prevent automatic browser mini-infobar on mobile
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isInitiallyStandalone]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      // iOS Safari never fires beforeinstallprompt — surface guidance instead.
      const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent || "") && !window.MSStream;
      if (isIOS) return { outcome: "ios-manual", message: "On iPhone: Share → Add to Home Screen." };
      return { outcome: "unavailable" };
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      // Deferred prompt is one-shot either way — clear so UI doesn't go dead.
      setDeferredPrompt(null);
      if (choiceResult.outcome === "accepted") {
        // Don't mark installed yet; wait for appinstalled event (OS step may abort).
        setIsInstallable(false);
      } else {
        setIsInstallable(false);
      }
      return choiceResult;
    } catch (err) {
      console.error("PWA install prompt error:", err);
      setDeferredPrompt(null);
      setIsInstallable(false);
      return { outcome: "dismissed" };
    }
  }, [deferredPrompt]);

  const isIOSManual =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent || "");

  return {
    isInstallable,
    isInstalled,
    isIOSManual,
    promptInstall,
  };
};

export default usePWAInstall;
