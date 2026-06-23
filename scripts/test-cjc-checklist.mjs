#!/usr/bin/env node
/**
 * Smoke-test CJC checklist save → upload → submit flow.
 * Usage: node scripts/test-cjc-checklist.mjs
 */

import { loadEnvFiles } from './load-env.mjs';
import { createClient } from '@supabase/supabase-js';

loadEnvFiles();

const BASE = (process.env.DASHBOARD_URL || 'http://localhost:3000').replace(/\/$/, '');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function fail(message) {
	console.error(`✗ ${message}`);
	process.exit(1);
}

function ok(message) {
	console.log(`✓ ${message}`);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
});
const { data: sampleTask } = await supabase
	.from('tasks')
	.select('id, property_name, reservation_id, guest_name')
	.ilike('property_name', '%CJC%')
	.limit(1)
	.maybeSingle();
if (!sampleTask?.property_name) fail('No CJC task found in database for smoke test');

const users = JSON.parse(process.env.DASHBOARD_USERS || '[]');
const admin = users.find((u) => u.role === 'admin') || users[0];
if (!admin?.password) fail('No DASHBOARD_USERS credentials in env.local');

const loginRes = await fetch(`${BASE}/api/auth/login`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ username: admin.username, password: admin.password }),
});
const loginJson = await loginRes.json().catch(() => ({}));
if (!loginRes.ok) fail(`Login failed: ${loginJson.error || loginRes.statusText}`);
const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
if (!cookie) fail('Login did not return session cookie');
ok(`Logged in as ${admin.username}`);

const answers = {
	'2h8B': { type: 'ShortAnswer', name: 'Guest', value: sampleTask.guest_name || 'Test Guest' },
	'jXsd': { type: 'ShortAnswer', name: 'Property', value: sampleTask.property_name || 'CJC8103' },
	'cdyd': { type: 'ShortAnswer', name: 'Reservation ID', value: sampleTask.reservation_id || 'TEST-SMOKE' },
	'nqZp': { type: 'ShortAnswer', name: 'Task ID', value: '' },
	'kKyP': { type: 'ShortAnswer', name: 'Cleaner', value: 'Smoke Test' },
	'oNEm': { type: 'DatePicker', name: "Today's Date", value: '2026-06-22' },
	'5bXK': {
		type: 'FileUpload',
		name: 'Previous Guest - Photos',
		files: [{ base64: PNG, contentType: 'image/png', filename: 'test.png', captureSource: 'camera' }],
	},
	'kmJc': { type: 'MultipleChoice', name: 'Additional Charge', value: 'No' },
	'43sB': { type: 'NumberInput', name: 'Base Clean Fee', value: 150 },
	'3sV8': { type: 'NumberInput', name: 'Total Amount Due', value: 150 },
};

async function api(path, { method = 'GET', body } = {}) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			Cookie: cookie,
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) fail(`${method} ${path} → ${json.error || res.statusText}`);
	return json;
}

const draft = await api('/api/forms/cjc-turn-clean-checklist', {
	method: 'POST',
	body: {
		save: true,
		answers: {
			...answers,
			'5bXK': { ...answers['5bXK'], files: [] },
		},
		fileUploads: answers['5bXK'].files.map((file) => ({
			questionId: '5bXK',
			...file,
		})),
		task_id: null,
		reservation_id: answers['cdyd'].value,
		property_code: answers['jXsd'].value,
	},
});
const submissionId = draft?.data?.id;
if (!submissionId) fail('Draft save did not return submission id');
ok(`Draft saved (${submissionId})`);

await api(`/api/forms/cjc-turn-clean-checklist/${submissionId}/files`, {
	method: 'POST',
	body: {
		questionId: '5bXK',
		base64: PNG,
		contentType: 'image/png',
		filename: 'test.png',
		captureSource: 'camera',
	},
});
ok('Photo uploaded');

const submitted = await api('/api/forms/cjc-turn-clean-checklist', {
	method: 'POST',
	body: {
		save: false,
		submission_id: submissionId,
		answers: {
			...answers,
			'5bXK': { ...answers['5bXK'], files: [] },
		},
		task_id: null,
		reservation_id: answers['cdyd'].value,
		property_code: answers['jXsd'].value,
	},
});
if (submitted?.data?.status !== 'submitted') fail(`Expected submitted status, got ${submitted?.data?.status}`);
if (!submitted?.data?.locked) fail('Expected submitted checklist to be locked');
ok('Checklist submitted and locked');

const lockedSave = await fetch(`${BASE}/api/forms/cjc-turn-clean-checklist`, {
	method: 'POST',
	headers: {
		Cookie: cookie,
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({
		save: true,
		submission_id: submissionId,
		answers: {
			...answers,
			'5bXK': { ...answers['5bXK'], files: [] },
		},
		reservation_id: answers['cdyd'].value,
		property_code: answers['jXsd'].value,
	}),
});
const lockedSaveJson = await lockedSave.json().catch(() => ({}));
if (lockedSave.ok) fail('Expected locked checklist save to be rejected');
ok(`Locked checklist save rejected (${lockedSaveJson.error || lockedSave.status})`);

const unlocked = await api(`/api/forms/cjc-turn-clean-checklist/${submissionId}/unlock`, {
	method: 'POST',
	body: { admin_password: admin.password },
});
if (unlocked?.data?.locked !== false) fail('Expected unlock to clear locked state');
ok('Admin unlocked checklist');

const unlockedSave = await api('/api/forms/cjc-turn-clean-checklist', {
	method: 'POST',
	body: {
		save: true,
		submission_id: submissionId,
		answers: {
			...answers,
			'5bXK': { ...answers['5bXK'], files: [] },
		},
		reservation_id: answers['cdyd'].value,
		property_code: answers['jXsd'].value,
	},
});
if (unlockedSave?.data?.status !== 'draft') fail('Expected draft status after unlocked save');
ok('Unlocked checklist can be saved again');

const { data: row, error } = await supabase
	.from('form_submissions')
	.select('answers, status')
	.eq('id', submissionId)
	.single();
if (error) fail(`Could not read submission: ${error.message}`);

const photoCount = row?.answers?.['5bXK']?.files?.length || 0;
if (photoCount < 1) fail(`Photos missing after submit (count=${photoCount})`);
ok(`Photos preserved after submit (${photoCount})`);

await supabase.from('form_submission_files').delete().eq('submission_id', submissionId);
await supabase.from('form_submissions').delete().eq('id', submissionId);
ok('Test submission cleaned up');

console.log('\nCJC checklist smoke test passed.');
