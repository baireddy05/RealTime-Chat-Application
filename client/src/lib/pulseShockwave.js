/**
 * Caret and typing coordinate calculator for interactive liquid-glass pulse shockwaves.
 */
let measureCanvas = null;

export function getCaretCoordinates(target) {
  if (!target || typeof target.getBoundingClientRect !== "function") {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  const rect = target.getBoundingClientRect();

  // 1. Single-line <input>
  if (target.tagName === "INPUT") {
    try {
      const style = window.getComputedStyle(target);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const borderLeft = parseFloat(style.borderLeftWidth) || 0;

      if (!measureCanvas) {
        measureCanvas = document.createElement("canvas");
      }
      const ctx = measureCanvas.getContext("2d");
      const fontSize = style.fontSize || "14px";
      const fontFamily = style.fontFamily || "sans-serif";
      const fontWeight = style.fontWeight || "400";
      ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;

      const text = target.value || "";
      const caretPos = typeof target.selectionStart === "number" ? target.selectionStart : text.length;
      const textBefore = text.slice(0, caretPos);
      const textWidth = ctx.measureText(textBefore).width;

      const scrollLeft = target.scrollLeft || 0;
      const rawX = rect.left + borderLeft + paddingLeft + textWidth - scrollLeft;
      const clampedX = Math.min(rect.right - 10, Math.max(rect.left + paddingLeft, rawX));
      const clampedY = rect.top + rect.height / 2;

      return { x: clampedX, y: clampedY };
    } catch {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }

  // 2. Multi-line <textarea>
  if (target.tagName === "TEXTAREA") {
    try {
      const style = window.getComputedStyle(target);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const borderLeft = parseFloat(style.borderLeftWidth) || 0;
      const borderTop = parseFloat(style.borderTopWidth) || 0;

      const text = target.value || "";
      const caretPos = typeof target.selectionStart === "number" ? target.selectionStart : text.length;

      const mirror = document.createElement("div");
      mirror.style.position = "fixed";
      mirror.style.top = "-9999px";
      mirror.style.left = "-9999px";
      mirror.style.visibility = "hidden";
      mirror.style.whiteSpace = "pre-wrap";
      mirror.style.wordBreak = "break-word";
      mirror.style.width = `${target.clientWidth}px`;
      mirror.style.fontSize = style.fontSize || "14px";
      mirror.style.fontFamily = style.fontFamily || "sans-serif";
      mirror.style.fontWeight = style.fontWeight || "400";
      mirror.style.lineHeight = style.lineHeight || "normal";
      mirror.style.paddingLeft = style.paddingLeft;
      mirror.style.paddingRight = style.paddingRight;
      mirror.style.paddingTop = style.paddingTop;
      mirror.style.paddingBottom = style.paddingBottom;
      mirror.style.border = style.border;
      mirror.style.boxSizing = style.boxSizing;

      const beforeSpan = document.createElement("span");
      beforeSpan.textContent = text.slice(0, caretPos);
      const caretSpan = document.createElement("span");
      caretSpan.textContent = text.slice(caretPos, caretPos + 1) || "|";

      mirror.appendChild(beforeSpan);
      mirror.appendChild(caretSpan);
      document.body.appendChild(mirror);

      const offsetLeft = caretSpan.offsetLeft;
      const offsetTop = caretSpan.offsetTop;
      document.body.removeChild(mirror);

      const rawX = rect.left + borderLeft + offsetLeft - target.scrollLeft;
      const rawY = rect.top + borderTop + offsetTop - target.scrollTop + 10;

      const clampedX = Math.min(rect.right - 10, Math.max(rect.left + paddingLeft, rawX));
      const clampedY = Math.min(rect.bottom - 10, Math.max(rect.top + paddingTop, rawY));

      return { x: clampedX, y: clampedY };
    } catch {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }

  // 3. Contenteditable
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const rangeRect = range.getBoundingClientRect();
    if (rangeRect && rangeRect.left > 0 && rangeRect.top > 0) {
      return { x: rangeRect.left, y: rangeRect.top + rangeRect.height / 2 };
    }
  }

  // Fallback: center of target element
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Dispatch helper to trigger custom pulse at element or coords
 */
export function emitPulseShockwave(xOrElement, y) {
  if (typeof xOrElement === "number" && typeof y === "number") {
    window.dispatchEvent(new CustomEvent("pulse-shockwave", { detail: { x: xOrElement, y } }));
  } else if (xOrElement && typeof xOrElement.getBoundingClientRect === "function") {
    const rect = xOrElement.getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent("pulse-shockwave", {
        detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      })
    );
  }
}
