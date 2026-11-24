import { fileURLToPath, URL } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The build lands in ../internal/server/web, which the Go binary embeds.
// `npm run dev` proxies the API to a running `kttn serve`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "../internal/server/web", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:5886" } },
})
