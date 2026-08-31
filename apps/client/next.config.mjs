import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const isolatedDistDir = process.env.NIRO_NEXT_DIST_DIR?.trim();
if (isolatedDistDir && !/^\.next-p10-[a-f0-9]{30}$/.test(isolatedDistDir)) {
  throw new Error('NIRO_NEXT_DIST_DIR must be a nonce-isolated P10 build directory name.');
}

const connectSources = ["'self'"];
const scriptSources = ["'self'", "'unsafe-inline'"];
// React and the Next.js development runtime use eval() for source maps and
// debugging helpers. Permit it only for `next dev`; production stays strict.
if (process.env.NODE_ENV === 'development') {
  scriptSources.push("'unsafe-eval'");
}
const configuredApiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:4000/api/v1' : undefined);
if (configuredApiBase) {
  try {
    const apiUrl = new URL(configuredApiBase);
    if (apiUrl.protocol === 'https:' || apiUrl.protocol === 'http:') {
      connectSources.push(apiUrl.origin);
    }
  } catch {
    // Production environment validation reports malformed public API URLs with
    // their exact variable name. Keep this build-time policy fail-closed.
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src ${scriptSources.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  `connect-src ${connectSources.join(' ')}`,
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  distDir: isolatedDistDir || '.next',
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  // Non-secret artifact identity, captured at build time so runtime config
  // cannot make a stale client image claim the current server release.
  env: {
    NIRO_CLIENT_BUILD_RELEASE_ID: process.env.NEXT_PUBLIC_RELEASE_ID?.trim() || 'local-unversioned',
  },
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
      {
        source: '/results/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ];
  },
};

export default nextConfig;
