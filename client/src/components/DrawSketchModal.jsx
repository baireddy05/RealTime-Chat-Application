import { useRef, useState, useEffect, useCallback } from "react";
import { 
  X, 
  Send, 
  RotateCcw, 
  Trash2, 
  Download, 
  PenTool, 
  Highlighter, 
  Eraser, 
  Sparkles,
  Check
} from "lucide-react";
import { soundManager } from "../lib/sound";

const COLOR_PALETTE = [
  { name: "White", value: "#ffffff" },
  { name: "Neon Green", value: "#22c55e" },
  { name: "Vibrant Cyan", value: "#06b6d4" },
  { name: "Electric Blue", value: "#3b82f6" },
  { name: "Violet Purple", value: "#a855f7" },
  { name: "Hot Pink", value: "#ec4899" },
  { name: "Crimson Red", value: "#ef4444" },
  { name: "Amber Gold", value: "#f59e0b" },
];

const STROKE_SIZES = [
  { label: "Fine", size: 3 },
  { label: "Medium", size: 7 },
  { label: "Thick", size: 16 },
];

const DrawSketchModal = ({ isOpen, onClose, onSendSketch }) => {
  const canvasRef = useRef(null);
  const [color, setColor] = useState("#22c55e");
  const [strokeSize, setStrokeSize] = useState(3);
  const [tool, setTool] = useState("pen"); // "pen" | "highlighter" | "eraser"
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  const [isCanvasDirty, setIsCanvasDirty] = useState(false);

  // Initialize canvas with proper DPI scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Fill canvas with dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Save initial state for undo
    setHistory([canvas.toDataURL()]);
    setIsCanvasDirty(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Allow modal DOM transition to finish before computing layout rect
      const t = setTimeout(setupCanvas, 150);
      return () => clearTimeout(t);
    }
  }, [isOpen, setupCanvas]);

  const saveHistorySnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory((prev) => [...prev.slice(-15), canvas.toDataURL()]);
    setIsCanvasDirty(true);
  };

  const undo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const newHistory = history.slice(0, -1);
    const previousSnapshot = newHistory[newHistory.length - 1];

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    };
    img.src = previousSnapshot;
    setHistory(newHistory);
    if (newHistory.length <= 1) setIsCanvasDirty(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, rect.width, rect.height);
    saveHistorySnapshot();
    setIsCanvasDirty(false);
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(x, y);

    if (tool === "eraser") {
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = strokeSize * 2.5;
    } else if (tool === "highlighter") {
      ctx.strokeStyle = color + "66"; // 40% opacity
      ctx.lineWidth = strokeSize * 2.2;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeSize;
    }

    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCanvasCoords(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    saveHistorySnapshot();
  };

  const handleSend = () => {
    const canvas = canvasRef.current;
    if (!canvas || !isCanvasDirty) return;
    const dataUrl = canvas.toDataURL("image/png");
    soundManager.playSendSound();
    onSendSketch(dataUrl);
    onClose();
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `pulse-sketch-${Date.now()}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900/95 border border-[var(--glass-border)] rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-primary/20 text-accent-primary flex items-center justify-center">
              <PenTool size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Doodle & Sketch</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-primary/20 text-accent-primary uppercase tracking-wider">
                  Live Canvas
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">Draw a diagram, doodle, or handwritten note</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              title="Download Sketch"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="p-3.5 border-b border-[var(--glass-border)] bg-slate-800/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tool selector */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => setTool("pen")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                tool === "pen"
                  ? "bg-accent-primary text-white shadow-md font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <PenTool size={13} />
              <span>Pen</span>
            </button>
            <button
              type="button"
              onClick={() => setTool("highlighter")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                tool === "highlighter"
                  ? "bg-accent-primary text-white shadow-md font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Highlighter size={13} />
              <span>Highlight</span>
            </button>
            <button
              type="button"
              onClick={() => setTool("eraser")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                tool === "eraser"
                  ? "bg-accent-primary text-white shadow-md font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Eraser size={13} />
              <span>Eraser</span>
            </button>
          </div>

          {/* Stroke Size Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1.5 rounded-2xl border border-white/5">
            <span className="text-[10.5px] text-zinc-400 mr-1">Size:</span>
            {STROKE_SIZES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setStrokeSize(s.size)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  strokeSize === s.size
                    ? "bg-white/20 text-white font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Color Palette */}
          {tool !== "eraser" && (
            <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1.5 rounded-2xl border border-white/5">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`w-5 h-5 rounded-full transition-transform active:scale-95 flex items-center justify-center ${
                    color === c.value ? "scale-125 ring-2 ring-white shadow-glow" : "opacity-80 hover:opacity-100"
                  }`}
                  title={c.name}
                >
                  {color === c.value && (
                    <Check size={11} className={c.value === "#ffffff" ? "text-black" : "text-white"} strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* History Controls */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={undo}
              disabled={history.length <= 1}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
              title="Undo"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              onClick={clearCanvas}
              disabled={!isCanvasDirty}
              className="p-1.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
              title="Clear Canvas"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="relative w-full h-[360px] sm:h-[420px] bg-[#0f172a] overflow-hidden cursor-crosshair">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full block touch-none"
          />

          {!isCanvasDirty && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-zinc-600 select-none">
              <Sparkles size={28} className="mb-2 opacity-50 text-accent-primary" />
              <p className="text-xs font-medium">Draw, write, or sketch anything here</p>
              <p className="text-[11px] opacity-70">Use pen, highlighter, or colors above</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-[var(--glass-border)] bg-slate-800/40 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">
            {isCanvasDirty ? "Sketch ready to send" : "Canvas is blank"}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!isCanvasDirty}
              className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-semibold shadow-glow active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
            >
              <Send size={13} />
              <span>Send Sketch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawSketchModal;
