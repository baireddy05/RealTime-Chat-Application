// Location utilities: Web Mercator tile calculation, reverse geocoding cache, and map URL helpers.

const geocodeCache = new Map();

/**
 * Convert lat/lng to Web Mercator tile coordinates at a given zoom level.
 */
export function getTileCoordinates(lat, lng, zoom = 15) {
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const clampedLatRad = Math.max(-Math.PI * 0.499, Math.min(Math.PI * 0.499, latRad));
  const y = ((1 - Math.log(Math.tan(clampedLatRad) + 1 / Math.cos(clampedLatRad)) / Math.PI) / 2) * n;

  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const fracX = x - tileX; // fractional offset inside tile (0..1)
  const fracY = y - tileY;

  return { tileX, tileY, fracX, fracY, zoom };
}

/**
 * Returns raster map tile URLs with multi-mirror support for load resilience.
 */
export function getTileUrl(tileX, tileY, zoom, isDark = true, mirrorIndex = 0) {
  const mirrors = ["a", "b", "c", "d"];
  const sub = mirrors[Math.abs(mirrorIndex) % mirrors.length];

  if (isDark) {
    // CartoDB Dark Matter — crisp, dark theme tailored
    return `https://${sub}.basemaps.cartocdn.com/rastertiles/dark_all/${zoom}/${tileX}/${tileY}.png`;
  }
  // CartoDB Voyager — vibrant, modern light theme
  return `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tileX}/${tileY}.png`;
}

/**
 * OpenStreetMap tile fallback
 */
export function getOsmFallbackTileUrl(tileX, tileY, zoom) {
  return `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
}

/**
 * Format a single coordinate with cardinal direction
 */
export function formatCoordinate(val, type) {
  const num = Number(val);
  if (!Number.isFinite(num)) return "";
  const abs = Math.abs(num).toFixed(4);
  if (type === "lat") {
    return `${abs}° ${num >= 0 ? "N" : "S"}`;
  }
  return `${abs}° ${num >= 0 ? "E" : "W"}`;
}

/**
 * Format lat/lng pair into readable text e.g. "17.4435° N, 78.3772° E"
 */
export function formatCoordinatesPair(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return "Unknown location";
  return `${formatCoordinate(numLat, "lat")}, ${formatCoordinate(numLng, "lng")}`;
}

/**
 * Reverse geocode latitude and longitude using OpenStreetMap Nominatim with memory & session cache.
 */
export async function reverseGeocode(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
    return {
      name: "Location",
      subtitle: "Coordinates unavailable",
      fullAddress: "",
    };
  }

  // Key rounded to ~11m precision
  const cacheKey = `pulse_geo_${numLat.toFixed(4)}_${numLng.toFixed(4)}`;

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      geocodeCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch {}

  const fallback = {
    name: "Shared Location",
    subtitle: formatCoordinatesPair(numLat, numLng),
    fullAddress: `${numLat.toFixed(5)}, ${numLng.toFixed(5)}`,
    city: "",
    state: "",
    country: "",
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${numLat}&lon=${numLng}&zoom=18&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );
    clearTimeout(timer);

    if (!res.ok) {
      geocodeCache.set(cacheKey, fallback);
      return fallback;
    }

    const data = await res.json();
    const addr = data.address || {};

    // Primary place name: landmark, building, shop, amenity, or road/suburb
    const primaryName =
      addr.amenity ||
      addr.building ||
      addr.shop ||
      addr.tourism ||
      addr.leisure ||
      addr.office ||
      addr.historic ||
      addr.road ||
      addr.suburb ||
      addr.neighbourhood ||
      data.name ||
      "Shared Location";

    // Secondary line: suburb/locality, city/town, state
    const localityParts = [
      addr.suburb || addr.neighbourhood,
      addr.city || addr.town || addr.village || addr.county,
      addr.state,
    ]
      .filter(Boolean)
      .filter((item, idx, arr) => arr.indexOf(item) === idx && item !== primaryName);

    const subtitle = localityParts.length > 0
      ? localityParts.join(", ")
      : addr.country || formatCoordinatesPair(numLat, numLng);

    const result = {
      name: primaryName,
      subtitle: subtitle,
      fullAddress: data.display_name || `${primaryName}, ${subtitle}`,
      city: addr.city || addr.town || addr.village || addr.county || "",
      state: addr.state || "",
      country: addr.country || "",
    };

    geocodeCache.set(cacheKey, result);
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(result));
    } catch {}

    return result;
  } catch {
    geocodeCache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Navigation & external map link generators
 */
export function getGoogleMapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${Number(lat)},${Number(lng)}`;
}

export function getGoogleDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}`;
}

export function getAppleMapsUrl(lat, lng, label = "Shared Location") {
  return `https://maps.apple.com/?ll=${Number(lat)},${Number(lng)}&q=${encodeURIComponent(label)}`;
}

export function getGoogleEmbedUrl(lat, lng, zoom = 15) {
  return `https://maps.google.com/maps?q=${Number(lat)},${Number(lng)}&hl=en&z=${zoom}&output=embed`;
}

export function getOpenStreetMapEmbedUrl(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  const dLat = 0.005;
  const dLng = 0.008;
  const bbox = `${numLng - dLng}%2C${numLat - dLat}%2C${numLng + dLng}%2C${numLat + dLat}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${numLat}%2C${numLng}`;
}
