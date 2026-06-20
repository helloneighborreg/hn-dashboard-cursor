#!/usr/bin/env node
/**
 * Start Next dev with env.local loaded into the child process.
 * Fixes Plaid (and other vars) when next.config-only loading is not picked up by all runtimes.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnvFiles } from './load-env.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const loaded = loadEnvFiles();
if (loaded) {
	console.log(`[dev] Loaded ${loaded}`);
} else {
	console.warn('[dev] No env.local or .env.local found — copy .env.local.example');
}

const child = spawn(
	path.join(root, 'node_modules', '.bin', 'next'),
	['dev'],
	{ cwd: root, stdio: 'inherit', env: process.env },
);

child.on('exit', (code) => process.exit(code ?? 0));
