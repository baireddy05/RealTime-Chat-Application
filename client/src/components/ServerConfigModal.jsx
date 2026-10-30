import { useState, useEffect } from "react";
import { Server, Globe, Check, RotateCcw, X, Wifi, Cloud } from "lucide-react";
import { getApiBaseUrl, setCustomServerUrl, PROD_CLOUD_API } from "../lib/apiConfig";

const ServerConfigModal = ({ isOpen, onClose }) => {
  const [currentUrl, setCurrentUrl] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const active = getApiBaseUrl();
      setCurrentUrl(active);
      const custom = localStorage.getItem("pulse_custom_server_url") || "";
      setInputUrl(custom || active);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e?.preventDefault();
    if (!inputUrl.trim()) {
      setCustomServerUrl("");
    } else {
      setCustomServerUrl(inputUrl.trim());
    }
    setCurrentUrl(getApiBaseUrl());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleReset = () => {
    setCustomServerUrl("");
    const active = getApiBaseUrl();
    setCurrentUrl(active);
    setInputUrl(active);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const applyPreset = (preset) => {
    setInputUrl(preset);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-[#121118] border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <Server size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Server Connection</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Configure backend API address</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
              Active Server Endpoint
            </label>
            <div className="px-3.5 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all select-text">
              {currentUrl}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-900 dark:text-white mb-1.5">
              Change Server URL
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://192.168.1.38:5000/api"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono text-xs"
              />
            </div>
            <p className="text-[10.5px] text-zinc-400 mt-1">
              Tip: For physical phones over Wi-Fi, use your laptop's Wi-Fi IP (e.g. <code>http://192.168.1.38:5000/api</code>).
            </p>
          </div>

          {/* Presets */}
          <div>
            <span className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
              Quick Presets
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => applyPreset(PROD_CLOUD_API)}
                className="px-2.5 py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-left text-[11px] text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5"
              >
                <Cloud size={13} className="text-cyan-400 shrink-0" />
                <span className="truncate">Live Cloud (Render)</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset("http://192.168.1.38:5000/api")}
                className="px-2.5 py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-left text-[11px] text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5"
              >
                <Wifi size={13} className="text-emerald-500 shrink-0" />
                <span className="truncate">Wi-Fi (192.168.1.38)</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset("http://10.0.2.2:5000/api")}
                className="px-2.5 py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-left text-[11px] text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5"
              >
                <Server size={13} className="text-indigo-400 shrink-0" />
                <span className="truncate">Emulator (10.0.2.2)</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-left text-[11px] text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={13} className="text-amber-500 shrink-0" />
                <span className="truncate">Reset Default</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold"
            >
              Reset to Default
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                {savedSuccess ? (
                  <>
                    <Check size={14} className="text-emerald-500" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save & Connect</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServerConfigModal;

