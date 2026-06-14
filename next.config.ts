import type { NextConfig } from "next";

// Cabeceras de seguridad base aplicadas a todas las rutas. CSP estricta se deja como
// seguimiento: layout.tsx inyecta CSS de marca inline (dangerouslySetInnerHTML), que
// requeriría nonces. HSTS lo agrega Vercel automáticamente en prod.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
