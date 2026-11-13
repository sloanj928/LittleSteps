import type { NextConfig } from 'next';

// Cache Components is off: every page is private, per-user and read behind a
// session, so there is nothing to prerender and the Suspense boundaries it
// demands around each cookie read would buy nothing.
//
// The Content-Security-Policy is set per request in src/proxy.ts (it carries a
// nonce); the headers here are the static ones.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@node-rs/argon2', '@libsql/client'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // API responses carry private data; never let a shared cache keep one.
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default nextConfig;
