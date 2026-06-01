import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load env from env.local (visible file) or .env.local — no dotfile required */
function loadLocalEnv() {
  const candidates = ['env.local', '.env.local', '.env'];
  for (const file of candidates) {
    const filePath = path.join(__dirname, file);
    if (!existsSync(filePath)) continue;
    for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
    break;
  }
}

loadLocalEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'a0.muscache.com' },
      { protocol: 'https', hostname: 'assets.hospitable.com' },
    ],
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
