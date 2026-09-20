import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("emoji-picker-react")) return "vendor-emoji";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("react-virtuoso")) return "vendor-virtuoso";
            if (id.includes("react-markdown") || id.includes("remark-") || id.includes("unified") || id.includes("micromark") || id.includes("mdast")) return "vendor-markdown";
            if (id.includes("socket.io-client")) return "vendor-socket";
            if (id.includes("@giphy")) return "vendor-giphy";
            if (id.includes("wavesurfer")) return "vendor-audio";
            if (id.includes("@twemoji")) return "vendor-twemoji";
            if (id.includes("axios")) return "vendor-axios";
            if (id.includes("zustand")) return "vendor-zustand";
            if (
              id.includes("react-router-dom") ||
              id.includes("react-dom") ||
              id.includes("/react/") ||
              id.includes("\\react\\")
            ) {
              return "vendor-react";
            }
          }
        },
      },
    },
  },
})
