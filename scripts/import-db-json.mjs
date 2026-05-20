#!/usr/bin/env node
/**
 * One-time import: data/db.json → Supabase
 * Usage (from project root, with env.local configured):
 *   node scripts/import-db-json.mjs
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
	console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.local');
	process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
	console.error(
		'Invalid SUPABASE_URL. Use Project URL from Supabase → Settings → API\n' +
			'  Example: https://abcdefghijklmnop.supabase.co\n' +
			'  Not the supabase.com/dashboard/... link from your browser.',
	);
	process.exit(1);
}

const dbPath = path.join(root, 'data', 'db.json');
if (!existsSync(dbPath)) {
	console.error('No data/db.json found — nothing to import.');
	process.exit(1);
}

const { tasks = [], expenses = [] } = JSON.parse(readFileSync(dbPath, 'utf-8'));
const supabase = createClient(url, key, { auth: { persistSession: false } }); // url validated above

async function upsertBatch(table, rows) {
	if (!rows.length) return;
	const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
	if (error) throw error;
}

await upsertBatch('tasks', tasks);
await upsertBatch('expenses', expenses);
console.log(`Imported ${tasks.length} tasks and ${expenses.length} expenses into Supabase.`);
