#!/usr/bin/env node
/**
 * Print SQL to fix "permission denied for table supply_*" errors.
 * Paste into Supabase → SQL Editor → Run.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(
	path.join(root, 'supabase/migrations/20260625_supply_permissions.sql'),
	'utf-8',
);
console.log(sql);
