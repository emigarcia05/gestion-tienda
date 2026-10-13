import type { NextConfig } from "next";
import { LEGACY_ROUTE_REDIRECTS } from "./src/lib/appRoutes";

const nextConfig: NextConfig = {
  /** PKCS#7 (WSAA) y XML SOAP no se bundlean con el cliente. */
  serverExternalPackages: ["node-forge"],
  /** Worker de pdfjs-dist en el bundle serverless (Vercel). Ver `@/lib/pdfjsServerLoad`. */
  outputFileTracingIncludes: {
    "/api/parse-lista-precios-pdf": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    ],
  },
  /** Evita fallos de TLS al descargar Geist en `next/font` durante `next build` (p. ej. entornos corporativos). */
  experimental: {
    turbopackUseSystemTlsCerts: true,
    /** Planillas de estadísticas / imports con muchas filas vía Server Actions. */
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async redirects() {
    return LEGACY_ROUTE_REDIRECTS.map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
};

export default nextConfig;
