import { useState, useEffect, useMemo, memo } from "react";
import { MapPin, Navigation } from "lucide-react";
import { getTileCoordinates, getTileUrl, getOsmFallbackTileUrl } from "../utils/location";

const MapTilePreview = memo(({ lat, lng, zoom = 15, isLive = false, className = "" }) => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return true;
  });

  // Watch for theme changes on <html>
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const numLat = Number(lat);
  const numLng = Number(lng);
  const valid = Number.isFinite(numLat) && Number.isFinite(numLng);

  const { tileX, tileY, fracX, fracY } = useMemo(() => {
    if (!valid) return { tileX: 0, tileY: 0, fracX: 0, fracY: 0 };
    return getTileCoordinates(numLat, numLng, zoom);
  }, [numLat, numLng, zoom, valid]);

  // Construct a 3x3 grid around the center tile
  // Container will center the point (fracX * 256, fracY * 256) inside the center tile.
  const tiles = useMemo(() => {
    if (!valid) return [];
    const list = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = tileX + dx;
        const y = tileY + dy;
        list.push({
          key: `${x}_${y}_${zoom}_${isDark ? "d" : "l"}`,
          x,
          y,
          dx,
          dy,
          url: getTileUrl(x, y, zoom, isDark, dx + dy),
          fallbackUrl: getOsmFallbackTileUrl(x, y, zoom),
        });
      }
    }
    return list;
  }, [tileX, tileY, zoom, isDark, valid]);

  if (!valid) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-zinc-900/60 text-zinc-400 text-xs ${className}`}>
        <MapPin size={24} className="opacity-40 mb-1" />
        <span>Location unavailable</span>
      </div>
    );
  }

  // Pixel offset of center point inside center tile:
  const px = fracX * 256;
  const py = fracY * 256;

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${isDark ? "bg-[#161a22]" : "bg-[#f1efe8]"} ${className}`}>
      {/* Background stylized grid pattern for instantaneous display & fallback */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: isDark
            ? "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)"
            : "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* 3x3 Tile Grid anchored to container center */}
      <div
        className="absolute w-0 h-0 pointer-events-none"
        style={{
          left: "50%",
          top: "50%",
        }}
      >
        <div
          className="relative"
          style={{
            transform: `translate(${-px}px, ${-py}px)`,
          }}
        >
          {tiles.map((t) => (
            <img
              key={t.key}
              src={t.url}
              alt=""
              loading="lazy"
              decoding="async"
              onError={(e) => {
                // If Carto fails, fallback to OSM tile
                if (e.currentTarget.src !== t.fallbackUrl) {
                  e.currentTarget.src = t.fallbackUrl;
                }
              }}
              className="absolute w-[256px] h-[256px] max-w-none transition-opacity duration-300"
              style={{
                left: `${t.dx * 256}px`,
                top: `${t.dy * 256}px`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Vignette & soft contrast overlay for readable text / icons */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/50 via-transparent to-black/30" />

      {/* Central Marker */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="relative flex items-center justify-center">
          {/* Live pulsing radar rings */}
          {isLive ? (
            <>
              <span className="absolute -inset-4 rounded-full bg-red-500/35 animate-ping duration-1000" />
              <span className="absolute -inset-2 rounded-full bg-red-500/40 animate-pulse" />
              <div className="relative w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-[0_4px_16px_rgba(239,68,68,0.6)] ring-2 ring-white">
                <Navigation size={16} className="fill-white" />
              </div>
            </>
          ) : (
            <>
              <div className="relative -mt-3.5 flex flex-col items-center">
                {/* 3D Pin Head */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-primary to-cyan-400 text-white flex items-center justify-center shadow-[0_4px_18px_rgba(0,0,0,0.5)] ring-2 ring-white/90">
                  <MapPin size={17} className="fill-white/30" />
                </div>
                {/* Pointer Arrow */}
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-accent-primary -mt-[1px]" />
                {/* Ground Shadow */}
                <div className="w-3.5 h-1.5 rounded-full bg-black/45 blur-[1.5px] mt-0.5" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Discrete map provider attribution */}
      <div className="absolute bottom-1 right-1.5 z-10 px-1 py-0.5 rounded bg-black/40 backdrop-blur-xs text-[8px] font-medium text-white/70 select-none">
        © OpenStreetMap • CARTO
      </div>
    </div>
  );
});

export default MapTilePreview;
