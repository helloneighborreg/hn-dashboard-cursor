#!/usr/bin/env node
/**
 * Print a one-line DASHBOARD_USERS value for Cloudflare / .env.local
 *
 * Usage:
 *   node scripts/print-dashboard-users.mjs
 *   node scripts/print-dashboard-users.mjs --brandi-password brandi
 *
 * Reads existing DASHBOARD_USERS from env.local when present (keeps Josiah's real password).
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
		return true;
	}
	return false;
}

loadEnvLocal();

let users;
const existing = process.env.DASHBOARD_USERS?.trim();
if (existing) {
	try {
		users = JSON.parse(existing);
	} catch {
		console.error('DASHBOARD_USERS in env.local is invalid JSON — using defaults.');
	}
}

if (!Array.isArray(users) || !users.length) {
	users = [
		{
			username: 'josiah',
			name: 'Josiah Burton',
			role: 'admin',
			password: process.env.ADMIN_PASSWORD || 'change-me-admin',
		},
		{
			username: 'brandi',
			name: 'Brandi Drieslein',
			role: 'cleaner',
			password: process.argv.includes('--brandi-password')
				? process.argv[process.argv.indexOf('--brandi-password') + 1]
				: process.env.BRANDI_PASSWORD || 'brandi',
			email: 'brandi@helloneighbor.com',
		},
	];
}

if (process.argv.includes('--brandi-password')) {
	const brandiPassword = process.argv[process.argv.indexOf('--brandi-password') + 1];
	const brandi = users.find((u) => String(u.username).toLowerCase() === 'brandi');
	if (brandi) brandi.password = brandiPassword;
}

console.log('Paste this into Cloudflare → Settings → Variables → DASHBOARD_USERS:\n');
console.log(JSON.stringify(users));
console.log('\nUsernames:', users.map((u) => u.username).join(', '));
console.log('Brandi login: username brandi + password shown above for brandi entry');
console.log('\nCloudflare tips:');
console.log('- Use "+ Add" → Type: Secret → paste ONLY the JSON array line above (no extra quotes).');
console.log('- If using the bulk "Edit" JSON view, the value must be an escaped string, e.g.:');
console.log('  "DASHBOARD_USERS": ' + JSON.stringify(JSON.stringify(users)));
