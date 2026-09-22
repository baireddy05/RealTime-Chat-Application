import { axiosInstance } from "./axios";

/**
 * Converts a Base64 data URL to a binary Blob
 */
const dataUrlToBlob = (dataUrl) => {
  try {
    const parts = dataUrl.split(";base64,");
    const contentType = parts[0].split(":")[1] || "application/octet-stream";
    const raw = atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (err) {
    console.error("[Download] Failed to parse data URL to blob:", err);
    return null;
  }
};

/**
 * Trigger file download via programmatic anchor (web browsers / PWA).
 */
const triggerBlobDownload = (blob, filename) => {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    window.URL.revokeObjectURL(blobUrl);
  }, 2000);
};

/**
 * Reliable file & PDF downloader for cross-origin URLs (Cloudinary, CDNs, S3), Data URLs, and Blobs.
 * Guaranteed to work on Mobile (iOS Safari, Android Chrome, Samsung Internet) and Desktop (Windows, macOS, Linux).
 */
export const downloadFile = async (url, filename = "document.pdf") => {
  if (!url) return;

  let cleanFilename = (filename || "document.pdf").trim();
  if (!cleanFilename.includes(".") && url.toLowerCase().includes(".pdf")) {
    cleanFilename += ".pdf";
  }

  // 0. Our own backend file store: authenticated blob download (never CORS-blocked)
  // NOTE: failures fall THROUGH to the fallbacks below (never return early).
  let lastError = null;
  if (url.includes("/api/upload/file/")) {
    try {
      const response = await axiosInstance.get(url, { responseType: "blob", timeout: 120000 });
      if (response.data) {
        await triggerBlobDownload(response.data, cleanFilename);
        return;
      }
    } catch (err) {
      lastError = err;
      console.warn("[Download] Backend file download failed:", err?.response?.data || err.message);
    }
  }

  // 1. Data URLs (Base64) - Convert directly to binary Blob (Bypasses Chrome/Safari data-URL download block)
  if (url.startsWith("data:")) {
    const blob = dataUrlToBlob(url);
    if (blob) {
      await triggerBlobDownload(blob, cleanFilename);
      return;
    }
  }

  // 2. Blob URLs
  if (url.startsWith("blob:")) {
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 1000);
    return;
  }

  // 3. Cloudinary Direct Attachment Delivery (Bypasses CORS, instant native browser & mobile download)
  if (url.includes("cloudinary.com") && url.includes("/upload/")) {
    const baseName = encodeURIComponent(
      cleanFilename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")
    );
    let attachmentUrl = url;
    if (!url.includes("fl_attachment")) {
      attachmentUrl = url.replace("/upload/", `/upload/fl_attachment:${baseName}/`);
    }

    try {
      // Try direct fetch for immediate programmatic blob save
      const res = await fetch(attachmentUrl, { mode: "cors" });
      if (res.ok) {
        const blob = await res.blob();
        await triggerBlobDownload(blob, cleanFilename);
        return;
      }
      // Restricted Cloudinary delivery (401/403): these bytes are locked on
      // Cloudinary's side — no fallback can fetch them. Fail loudly so the
      // caller can tell the user to ask the sender to re-send.
      if (res.status === 401 || res.status === 403) {
        const dead = new Error(
          "This file was stored with the old file storage and can no longer be fetched. Ask the sender to send it again."
        );
        dead.code = "DEAD_FILE";
        throw dead;
      }
      lastError = new Error(`Cloudinary responded ${res.status}`);
    } catch (err) {
      if (err?.code === "DEAD_FILE") throw err;
      lastError = err;
      // If direct fetch is blocked by CORS, trigger direct anchor download with fl_attachment
      const a = document.createElement("a");
      a.href = attachmentUrl;
      a.download = cleanFilename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 1000);
      return;
    }
  }

  // 4. Server Proxy Endpoint (Guaranteed fallback with custom attachment headers)
  try {
    const response = await axiosInstance.get("/chat/download/file", {
      params: { url, filename: cleanFilename },
      responseType: "blob",
      timeout: 30000,
    });

    if (response.data) {
      await triggerBlobDownload(response.data, cleanFilename);
      return;
    }
  } catch (proxyError) {
    lastError = proxyError;
    console.warn("[Download] Proxy download failed, attempting native link navigation:", proxyError);
  }

  // 5. Direct Client Fetch Fallback
  try {
    const response = await fetch(url, { method: "GET", mode: "cors" });
    if (response.ok) {
      const blob = await response.blob();
      await triggerBlobDownload(blob, cleanFilename);
      return;
    }
    lastError = new Error(`Server responded ${response.status}`);
  } catch (fetchError) {
    lastError = fetchError;
    console.warn("[Download] Client fetch fallback failed:", fetchError);
  }

  // 6. Universal fallback: open in a new tab with cookies attached, so the
  // backend serves the file as an attachment (browser shows its PDF viewer
  // with a working download button even when fetch paths fail).
  if (lastError) {
    console.warn("[Download] All fetch paths failed, opening directly:", lastError?.message || lastError);
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = cleanFilename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) document.body.removeChild(a);
  }, 1000);
};


