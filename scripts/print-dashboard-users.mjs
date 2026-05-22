#!/usr/bin/env node
/**
 * Print a one-line DASHBOARD_USERS value for Netlify / .env.local
 *
 * Usage:
 *   node scripts/print-dashboard-users.mjs
 *   node scripts/print-dashboard-users.mjs --brandi-password brandi
 */

const users = [
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

console.log('Paste this into Netlify → Environment variables → DASHBOARD_USERS:\n');
console.log(JSON.stringify(users));
console.log('\nUsernames:', users.map((u) => u.username).join(', '));
console.log('Brandi password:', users.find((u) => u.username === 'brandi').password);
