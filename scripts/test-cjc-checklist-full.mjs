#!/usr/bin/env node
/**
 * Full CJC checklist completion test — all 35 room sections, validation, geofence, resume.
 * Usage: node scripts/test-cjc-checklist-full.mjs
 */

import fs from 'fs';
import { loadEnvFiles } from './load-env.mjs';
import { createClient } from '@supabase/supabase-js';
loadEnvFiles();

const BASE = (process.env.DASHBOARD_URL || 'http://localhost:3000').replace(/\/$/, '');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PHOTO_FILE = {
	base64: PNG,
	contentType: 'image/png',
	filename: 'test.png',
	captureSource: 'camera',
};

const schema = JSON.parse(fs.readFileSync('lib/forms/cjcTurnCleanChecklist.schema.json', 'utf8'));

function fail(message) {
	console.error(`✗ ${message}`);
	process.exit(1);
}

function ok(message) {
	console.log(`✓ ${message}`);
}

function buildFullAnswers({ taskId, reservationId, property, guest, cleaner }) {
	const answers = {};
	for (const q of schema.questions) {
		if (q.type === 'Checkboxes') {
			answers[q.id] = {
				type: q.type,
				name: q.name,
				value: (q.options || []).map((o) => o.value),
			};
		} else if (q.type === 'FileUpload') {
			answers[q.id] = {
				type: q.type,
				name: q.name,
				files: [],
			};
		} else if (q.id === '2h8B') {
			answers[q.id] = { type: q.type, name: q.name, value: guest };
		} else if (q.id === 'jXsd') {
			answers[q.id] = { type: q.type, name: q.name, value: property };
		} else if (q.id === 'cdyd') {
			answers[q.id] = { type: q.type, name: q.name, value: reservationId };
		} else if (q.id === 'nqZp') {
			answers[q.id] = { type: q.type, name: q.name, value: taskId };
		} else if (q.id === 'kKyP') {
			answers[q.id] = { type: q.type, name: q.name, value: cleaner };
		} else if (q.id === 'oNEm') {
			answers[q.id] = { type: q.type, name: q.name, value: '2026-06-24' };
		} else if (q.id === 'kmJc') {
			answers[q.id] = { type: q.type, name: q.name, value: 'No' };
		} else if (q.id === '43sB') {
			answers[q.id] = { type: q.type, name: q.name, value: 150 };
		} else if (q.id === '3sV8') {
			answers[q.id] = { type: q.type, name: q.name, value: 150 };
		} else if (q.id === '4TQe' || q.id === 'mz41') {
			answers[q.id] = { type: q.type, name: q.name, value: '' };
		} else {
			answers[q.id] = { type: q.type, name: q.name, value: '' };
		}
	}
	return answers;
}

function answersToValues(answers) {
	const values = {};
	for (const [id, answer] of Object.entries(answers)) {
		if (answer.type === 'Checkboxes') values[id] = answer.value;
		else if (answer.type === 'FileUpload') values[id] = answer.files;
		else values[id] = answer.value;
	}
	return values;
}

function collectPhotoQuestionIds(answers) {
	return Object.entries(answers)
		.filter(([, a]) => a?.type === 'FileUpload')
		.map(([id]) => id);
}

