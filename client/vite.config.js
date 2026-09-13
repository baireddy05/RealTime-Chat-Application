import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("emoji-picker-react")) return "vendor-emoji";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("react-virtuoso")) return "vendor-virtuoso";
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
