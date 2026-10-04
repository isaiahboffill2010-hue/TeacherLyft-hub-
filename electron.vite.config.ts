import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@": resolve("src") } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@": resolve("src") } },
  },
  renderer: {
    root: resolve("src/renderer"),
    resolve: { alias: { "@": resolve("src") } },
    plugins: [react()],
  },
});
