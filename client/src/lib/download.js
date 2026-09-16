import { axiosInstance } from "./axios";

/**
 * Reliable file downloader for cross-origin URLs (Cloudinary, CDNs, S3), Data URLs, and Blobs.
 * Supports:
 * 1. Direct Blob / Data URL triggering
 * 2. Backend Proxy streaming with Content-Disposition headers (guaranteed bypass of browser CORS & mobile restriction)
 * 3. Native fetch Blob fallback
 * 4. Cloudinary fl_attachment fallback
 */
export const downloadFile = async (url, filename = "document") => {
  if (!url) return;

  const cleanFilename = (filename || "download").trim();

  // 1. Data URLs & Blob URLs
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 500);
      return;
    } catch (e) {
      console.warn("Direct data/blob URL trigger failed:", e);
    }
  }

  // 2. Primary Strategy: Server Download Proxy (Bypasses CORS, guarantees exact filename & attachment headers)
  try {
    const response = await axiosInstance.get("/chat/download/file", {
      params: { url, filename: cleanFilename },
      responseType: "blob",
      timeout: 30000,
    });

    if (response.data) {
      const blob = response.data;
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 1500);
      return;
    }
  } catch (proxyError) {
    console.warn("Proxy download failed, attempting direct fetch fallback:", proxyError);
  }

  // 3. Fallback: Direct Client-Side Fetch as Blob
  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
    });

    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 1500);
      return;
    }
  } catch (fetchError) {
    console.warn("Client fetch failed, attempting link navigation fallback:", fetchError);
  }

  // 4. Final Fallback: Direct Anchor Navigation / Cloudinary Attachment Header
  let downloadUrl = url;
  if (url.includes("cloudinary.com") && url.includes("/upload/")) {
    const baseName = encodeURIComponent(cleanFilename.replace(/\.[^/.]+$/, ""));
    downloadUrl = url.replace("/upload/", `/upload/fl_attachment:${baseName}/`);
  }

  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = cleanFilename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    if (document.body.contains(a)) document.body.removeChild(a);
  }, 1000);
};

