import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { loadEnvFiles } from './scripts/load-env.mjs';

loadEnvFiles();

// Content-Security-Policy tuned for this app: Plaid Link (cdn.plaid.com script + iframe),
// Google Fonts, and Hospitable/Airbnb images.
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
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' https://cdn.plaid.com",
  "connect-src 'self' https://*.plaid.com",
  "frame-src https://cdn.plaid.com https://*.plaid.com",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'a0.muscache.com' },
      { protocol: 'https', hostname: 'assets.hospitable.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
