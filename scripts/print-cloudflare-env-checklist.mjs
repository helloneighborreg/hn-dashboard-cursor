#!/usr/bin/env node
/**
 * Show which env vars are set locally and what to restore in Cloudflare.
 *
 * Usage: node scripts/print-cloudflare-env-checklist.mjs
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';

function loadEnvLocal() {
	for (const file of ['env.local', '.env.local']) {
		const filePath = path.join(process.cwd(), file);
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
		return file;
	}
	return null;
}

const ENV_GROUPS = [
	{
		title: 'Required — login & sessions',
		keys: ['SESSION_SECRET', 'DASHBOARD_USERS'],
	},
	{
		title: 'Required — data & API',
		keys: ['HOSPITABLE_API_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
	},
	{
		title: 'Optional — Plaid',
		keys: ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV'],
	},
	{
		title: 'Optional — legacy Fillout (not used when in-app checklists cover all properties)',
		keys: [
			'FILLOUT_API_TOKEN',
			'FILLOUT_WEBHOOK_SECRET',
			'FILLOUT_CHECKLIST_BASE_URL',
			'FILLOUT_CHECKLIST_FORMS',
		],
	},
	{
		title: 'Legacy — remove if unset (prefer DASHBOARD_USERS)',
		keys: ['DASHBOARD_PASSWORD'],
	},
];

function isSet(key) {
	const value = process.env[key]?.trim();
	return Boolean(value);
}

const source = loadEnvLocal();

console.log('Cloudflare env restore checklist\n');
if (source) {
	console.log(`Reading values from ${source} (secrets are not printed).\n`);
} else {
	console.log('No env.local found — copy .env.local.example to env.local first.\n');
}

for (const group of ENV_GROUPS) {
	console.log(group.title);
	for (const key of group.keys) {
		const ok = isSet(key);
		console.log(`  ${ok ? '✓' : '✗'} ${key}`);
	}
	if (group.note) console.log(`  (${group.note})`);
	console.log('');
}

console.log('Where to restore in Cloudflare:');
console.log('  Workers & Pages → hn-dashboard-cursor → Settings → Variables and Secrets');
console.log('  Add each missing variable as Type: Secret (recommended for tokens/passwords).');
console.log('');
console.log('DASHBOARD_USERS value (paste as secret):');
console.log('  node scripts/print-dashboard-users.mjs');
console.log('');
console.log('After restoring vars, verify (no login needed):');
console.log('  https://YOUR-SITE/api/auth/status');
console.log('  Expect: "login_ready": true and usernames listed.');
console.log('');
console.log('IMPORTANT — future deploys must use --keep-vars or vars get wiped again:');
console.log('  npm run deploy:cloudflare');
