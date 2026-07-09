import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  integrations: [react()],
  output: "static",
  site: "https://nikitapichugin.ru",
  vite: {
    resolve: {
      alias: {
        "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
        "@data": fileURLToPath(new URL("./src/data", import.meta.url)),
        "@layouts": fileURLToPath(new URL("./src/layouts", import.meta.url)),
        "@lib": fileURLToPath(new URL("./src/lib", import.meta.url))
      }
    },
    build: {
      target: "es2022"
    }
  }
});
