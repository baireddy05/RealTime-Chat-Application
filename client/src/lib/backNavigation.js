import { useEffect, useRef } from "react";

/**
 * Mobile & Browser Back Navigation Manager for Pulse Messenger
 * 
 * Intercepts phone hardware back buttons, swipe-to-go-back gestures,
 * and browser back navigation to close open modals, drawers, and active chat views
 * in LIFO (stack) order, giving a true native-app mobile experience.
 */
class BackNavigationManager {
  constructor() {
    this.stack = []; // array of { id, onBack }
    this.programmaticBackCount = 0;
    this.lastExitPromptTime = 0;
    this.exitToastTimeout = null;
    this.isListening = false;
    this.hasRootGuard = false;

    if (typeof window !== "undefined") {
      this.init();
    }
  }

  init() {
    if (this.isListening) return;
    this.isListening = true;
    window.addEventListener("popstate", this.handlePopState);
  }

  ensureRootGuard() {
    if (!this.isMobileDevice() || this.hasRootGuard) return;
    try {
      this.hasRootGuard = true;
      window.history.pushState({ pulseRoot: true }, "");
    } catch {
      // ignore
    }
  }

  isMobileDevice() {
    if (typeof window === "undefined") return false;
    return (
      window.innerWidth < 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }

  handlePopState = () => {
    // If popstate was triggered by our own history.back() after manual UI close, ignore it
    if (this.programmaticBackCount > 0) {
      this.programmaticBackCount--;
      return;
    }

    if (this.stack.length > 0) {
      // Pop the topmost handler from our stack (the browser already popped the history entry)
      const top = this.stack.pop();
      try {
        if (typeof top.onBack === "function") {
          top.onBack();
        }
      } catch (err) {
        console.error("[PulseBack] Error executing back handler:", err);
      }
    } else {
      // Stack is empty - user is at the root screen (chat list)
      if (this.isMobileDevice()) {
        const now = Date.now();
        if (now - this.lastExitPromptTime < 2000) {
          // Double back press within 2 seconds: allow user to exit
          this.hasRootGuard = false;
          window.history.back();
          return;
        }

        // First back press at root: re-push root state and show toast
        this.lastExitPromptTime = now;
        try {
          window.history.pushState({ pulseRoot: true }, "");
        } catch {
          // ignore
        }
        this.showExitToast();
      }
    }
  };

  push(id, onBack) {
    if (typeof window === "undefined") return;

    // Check if item already exists in stack
    const existingIndex = this.stack.findIndex((item) => item.id === id);
    if (existingIndex !== -1) {
      // Update callback for existing item
      this.stack[existingIndex].onBack = onBack;
      return;
    }

    // Push new history state and register handler
    try {
      window.history.pushState({ pulseBackId: id, depth: this.stack.length }, "");
    } catch (err) {
      console.error("[PulseBack] pushState error:", err);
    }
    this.stack.push({ id, onBack });
  }

  remove(id) {
    if (typeof window === "undefined") return;

    const index = this.stack.findIndex((item) => item.id === id);
    if (index === -1) return;

    // If it's at the top of the stack, revert the history state we pushed
    if (index === this.stack.length - 1) {
      this.stack.pop();
      this.programmaticBackCount++;
      try {
        window.history.back();
      } catch (err) {
        this.programmaticBackCount = Math.max(0, this.programmaticBackCount - 1);
        console.error("[PulseBack] history.back error:", err);
      }
    } else {
      // If closed out-of-order, remove from stack without popping history
      this.stack.splice(index, 1);
    }
  }

  showExitToast() {
    if (typeof document === "undefined") return;

    let toast = document.getElementById("pulse-exit-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "pulse-exit-toast";
      toast.className = "pulse-exit-toast";
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
      <span>Press back again to exit</span>
    `;
    toast.classList.add("visible");

    if (this.exitToastTimeout) clearTimeout(this.exitToastTimeout);
    this.exitToastTimeout = setTimeout(() => {
      toast.classList.remove("visible");
    }, 2000);
  }
}

export const backManager = new BackNavigationManager();

/**
 * React Hook to attach mobile back button behavior to any modal, drawer, or view.
 * 
 * @param {boolean} enabled - Whether the modal/view is currently open/active
 * @param {Function} onBack - Callback executed when phone back or swipe back is triggered
 * @param {string} id - Unique identifier for this handler
 */
export function useBackHandler(enabled, onBack, id) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const idRef = useRef(id || `back_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    if (!enabled) return;

    const currentId = idRef.current;
    backManager.push(currentId, () => {
      if (onBackRef.current) {
        onBackRef.current();
      }
    });

    return () => {
      backManager.remove(currentId);
    };
  }, [enabled]);
}