async function login(username, password) {
	const res = await fetch(`${BASE}/api/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) fail(`Login failed for ${username}: ${json.error || res.statusText}`);
	const cookie = res.headers.get('set-cookie')?.split(';')[0];
	if (!cookie) fail(`Login did not return session cookie for ${username}`);
	return cookie;
}

async function api(cookie, path, { method = 'GET', body, expectOk = true } = {}) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			Cookie: cookie,
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = await res.json().catch(() => ({}));
	if (expectOk && !res.ok) fail(`${method} ${path} → ${json.error || res.statusText}`);
	return { res, json };
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
});

const { data: sampleTask } = await supabase
	.from('tasks')
	.select('id, property_name, reservation_id, guest_name, assignee, status')
	.ilike('property_name', '%CJC%')
	.limit(1)
	.maybeSingle();
if (!sampleTask?.id) fail('No open CJC task found for full completion test');

const users = JSON.parse(process.env.DASHBOARD_USERS || '[]');
const admin = users.find((u) => u.role === 'admin') || users[0];
const cleaner = users.find((u) => u.role === 'cleaner') || users.find((u) => u.username?.toLowerCase() === 'brandi');
if (!admin?.password) fail('No admin credentials in env.local');
if (!cleaner?.password) fail('No cleaner credentials in env.local');

const testReservationId = `TEST-FULL-${Date.now()}`;
const answers = buildFullAnswers({
	taskId: sampleTask.id,
	reservationId: testReservationId,
	property: sampleTask.property_name,
	guest: sampleTask.guest_name || 'Test Guest',
	cleaner: cleaner.username || 'Smoke Test',
});

// --- Client-side validation (photos required before submit) ---
const photoIdsForValidation = collectPhotoQuestionIds(answers);
const incompleteValues = answersToValues(answers);
const missingPhotoFields = photoIdsForValidation.filter((id) => {
	const files = incompleteValues[id];
	return !Array.isArray(files) || files.length === 0;
});
if (missingPhotoFields.length !== photoIdsForValidation.length) {
	fail('Expected all photo fields to be empty before upload');
}
ok(`Incomplete form missing ${missingPhotoFields.length}/${photoIdsForValidation.length} required photos`);

const adminCookie = await login(admin.username, admin.password);
ok(`Logged in as admin (${admin.username})`);

// --- Gallery upload rejected ---
const galleryRes = await api(adminCookie, '/api/forms/cjc-turn-clean-checklist', {
	method: 'POST',
	body: {
		save: true,
		answers,
		fileUploads: [{ questionId: '5bXK', ...PHOTO_FILE, captureSource: 'gallery' }],
		reservation_id: testReservationId,
		property_code: sampleTask.property_name,
	},
	expectOk: false,
});
if (galleryRes.res.ok) fail('Expected gallery upload to be rejected');
ok('Gallery photo upload rejected');

// --- Cleaner geofence blocks submit without location ---
const cleanerCookie = await login(cleaner.username, cleaner.password);
ok(`Logged in as cleaner (${cleaner.username})`);

const geoBlock = await api(cleanerCookie, '/api/forms/cjc-turn-clean-checklist', {
	method: 'POST',
	body: {
		save: false,
		answers,
		reservation_id: testReservationId,
		property_code: sampleTask.property_name,
		task_id: sampleTask.id,
	},
	expectOk: false,
});
if (geoBlock.res.status !== 403) fail(`Expected geofence 403, got ${geoBlock.res.status}`);
ok('Cleaner submit blocked without GPS location');

// --- Admin can submit without location ---
const draft = await api(adminCookie, '/api/forms/cjc-turn-clean-checklist', {
	method: 'POST',
	body: {
		save: true,
		answers,
		reservation_id: testReservationId,
		property_code: sampleTask.property_name,
		task_id: sampleTask.id,
	},
});
const submissionId = draft.json?.data?.id;
if (!submissionId) fail('Draft save did not return submission id');
ok(`Draft saved (${submissionId})`);

const photoIds = collectPhotoQuestionIds(answers);
ok(`Uploading ${photoIds.length} photos…`);
for (const questionId of photoIds) {
	await api(adminCookie, `/api/forms/cjc-turn-clean-checklist/${submissionId}/files`, {
		method: 'POST',
		body: { questionId, ...PHOTO_FILE },
	});
}
ok(`All ${photoIds.length} photos uploaded`);

const submitted = await api(adminCookie, '/api/forms/cjc-turn-clean-checklist', {
	method: 'POST',
	body: {
		save: false,
		submission_id: submissionId,
		answers,
		reservation_id: testReservationId,
		property_code: sampleTask.property_name,
		task_id: sampleTask.id,
	},
});
if (submitted.json?.data?.status !== 'submitted') fail(`Expected submitted, got ${submitted.json?.data?.status}`);
if (!submitted.json?.data?.locked) fail('Expected locked after submit');
ok('Full checklist submitted and locked');

// --- Duplicate submit rejected ---
const dup = await api(adminCookie, '/api/forms/cjc-turn-clean-checklist', {
	method: 'POST',
	body: {
		save: false,
		submission_id: submissionId,
		answers,
		reservation_id: testReservationId,
		property_code: sampleTask.property_name,
	},
	expectOk: false,
});
if (dup.res.status !== 400 && dup.res.status !== 403) {
	fail(`Expected duplicate submit rejection, got ${dup.res.status}`);
}
ok('Duplicate submit rejected');

// --- Resume by reservation_id via GET API ---
const resume = await api(adminCookie, `/api/forms/cjc-turn-clean-checklist?submission_id=${submissionId}`);
if (resume.json?.data?.id !== submissionId) fail('Could not resume submission by id');
if (!resume.json?.data?.locked) fail('Resumed submission should be locked');
ok('Submission resumable via API');

// --- Verify all photos persisted ---
const { data: row, error } = await supabase
	.from('form_submissions')
	.select('answers, status, task_id, reservation_id')
	.eq('id', submissionId)
	.single();
if (error) fail(`Could not read submission: ${error.message}`);
if (row.status !== 'submitted') fail(`DB status should be submitted, got ${row.status}`);
if (row.task_id !== sampleTask.id) fail(`Task ID not linked (got ${row.task_id})`);
if (row.reservation_id !== testReservationId) fail('Reservation ID not saved');

const { data: linkedTask } = await supabase
	.from('tasks')
	.select('checklist_submission_url')
	.eq('id', sampleTask.id)
	.single();
if (!linkedTask?.checklist_submission_url?.includes(submissionId)) {
	fail('Task checklist_submission_url not set after submit');
}
ok('Task linked with checklist_submission_url');

let missingPhotos = 0;
for (const qid of photoIds) {
	const count = row?.answers?.[qid]?.files?.length || 0;
	if (count < 1) missingPhotos += 1;
}
if (missingPhotos) fail(`${missingPhotos} photo fields missing after full submit`);
ok(`All ${photoIds.length} photo fields persisted in DB`);

// --- Checklist URL prefill from task ---
const taskRes = await api(adminCookie, `/api/tasks/${sampleTask.id}`);
const checklistUrl = taskRes.json?.data?.checklist_url || taskRes.json?.checklist_url;
if (!checklistUrl?.includes('/forms/cjc-turn-clean-checklist')) {
	fail(`Task checklist_url missing or wrong: ${checklistUrl}`);
}
if (!checklistUrl.includes(sampleTask.id)) fail('Task checklist_url missing task_id param');
ok('Task checklist URL built correctly');

// Cleanup
await supabase.from('form_submission_files').delete().eq('submission_id', submissionId);
await supabase.from('form_submissions').delete().eq('id', submissionId);
ok('Test submission cleaned up');

console.log('\nCJC full checklist completion test passed.');
