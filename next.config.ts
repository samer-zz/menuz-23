import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const isSandboxDevPreview =
  !isProd && process.env.E2B_SANDBOX === "true";

const cspDirectives = [
  "default-src 'self'",
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  isSandboxDevPreview
    ? "frame-ancestors 'self' https://arena.ai https://*.arena.ai https://*.e2b.app"
    : "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
];

const cspHeader = cspDirectives.join("; ");

const nextConfig: NextConfig = {
  ...(isSandboxDevPreview
    ? { allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"] }
    : {}),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const baseHeaders = [
      { key: "Content-Security-Policy", value: cspHeader },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
      ...(!isSandboxDevPreview
        ? [{ key: "X-Frame-Options", value: "DENY" }]
        : []),
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Cross-Origin-Opener-Policy",
        value: isSandboxDevPreview ? "same-origin-allow-popups" : "same-origin",
      },
      {
        key: "Cross-Origin-Resource-Policy",
        value: isSandboxDevPreview ? "cross-origin" : "same-site",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      },
    ];

    return [
      {
        source: "/(.*)",
        headers: baseHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
