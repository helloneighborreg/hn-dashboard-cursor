#!/usr/bin/env node
/**
 * Build Tailwind to public/dev.css for local dev when webpack style injection fails.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'node_modules', '.bin', 'tailwindcss');
const args = ['-i', './styles/globals.css', '-o', './public/dev.css'];

const result = spawnSync(bin, args, { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
