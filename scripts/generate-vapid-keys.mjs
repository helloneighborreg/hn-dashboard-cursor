/**
 * Generate VAPID keys for web push notifications.
 * Run: node scripts/generate-vapid-keys.mjs
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { generateVAPIDKeys } = require('web-push');

const keys = generateVAPIDKeys();
console.log('Add these to your environment (Cloudflare dashboard + env.local):\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@helloneighbor.com');
