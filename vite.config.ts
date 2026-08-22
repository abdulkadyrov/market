import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const base = repository ? `/${repository}/` : "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          name: "WayYaam Касса",
          short_name: "Касса",
          description: "Офлайн-касса продуктового магазина WayYaam",
          theme_color: "#5b3fff",
          background_color: "#f6f7fb",
          display: "standalone",
          orientation: "any",
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}favicon.svg`,
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable"
            }
          ]
        }
      })
    ]
  };
});
