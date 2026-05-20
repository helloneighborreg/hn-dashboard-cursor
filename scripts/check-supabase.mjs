#!/usr/bin/env node
/**
 * Verify Supabase env + that tasks/expenses tables exist.
 * Usage: npm run db:check
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv() {
	for (const file of ['env.local', '.env.local', '.env']) {
		const p = path.join(root, file);
		if (!existsSync(p)) continue;
		for (const line of readFileSync(p, 'utf-8').split('\n')) {
			const t = line.trim();
			if (!t || t.startsWith('#')) continue;
			const eq = t.indexOf('=');
			if (eq === -1) continue;
			const key = t.slice(0, eq).trim();
			let val = t.slice(eq + 1).trim();
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1);
			}
			if (!process.env[key]) process.env[key] = val;
		}
		break;
	}
}

loadEnv();

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
	console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.local');
	process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
	console.error('✗ Invalid SUPABASE_URL — use https://YOUR-PROJECT.supabase.co from Settings → API');
	process.exit(1);
}

console.log('✓ SUPABASE_URL format OK');

const supabase = createClient(url, key, { auth: { persistSession: false } });
let ok = true;

for (const table of ['tasks', 'expenses']) {
	const { error } = await supabase.from(table).select('id').limit(1);
	if (error) {
		console.error(`✗ Table "${table}": ${error.message}`);
		ok = false;
	} else {
		const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
		console.log(`✓ Table "${table}" exists (${count ?? 0} rows)`);
	}
}

if (!ok) {
	console.error('\n→ Tables missing? Run supabase/schema.sql in Supabase SQL Editor');
	console.error('→ "permission denied"? Run supabase/fix-permissions.sql in SQL Editor');
	console.error('→ Then: npm run db:import');
	process.exit(1);
}

console.log('\nSupabase is ready.');
