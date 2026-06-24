#!/usr/bin/env node
/**
 * Check whether a username/password matches env.local dashboard users.
 *
 * Usage:
 *   node scripts/verify-login.mjs josiah your-password
 */

import bcrypt from 'bcryptjs';
import { loadEnvFiles } from './load-env.mjs';

loadEnvFiles();

function loadUsers() {
	const raw = process.env.DASHBOARD_USERS?.trim();
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((u) => u?.username && u?.password);
	} catch {
		return [];
	}
}

async function passwordMatches(input, stored) {
	if (!stored) return false;
	if (stored.startsWith('$2')) return bcrypt.compare(input, stored);
	return input === stored;
}

async function findUser(username, password) {
	const normalized = username?.trim().toLowerCase();
	const users = loadUsers();
	let matches = users;

	if (normalized) {
		const exact = users.filter(
			(u) =>
				String(u.username).toLowerCase() === normalized
				|| String(u.name || u.username).toLowerCase() === normalized,
		);
		if (exact.length) {
			matches = exact;
		} else {
			const prefix = users.filter((u) => {
				const uUser = String(u.username).toLowerCase();
				const uName = String(u.name || u.username).toLowerCase();
				return uUser.startsWith(normalized) || uName.startsWith(normalized);
			});
			const token = prefix.length
				? prefix
				: users.filter((u) => {
					const firstUser = String(u.username).toLowerCase().split(/\s+/)[0];
					const firstName = String(u.name || u.username).toLowerCase().split(/\s+/)[0];
					return firstUser === normalized || firstName === normalized;
				});
			matches = token.length === 1 ? token : [];
		}
	} else if (users.length === 1) {
		matches = users;
	} else {
		return null;
	}

	for (const entry of matches) {
		if (await passwordMatches(password, String(entry.password))) {
			return entry;
		}
	}
	return null;
}

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
	console.error('Usage: node scripts/verify-login.mjs <username> <password>');
	process.exit(1);
}

const user = await findUser(username, password.trim());
if (user) {
	console.log(`OK — ${user.name || user.username} (${user.role || 'admin'})`);
	process.exit(0);
}

console.error('No match — check username and password in env.local DASHBOARD_USERS');
console.error('Configured usernames:', loadUsers().map((u) => u.username).join(', ') || '(none)');
process.exit(1);
