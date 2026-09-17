import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useEffect } from "react";
import { Loader } from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/react";

// Lazy load pages to drastically reduce the initial JS bundle size
const HomePage = lazy(() => import("./pages/HomePage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const WelcomePage = lazy(() => import("./pages/WelcomePage"));

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <SpeedInsights />
    </div>
  );
}

export default App;
