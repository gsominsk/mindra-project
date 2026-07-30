import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',  // required for self-hosted deploy (Docker / Node.js server.js)

  // Security headers applied to every route. Cloudflare terminates TLS, but
  // these headers still reach the browser and harden the app against common
  // attacks (clickjacking, MIME sniffing, mixed content, referrer leaks).
  async headers() {
    return [
      // Party-prompts needs microphone access for speech recognition (ru-RU).
      // Allow microphone=self on that route only; block on all others.
      {
        source: '/party-prompts(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // microphone=self allows same-origin access for SpeechRecognition.
          // camera stays blocked — no camera features in party-prompts.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=self, geolocation=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
      {
        source: '/((?!party-prompts).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
