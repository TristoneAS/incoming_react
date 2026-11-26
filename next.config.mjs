/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["exceljs"],
  // Permite compilar (`next build`) en otra carpeta para no invalidar la caché
  // del servidor de desarrollo si ambos corren a la vez.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
