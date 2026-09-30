import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useEffect } from "react";
import { Loader } from "lucide-react";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { Analytics } from "@vercel/analytics/react";

// Lazy load pages to drastically reduce the initial JS bundle size
const HomePage = lazyWithRetry(() => import("./pages/HomePage"));
const SignUpPage = lazyWithRetry(() => import("./pages/SignUpPage"));
const LoginPage = lazyWithRetry(() => import("./pages/LoginPage"));
const WelcomePage = lazyWithRetry(() => import("./pages/WelcomePage"));
const ForgotPasswordPage = lazyWithRetry(() => import("./pages/ForgotPasswordPage"));

function App() {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();

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
      <Analytics />
    </div>
  );
}

export default App;
