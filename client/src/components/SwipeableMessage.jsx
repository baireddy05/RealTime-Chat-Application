import { useState, useRef, useEffect, useCallback } from "react";
import { Reply } from "lucide-react";

/**
 * WhatsApp / Telegram-Style Swipe-Right-to-Reply Component
 * 
 * High-performance, gesture-accurate swipe-to-reply:
 * - Native non-passive touch handling for 100% reliable mobile swipe prevention
 * - Direction-locking to preserve fluid vertical chat scrolling
 * - Unified desktop mouse/pointer drag support with window tracking
 * - Interactive element exclusion (buttons, 3-dots menu, links, reactions)
 * - Spring snap-back animation + haptic vibration feedback
 */
const SwipeableMessage = ({ children, onReply, disabled = false }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isThresholdMet, setIsThresholdMet] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  const containerRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const isHorizontalRef = useRef(null);
  const hasVibratedRef = useRef(false);
  const isPointerDownRef = useRef(false);

  const THRESHOLD = 38;
  const MAX_SWIPE = 75;

  // --- Touch Event Handlers (Attached natively with { passive: false }) ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (disabled || e.touches.length > 1) return;

      // Do not initiate swipe if touching an interactive element (3-dots, buttons, links, etc.)
      if (e.target.closest("button, a, input, textarea, select, [role='button'], .quick-reaction-btn")) {
        return;
      }

      const touch = e.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      currentOffsetRef.current = 0;
      isHorizontalRef.current = null;
      hasVibratedRef.current = false;
      setIsSwiping(false);
    };

    const onTouchMove = (e) => {
      if (disabled || e.touches.length > 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;

      // Lock direction after initial movement
      if (isHorizontalRef.current === null) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX > 6 || absY > 6) {
          // If swiping right with clear horizontal dominance
          if (deltaX > 6 && deltaX > absY * 0.85) {
            isHorizontalRef.current = true;
          } else {
            isHorizontalRef.current = false;
          }
        }
      }

      if (isHorizontalRef.current === true) {
        // Crucial: non-passive listener allows preventing browser gesture cancellations
        if (e.cancelable) {
          e.preventDefault();
        }

        setIsSwiping(true);
        const clampedX = Math.max(0, deltaX);
        const damped = clampedX > THRESHOLD 
          ? THRESHOLD + (clampedX - THRESHOLD) * 0.35 
          : clampedX;
        const finalOffset = Math.min(damped, MAX_SWIPE);

        currentOffsetRef.current = finalOffset;
        setSwipeOffset(finalOffset);

        const met = finalOffset >= THRESHOLD;
        setIsThresholdMet(met);

        if (met && !hasVibratedRef.current) {
          hasVibratedRef.current = true;
          if (typeof window !== "undefined" && window.navigator?.vibrate) {
            try {
              window.navigator.vibrate(12);
            } catch {}
          }
        } else if (!met && hasVibratedRef.current) {
          hasVibratedRef.current = false;
        }
      }
    };

    const onTouchEnd = () => {
      if (isHorizontalRef.current === true && currentOffsetRef.current >= THRESHOLD) {
        onReply?.();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("pulse:focus-input"));
        }
      }

      // Snap back smoothly
      setIsSwiping(false);
      setSwipeOffset(0);
      setIsThresholdMet(false);
      isHorizontalRef.current = null;
      hasVibratedRef.current = false;
      currentOffsetRef.current = 0;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, onReply, THRESHOLD, MAX_SWIPE]);

  // --- Desktop Mouse / Pointer Drag Support ---
  const handlePointerDown = (e) => {
    if (disabled || e.pointerType === "touch" || e.button !== 0) return;
    if (e.target.closest("button, a, input, textarea, select, img, [role='button'], .quick-reaction-btn")) return;

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentOffsetRef.current = 0;
    isHorizontalRef.current = null;
    isPointerDownRef.current = true;
    hasVibratedRef.current = false;

    const onWindowPointerMove = (ev) => {
      if (!isPointerDownRef.current) return;
      const deltaX = ev.clientX - startXRef.current;
      const deltaY = ev.clientY - startYRef.current;

      if (isHorizontalRef.current === null) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX > 7 || absY > 7) {
          if (deltaX > 7 && deltaX > absY * 0.85) {
            isHorizontalRef.current = true;
          } else {
            isHorizontalRef.current = false;
            isPointerDownRef.current = false;
          }
        }
      }

      if (isHorizontalRef.current === true) {
        setIsSwiping(true);
        const clampedX = Math.max(0, deltaX);
        const damped = clampedX > THRESHOLD 
          ? THRESHOLD + (clampedX - THRESHOLD) * 0.35 
          : clampedX;
        const finalOffset = Math.min(damped, MAX_SWIPE);

        currentOffsetRef.current = finalOffset;
        setSwipeOffset(finalOffset);

        const met = finalOffset >= THRESHOLD;
        setIsThresholdMet(met);
      }
    };

    const onWindowPointerUp = () => {
      if (isPointerDownRef.current && isHorizontalRef.current === true && currentOffsetRef.current >= THRESHOLD) {
        onReply?.();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("pulse:focus-input"));
        }
      }

      isPointerDownRef.current = false;
      setIsSwiping(false);
      setSwipeOffset(0);
      setIsThresholdMet(false);
      isHorizontalRef.current = null;
      currentOffsetRef.current = 0;

      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-visible touch-pan-y group/swipe select-none"
      onPointerDown={handlePointerDown}
    >
      {/* WhatsApp / Telegram Reply Icon Badge */}
      <div 
        className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center transition-all"
        style={{
          opacity: Math.min(1, Math.max(0, (swipeOffset - 6) / 28)),
          transform: `translateY(-50%) translateX(${Math.min(swipeOffset * 0.6, 26)}px) scale(${
            isThresholdMet ? 1.15 : Math.max(0.65, swipeOffset / THRESHOLD)
          })`,
        }}
      >
        <div 
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 shadow-md ${
            isThresholdMet
              ? "bg-accent-primary text-white shadow-accent-primary/40 ring-2 ring-accent-primary/30 scale-105"
              : "bg-[var(--glass-heavy)] border border-[var(--glass-border)] text-theme-muted"
          }`}
        >
          <Reply 
            size={15} 
            className={`transition-transform duration-150 ${
              isThresholdMet ? "scale-110" : "scale-90 opacity-80"
            }`} 
          />
        </div>
      </div>

      {/* Swipeable Message Row Content */}
      <div
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? "none" : "transform 0.24s cubic-bezier(0.18, 0.89, 0.32, 1.15)",
          willChange: isSwiping ? "transform" : "auto",
        }}
        className="w-full flex flex-col"
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableMessage;
