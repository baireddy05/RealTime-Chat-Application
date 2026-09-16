/**
 * Reliable file downloader for cross-origin URLs (Cloudinary, CDNs, S3), Data URLs, and Blobs.
 * Converts remote files to Blobs to enforce the exact download filename and trigger native browser save.
 */
export const downloadFile = async (url, filename = "document") => {
  if (!url) return;

  // Fallback filename extension if missing
  const cleanFilename = filename || "download";

  try {
    // 1. Data URLs & Blob URLs can be downloaded directly
    if (url.startsWith("data:") || url.startsWith("blob:")) {
      const a = document.createElement("a");
      a.href = url;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 500);
      return;
    }

    // 2. Fetch as Blob to bypass browser cross-origin download attribute restrictions
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

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
  } catch (err) {
    console.warn("Blob download failed, using Cloudinary attachment fallback:", err);

    // 3. Fallback: For Cloudinary URLs, inject fl_attachment to force download headers
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
  }
};
