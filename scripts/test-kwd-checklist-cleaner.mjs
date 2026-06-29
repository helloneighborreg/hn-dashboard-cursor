#!/usr/bin/env node
/**
 * Smoke-test KWD checklist as a cleaner (geofence + save → upload → submit).
 * Usage: node scripts/test-kwd-checklist-cleaner.mjs
 */

import { loadEnvFiles } from './load-env.mjs';
import { createClient } from '@supabase/supabase-js';

loadEnvFiles();

const BASE = (process.env.DASHBOARD_URL || 'http://localhost:3000').replace(/\/$/, '');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const KIRKWOOD = { latitude: 41.5860985, longitude: -93.6224323 };

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
	.select('id, property_name, reservation_id, guest_name, assignee')
	.ilike('property_name', '%KWD%')
	.eq('assignee', 'Brandi Drieslein')
	.limit(1)
	.maybeSingle();
if (!sampleTask?.id) fail('No KWD task assigned to Brandi for smoke test');

const users = JSON.parse(process.env.DASHBOARD_USERS || '[]');
const cleaner = users.find((u) => u.role === 'cleaner');
if (!cleaner?.password) fail('No cleaner credentials in DASHBOARD_USERS');

const loginRes = await fetch(`${BASE}/api/auth/login`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ username: cleaner.username, password: cleaner.password }),
});
const loginJson = await loginRes.json().catch(() => ({}));
if (!loginRes.ok) fail(`Cleaner login failed: ${loginJson.error || loginRes.statusText}`);
const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
if (!cookie) fail('Login did not return session cookie');
ok(`Logged in as cleaner (${cleaner.username})`);

const answers = {
	'3UUV': { type: 'ShortAnswer', name: 'Guest', value: sampleTask.guest_name || 'Test Guest' },
	'jVpt': { type: 'ShortAnswer', name: 'Property', value: 'KWD502' },
	'cdyd': { type: 'ShortAnswer', name: 'Reservation ID', value: sampleTask.reservation_id || 'TEST-SMOKE' },
	'm1cH': { type: 'ShortAnswer', name: 'Task ID', value: sampleTask.id },
	'caar': { type: 'ShortAnswer', name: 'Cleaner', value: sampleTask.assignee || 'Brandi Drieslein' },
	'oNEm': { type: 'DatePicker', name: "Today's Date", value: '2026-06-28' },
	'23dg': {
		type: 'FileUpload',
		name: 'Previous Guest - Photos',
		files: [{ base64: PNG, contentType: 'image/png', filename: 'test.png', captureSource: 'camera' }],
	},
	'cdgA': {
		type: 'FileUpload',
		name: 'Key Fob',
		files: [{ base64: PNG, contentType: 'image/png', filename: 'keyfob.png', captureSource: 'camera' }],
	},
	'o3tQ': { type: 'Dropdown', name: 'Additional Charge', value: 'No' },
	'kMt1': { type: 'Dropdown', name: 'Maintenance', value: 'No' },
	'4WY4': { type: 'ShortAnswer', name: 'Notes', value: 'Cleaner smoke test' },
	'9kjH': { type: 'NumberInput', name: 'Base Clean Fee', value: 150 },
	'97S4': { type: 'NumberInput', name: 'Total Amount Due', value: 150 },
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

// Cleaner can access tasks
const tasksRes = await fetch(`${BASE}/api/tasks?tab=assigned`, { headers: { Cookie: cookie } });
if (!tasksRes.ok) fail(`Cleaner cannot access assigned tasks (${tasksRes.status})`);
ok('Cleaner can access /api/tasks');

// Checklist page route (SSR)
const pageRes = await fetch(
	`${BASE}/forms/kwd-turn-clean-checklist?task_id=${sampleTask.id}&property=KWD502`,
	{ headers: { Cookie: cookie } },
);
if (!pageRes.ok) fail(`Checklist page returned ${pageRes.status}`);
ok('Checklist page loads for cleaner');

const draft = await api('/api/forms/kwd-turn-clean-checklist', {
	method: 'POST',
	body: {
		save: true,
		answers: {
			...answers,
			'23dg': { ...answers['23dg'], files: [] },
			'cdgA': { ...answers['cdgA'], files: [] },
		},
		fileUploads: [
			{ questionId: '23dg', base64: PNG, contentType: 'image/png', filename: 'test.png', captureSource: 'camera' },
			{ questionId: 'cdgA', base64: PNG, contentType: 'image/png', filename: 'keyfob.png', captureSource: 'camera' },
		],
		task_id: sampleTask.id,
		reservation_id: answers['cdyd'].value,
		property_code: 'KWD502',
	},
});
const submissionId = draft?.data?.id;
if (!submissionId) fail('Draft save did not return submission id');
ok(`Draft saved (${submissionId})`);

// Submit without location should fail for cleaner
const noGeoRes = await fetch(`${BASE}/api/forms/kwd-turn-clean-checklist`, {
	method: 'POST',
	headers: { Cookie: cookie, 'Content-Type': 'application/json' },
	body: JSON.stringify({
		save: false,
		submission_id: submissionId,
		answers: { ...answers, '23dg': { ...answers['23dg'], files: [] }, 'cdgA': { ...answers['cdgA'], files: [] } },
		task_id: sampleTask.id,
		reservation_id: answers['cdyd'].value,
		property_code: 'KWD502',
	}),
});
if (noGeoRes.ok) fail('Expected submit without geolocation to be rejected for cleaner');
ok('Submit without geolocation rejected for cleaner');

const submitted = await api('/api/forms/kwd-turn-clean-checklist', {
	method: 'POST',
	body: {
		save: false,
		submission_id: submissionId,
		answers: {
			...answers,
			'23dg': { ...answers['23dg'], files: [] },
			'cdgA': { ...answers['cdgA'], files: [] },
		},
		task_id: sampleTask.id,
		reservation_id: answers['cdyd'].value,
		property_code: 'KWD502',
		location: KIRKWOOD,
	},
});
if (submitted?.data?.status !== 'submitted') fail(`Expected submitted status, got ${submitted?.data?.status}`);
if (!submitted?.data?.locked) fail('Expected submitted checklist to be locked');
if (!submitted?.data?.view_url?.includes('kwd-turn-clean-checklist')) fail(`Bad view_url: ${submitted?.data?.view_url}`);
ok(`Checklist submitted (${submitted.data.view_url})`);

const viewRes = await fetch(`${BASE}${submitted.data.view_url}`, { headers: { Cookie: cookie } });
if (!viewRes.ok) fail(`View submission page returned ${viewRes.status}`);
ok('View submission link works');

await supabase.from('form_submission_files').delete().eq('submission_id', submissionId);
await supabase.from('form_submissions').delete().eq('id', submissionId);
ok('Test submission cleaned up');

console.log('\nKWD cleaner checklist smoke test passed.');
