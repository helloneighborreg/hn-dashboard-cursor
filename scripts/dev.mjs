#!/usr/bin/env node
/**
 * Start Next dev with env.local loaded into the child process.
 * Fixes Plaid (and other vars) when next.config-only loading is not picked up by all runtimes.
 */
import { spawn, spawnSync } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnvFiles } from './load-env.mjs';

const DEV_PORT = Number(process.env.PORT || 3000);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function portFree(port) {
	return new Promise((resolve) => {
		const server = net.createServer();
		server.once('error', () => resolve(false));
		server.once('listening', () => {
			server.close(() => resolve(true));
		});
		server.listen(port);
	});
}

const loaded = loadEnvFiles();
if (loaded) {
	console.log(`[dev] Loaded ${loaded}`);
} else {
	console.warn('[dev] No env.local or .env.local found — copy .env.local.example');
}

if (!(await portFree(DEV_PORT))) {
	console.error(`\n[dev] Port ${DEV_PORT} is already in use.`);
	console.error(`[dev] Stop other dev servers, then run: npm run dev`);
	console.error(`[dev] Or find the process: lsof -i :${DEV_PORT}\n`);
	process.exit(1);
}

console.log('[dev] Building public/dev.css for local styling…');
const cssBuild = spawnSync(
	path.join(root, 'node_modules', '.bin', 'tailwindcss'),
	['-i', './styles/globals.css', '-o', './public/dev.css'],
	{ cwd: root, stdio: 'inherit' },
);
if (cssBuild.status !== 0) {
	console.warn('[dev] dev.css build failed — page may look unstyled until fixed');
}

const cssWatch = spawn(
	path.join(root, 'node_modules', '.bin', 'tailwindcss'),
	['-i', './styles/globals.css', '-o', './public/dev.css', '--watch'],
	{ cwd: root, stdio: 'inherit' },
);

const child = spawn(
	path.join(root, 'node_modules', '.bin', 'next'),
	['dev', '-p', String(DEV_PORT)],
	{ cwd: root, stdio: 'inherit', env: process.env },
);

function shutdown(code) {
	cssWatch.kill('SIGTERM');
	child.kill('SIGTERM');
	process.exit(code ?? 0);
}

child.on('exit', (code) => shutdown(code ?? 0));
cssWatch.on('exit', (code) => {
	if (code && code !== 0) console.warn('[dev] tailwind watch exited:', code);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

setTimeout(() => {
	console.log(`[dev] Open http://localhost:${DEV_PORT} (hard-refresh if the page looks wrong).`);
}, 2500);
