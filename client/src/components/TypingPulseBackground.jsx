import { useState, useEffect, useRef } from "react";
import { getCaretCoordinates } from "../lib/pulseShockwave";

export default function TypingPulseBackground() {
  const [pulses, setPulses] = useState([]);
  const pulseIdRef = useRef(0);

  useEffect(() => {
    const handleInput = (e) => {
      if (window.innerWidth < 768) return;
      const target = e.target;
      if (!target) return;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.getAttribute?.("contenteditable") === "true";

      if (isInput) {
        const coords = getCaretCoordinates(target);
        const id = ++pulseIdRef.current;
        
        // Exactly one wave per letter typed
        setPulses((prev) => [...prev.slice(-10), { id, x: coords.x, y: coords.y }]);

        setTimeout(() => {
          setPulses((prev) => prev.filter((p) => p.id !== id));
        }, 2200);
      }
    };

    const handleCustomPulse = (e) => {
      if (window.innerWidth < 768) return;
      if (e.detail && typeof e.detail.x === "number" && typeof e.detail.y === "number") {
        const id = ++pulseIdRef.current;
        setPulses((prev) => [...prev.slice(-10), { id, x: e.detail.x, y: e.detail.y }]);
        setTimeout(() => {
          setPulses((prev) => prev.filter((p) => p.id !== id));
        }, 2200);
      }
    };

    // Use bubbling listener (passive) so it never captures or interferes with React form controls
    window.addEventListener("input", handleInput, { passive: true });
    window.addEventListener("pulse-shockwave", handleCustomPulse);

    return () => {
      window.removeEventListener("input", handleInput);
      window.removeEventListener("pulse-shockwave", handleCustomPulse);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-background transition-colors duration-300">
      {/* Calm resting background layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[rgb(var(--bg-surface-rgb))] to-background opacity-95 transition-colors duration-300" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-black/[0.02] dark:bg-cyan-500/[0.05] blur-[140px] pointer-events-none" />

      {/* Exactly one wave per letter typed (Desktop only) */}
      <div className="hidden md:block">
        {pulses.map((pulse) => (
          <div
            key={pulse.id}
            className="absolute pointer-events-none select-none"
            style={{
              left: `${pulse.x}px`,
              top: `${pulse.y}px`,
            }}
          >
            {/* Exactly one single liquid-glass wave ring per letter typed */}
            <div className="absolute -top-[250px] -left-[250px] w-[500px] h-[500px] rounded-full border-2 border-cyan-500/30 dark:border-cyan-400/50 shadow-[0_0_40px_rgba(0,240,255,0.15)] dark:shadow-[0_0_40px_rgba(0,255,157,0.30)] animate-single-typing-wave" />
          </div>
        ))}
      </div>
    </div>
  );
}
