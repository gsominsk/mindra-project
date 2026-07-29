import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',  // required for self-hosted deploy (Docker / Node.js server.js)

  // Security headers applied to every route. Cloudflare terminates TLS, but
  // these headers still reach the browser and harden the app against common
  // attacks (clickjacking, MIME sniffing, mixed content, referrer leaks).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          // HSTS — tell browsers to always use HTTPS for this site.
          // Safe to send even though Cloudflare terminates TLS: the header
          // passes through to the user's browser which enforces HTTPS to the edge.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
