import { Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { Loader } from "lucide-react";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { App as CapApp } from "@capacitor/app";
import { notificationManager } from "./lib/notification";
import { syncNativeBackgroundService, getPendingNativeChat, clearPendingNativeChat } from "./lib/backgroundSync";
import { ensurePushTransports } from "./lib/push";

// Lazy load pages to drastically reduce the initial JS bundle size
const HomePage = lazyWithRetry(() => import("./pages/HomePage"));
const SignUpPage = lazyWithRetry(() => import("./pages/SignUpPage"));
const LoginPage = lazyWithRetry(() => import("./pages/LoginPage"));
const WelcomePage = lazyWithRetry(() => import("./pages/WelcomePage"));
const ForgotPasswordPage = lazyWithRetry(() => import("./pages/ForgotPasswordPage"));

function App() {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: "#00000000" }).catch(() => {});
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      SplashScreen.hide().catch(() => {});
      notificationManager.initNative().then(() => {
        notificationManager.requestPermission().catch(() => {});
      }).catch(() => {});

      // Check cold-start pending notification chats immediately
      getPendingNativeChat().then((pending) => {
        if (pending && pending.chatId) {
          useChatStore.getState().openChatById(pending.chatId, pending.chatType || "user", pending);
          clearPendingNativeChat().catch(() => {});
        }
      }).catch(() => {});

      const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          useAuthStore.getState().connectSocket();
          // Check if notification or deep link opened the app while in background
          getPendingNativeChat().then((pending) => {
            if (pending && pending.chatId) {
              useChatStore.getState().openChatById(pending.chatId, pending.chatType || "user", pending);
              clearPendingNativeChat().catch(() => {});
            }
          }).catch(() => {});
        }
      });

      const urlSub = CapApp.addListener("appUrlOpen", (data) => {
        try {
          const urlStr = data?.url || "";
          if (urlStr.startsWith("pulse://chat/")) {
            const raw = urlStr.replace("pulse://chat/", "");
            const parts = raw.split("/");
            const chatType = parts[0] || "user";
            let rawChatId = parts[1] || "";
            let senderName = "";
            if (rawChatId.includes("?")) {
              const qIdx = rawChatId.indexOf("?");
              const q = new URLSearchParams(rawChatId.substring(qIdx));
              senderName = q.get("senderName") || "";
              rawChatId = rawChatId.substring(0, qIdx);
            }
            if (rawChatId) {
              useChatStore.getState().openChatById(rawChatId, chatType, { senderName });
            }
          } else if (urlStr.startsWith("pulse://call/")) {
            const callerId = urlStr.replace("pulse://call/", "").split("?")[0];
            if (callerId) {
              useChatStore.getState().openChatById(callerId, "user");
            }
          }
        } catch {}
      });

      return () => {
        sub.then((h) => h.remove()).catch(() => {});
        urlSub.then((h) => h.remove()).catch(() => {});
      };
    }
  }, []);

  useEffect(() => {
    if (authUser && Capacitor.isNativePlatform()) {
      notificationManager.requestPermission().catch(() => {});
      ensurePushTransports().catch(() => {});
      syncNativeBackgroundService(authUser._id || authUser.id).catch(() => {});

      // On cold boot when authentication finishes, open pending notification chat if present
      getPendingNativeChat().then((pending) => {
        if (pending && pending.chatId) {
          useChatStore.getState().openChatById(pending.chatId, pending.chatType || "user", pending);
          clearPendingNativeChat().catch(() => {});
        }
      }).catch(() => {});
    }
  }, [authUser]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-full apple-ambient-bg">
        <Loader className="size-8 animate-spin text-palette-mint" />
      </div>
    );

  return (
    <div className="h-full apple-ambient-bg flex flex-col">
      <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader className="size-8 animate-spin text-palette-mint" /></div>}>
        <Routes>
          <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/welcome" replace />} />
          <Route path="/welcome" element={!authUser ? <WelcomePage /> : <Navigate to="/" replace />} />
          <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" replace />} />
          <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" replace />} />
          <Route path="/forgot-password" element={!authUser ? <ForgotPasswordPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
