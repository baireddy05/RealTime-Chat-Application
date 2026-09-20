import { memo, useId } from "react";

// Innovative delivery ticks: hand-drawn SVG checks instead of stock icons.
// - sent:      single check draws itself in
// - delivered: second check cascades in behind the first
// - read:      both checks ignite in a cyan→blue gradient with glow + pop
const SINGLE_PATH = "M4 7.8 L8 11.8 L16 3.8";
const DOUBLE_PATH_1 = "M1.5 7.8 L5.2 11.5 L11 4.2";
const DOUBLE_PATH_2 = "M7.5 7.8 L11.2 11.5 L17 4.2";

const MessageTicks = memo(({
  status = "sent",
  size = 14,
  title,
  className = "",
  animated = true,
}) => {
  const gradientId = `tick-grad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const isRead = status === "read";
  const isDouble = status === "delivered" || isRead;
  const stroke = isRead ? `url(#${gradientId})` : "currentColor";
  const drawClass = (second) => (animated ? (second ? "tick-draw tick-draw-2" : "tick-draw") : "");
  const pathProps = {
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...(animated ? { pathLength: 1 } : {}),
  };
  // Halo props: a text-colored under-stroke so the gradient core stays
  // legible on ANY bubble background (cyan ticks on a cyan bubble, etc.).
  // currentColor always contrasts its own background by theme construction.
  const haloProps = {
    stroke: "currentColor",
    strokeWidth: 4.5,
    opacity: 0.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...(animated ? { pathLength: 1 } : {}),
  };

  return (
    <span
      title={title}
      className={`inline-flex items-center shrink-0 ${title ? "cursor-help" : ""} ${isRead ? "tick-read tick-pop" : ""} ${className}`}
    >
      <svg
        width={size}
        height={Math.round(size * 0.7)}
        viewBox="0 0 20 14"
        fill="none"
        aria-hidden="true"
        className="tick-svg"
      >
        {isRead && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="20" y2="14" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        )}
        {isDouble ? (
          <>
            {isRead && (
              <>
                <path d={DOUBLE_PATH_1} className={drawClass(false)} {...haloProps} />
                <path d={DOUBLE_PATH_2} className={drawClass(true)} {...haloProps} />
              </>
            )}
            <path d={DOUBLE_PATH_1} stroke={stroke} className={drawClass(false)} {...pathProps} />
            <path d={DOUBLE_PATH_2} stroke={stroke} className={drawClass(true)} {...pathProps} />
          </>
        ) : (
          <path d={SINGLE_PATH} stroke={stroke} className={drawClass(false)} {...pathProps} />
        )}
      </svg>
    </span>
  );
});

export default MessageTicks;
