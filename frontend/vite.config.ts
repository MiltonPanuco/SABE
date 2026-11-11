import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En desarrollo, /api y el panel de Django (/admin y sus estáticos) se reenvían al backend (puerto 8000).
const backend = process.env.SABE_BACKEND ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Con "^" la clave es una expresión regular: "/admin/" no debe atrapar la ruta "/administrador".
    proxy: { "/api": backend, "^/admin/": backend, "^/static/": backend },
  },
});
