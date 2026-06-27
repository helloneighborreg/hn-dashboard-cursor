import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { loadEnvFiles } from './scripts/load-env.mjs';

loadEnvFiles();

// Content-Security-Policy tuned for this app: Plaid Link (cdn.plaid.com script + iframe)
// and Hospitable/Airbnb images. Inter is self-hosted via next/font.
//
// script-src keeps 'unsafe-inline' deliberately. A nonce/'strict-dynamic' CSP was
// evaluated and rejected: Next.js 14 (Pages Router) on this stack does not propagate a
// per-request nonce to its <script> tags (verified via middleware and getServerSideProps),
// and statically prerendered pages (e.g. /404) can never receive a per-request nonce, so
// 'strict-dynamic' would block all scripts and white-screen the app. style-src also needs
// 'unsafe-inline' because React inline style attributes cannot carry a nonce.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://cdn.plaid.com",
  "worker-src 'self'",
  "connect-src 'self' https://*.plaid.com",
  "frame-src https://cdn.plaid.com https://*.plaid.com",
].join('; ');

const isDev = process.env.NODE_ENV !== 'production';

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // HSTS on localhost breaks local dev — browsers upgrade to https:// which has no listener.
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'a0.muscache.com' },
      { protocol: 'https', hostname: '**.muscache.com' },
      { protocol: 'https', hostname: 'assets.hospitable.com' },
      { protocol: 'https', hostname: 'mediaim.expedia.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
