import { useState, useRef } from "react";
import { Reply } from "lucide-react";

/**
 * WhatsApp / Telegram-Style Swipe-Right-to-Reply Component
 * 
 * Supports mobile touch gestures and desktop pointer dragging.
 * Features:
 * 1. Direction lock (doesn't interfere with vertical chat scrolling)
 * 2. Visual reply indicator with dynamic scaling & accent illumination
 * 3. Haptic tick upon crossing trigger threshold on mobile devices
 * 4. Automatic input focus upon release
 * 5. Smooth elastic snap-back animation
 */
const SwipeableMessage = ({ children, onReply, disabled = false }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isThresholdMet, setIsThresholdMet] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const isHorizontalRef = useRef(null);
  const hasVibratedRef = useRef(false);
  const isDraggingRef = useRef(false);

  const THRESHOLD = 46;
  const MAX_SWIPE = 78;

  // Touch Handlers
  const handleTouchStart = (e) => {
    if (disabled || e.touches.length > 1) return;
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    currentOffsetRef.current = 0;
    isHorizontalRef.current = null;
    hasVibratedRef.current = false;
    setIsSwiping(false);
  };

  const handleTouchMove = (e) => {
    if (disabled || e.touches.length > 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    // Lock direction on initial drag
    if (isHorizontalRef.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        if (deltaX > 6 && deltaX > Math.abs(deltaY) * 1.15) {
          isHorizontalRef.current = true;
        } else {
          isHorizontalRef.current = false;
        }
      }
    }

    if (isHorizontalRef.current) {
      // Prevent browser default vertical scroll while intentionally swiping to reply
      if (e.cancelable) {
        e.preventDefault();
      }

      setIsSwiping(true);
      const clampedX = Math.max(0, deltaX);
      const damped = clampedX > THRESHOLD 
        ? THRESHOLD + (clampedX - THRESHOLD) * 0.32 
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
            window.navigator.vibrate(10);
          } catch {}
        }
      } else if (!met && hasVibratedRef.current) {
        hasVibratedRef.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    if (isHorizontalRef.current && currentOffsetRef.current >= THRESHOLD) {
      onReply?.();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pulse:focus-input"));
      }
    }

    // Reset with smooth snap-back
    setIsSwiping(false);
    setSwipeOffset(0);
    setIsThresholdMet(false);
    isHorizontalRef.current = null;
    hasVibratedRef.current = false;
    currentOffsetRef.current = 0;
  };

  // Optional Pointer (Mouse drag) Handlers for Desktop
  const handlePointerDown = (e) => {
    if (disabled || e.pointerType === "touch" || e.button !== 0) return;
    // Don't intercept clicks on interactive buttons, links, or menus
    if (e.target.closest("button, a, input, textarea, img, [role='button']")) return;

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentOffsetRef.current = 0;
    isHorizontalRef.current = null;
    isDraggingRef.current = true;
    hasVibratedRef.current = false;
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || disabled) return;
    const deltaX = e.clientX - startXRef.current;
    const deltaY = e.clientY - startYRef.current;

    if (isHorizontalRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        if (deltaX > 8 && deltaX > Math.abs(deltaY) * 1.2) {
          isHorizontalRef.current = true;
        } else {
          isHorizontalRef.current = false;
          isDraggingRef.current = false;
        }
      }
    }

    if (isHorizontalRef.current) {
      setIsSwiping(true);
      const clampedX = Math.max(0, deltaX);
      const damped = clampedX > THRESHOLD 
        ? THRESHOLD + (clampedX - THRESHOLD) * 0.32 
        : clampedX;
      const finalOffset = Math.min(damped, MAX_SWIPE);

      currentOffsetRef.current = finalOffset;
      setSwipeOffset(finalOffset);

      const met = finalOffset >= THRESHOLD;
      setIsThresholdMet(met);
    }
  };

  const handlePointerUp = () => {
    if (isDraggingRef.current && isHorizontalRef.current && currentOffsetRef.current >= THRESHOLD) {
      onReply?.();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pulse:focus-input"));
      }
    }

    isDraggingRef.current = false;
    setIsSwiping(false);
    setSwipeOffset(0);
    setIsThresholdMet(false);
    isHorizontalRef.current = null;
    currentOffsetRef.current = 0;
  };

  return (
    <div 
      className="relative w-full overflow-visible touch-pan-y select-none group/swipe"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* WhatsApp / Telegram Reply Icon Badge */}
      <div 
        className="absolute left-1 sm:left-2.5 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center transition-all"
        style={{
          opacity: Math.min(1, Math.max(0, (swipeOffset - 8) / 32)),
          transform: `translateY(-50%) translateX(${Math.min(swipeOffset * 0.55, 24)}px) scale(${
            isThresholdMet ? 1.15 : Math.max(0.6, swipeOffset / THRESHOLD)
          })`,
        }}
      >
        <div 
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
            isThresholdMet
              ? "bg-accent-primary text-white shadow-lg shadow-accent-primary/40 ring-2 ring-accent-primary/30 scale-105"
              : "bg-[var(--glass-surface)] border border-[var(--glass-border)] text-theme-muted shadow-sm"
          }`}
        >
          <Reply 
            size={15} 
            className={`transition-transform duration-150 ${
              isThresholdMet ? "scale-110" : "scale-90 opacity-70"
            }`} 
          />
        </div>
      </div>

      {/* Swipeable Message Row Content */}
      <div
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? "none" : "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)",
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
