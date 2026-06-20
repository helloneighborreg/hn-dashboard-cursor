/**
 * Fillout REST API client (https://www.fillout.com/help/fillout-rest-api)
 */

import { fetchWithRetry } from './httpFetch';

const DEFAULT_BASE = 'https://api.fillout.com/v1/api';

function getApiToken() {
	return (process.env.FILLOUT_API_TOKEN || process.env.FILLOUT_API_KEY || '').trim();
}

function getBaseUrl() {
	return (process.env.FILLOUT_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
}

export function filloutApiConfigured() {
	return Boolean(getApiToken());
}

async function filloutRequest(path, params = {}) {
	const token = getApiToken();
	if (!token) {
		throw new Error(
			'FILLOUT_API_TOKEN is not set. Generate one at https://build.fillout.com/home/settings/developer',
		);
	}

	const url = new URL(`${getBaseUrl()}${path}`);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
	}

	const res = await fetchWithRetry(url.toString(), {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/json',
		},
	});

	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(json.message || json.error || `Fillout API ${res.status}: ${path}`);
	}
	return json;
}

export async function getFilloutForms() {
	return filloutRequest('/forms');
}

export async function getFilloutSubmissions(formId, options = {}) {
	const {
		limit = 150,
		offset = 0,
		afterDate,
		beforeDate,
		sort = 'desc',
		includeEditLink,
	} = options;
	return filloutRequest(`/forms/${formId}/submissions`, {
		limit,
		offset,
		afterDate,
		beforeDate,
		sort,
		...(includeEditLink != null ? { includeEditLink } : {}),
	});
}

export async function getFilloutSubmission(formId, submissionId, options = {}) {
	const { includeEditLink = true } = options;
	return filloutRequest(`/forms/${formId}/submissions/${submissionId}`, {
		...(includeEditLink ? { includeEditLink: true } : {}),
	});
}

/** Paginate all finished submissions for a form. */
export async function* iterateFilloutSubmissions(formId, options = {}) {
	const limit = options.limit ?? 150;
	let offset = 0;

	for (;;) {
		const page = await getFilloutSubmissions(formId, { ...options, limit, offset });
		const responses = page.responses || [];
		for (const submission of responses) yield submission;

		offset += responses.length;
		if (!responses.length || offset >= (page.totalResponses ?? offset)) break;
		await new Promise((r) => setTimeout(r, 220));
	}
}

function parseJsonEnv(name) {
	try {
		return JSON.parse(process.env[name] || '{}');
	} catch {
		return {};
	}
}

function slugFromChecklistUrl(url) {
	try {
		const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
		return path.split('/').pop()?.toLowerCase() || '';
	} catch {
		return '';
	}
}

function scoreFormMatch(form, key, slug) {
	const name = String(form.name || '').toLowerCase();
	let score = 0;

	if (slug && name.replace(/[^a-z0-9]/g, '').includes(slug.replace(/[^a-z0-9]/g, '').slice(0, 8))) {
		score += 40;
	}

	if (key === 'cjc') {
		if (name.includes('cjc') && name.includes('turn clean')) score += 50;
		if (name.includes('cascade')) score += 30;
	}
	if (key === 'kwd502') {
		if (name.includes('kwd') && name.includes('turn clean')) score += 50;
		if (name.includes('kirkwood')) score += 30;
	}

	if (name.includes('test')) score -= 40;
	if (form.isPublished) score += 10;
	if (name === 'cjc: turn clean checklist' || name === 'kwd: turn clean checklist') score += 25;

	return score;
}

/** Resolve configured checklist form keys → Fillout form IDs. */
export async function resolveFilloutFormIds() {
	const explicit = parseJsonEnv('FILLOUT_FORM_IDS');
	if (Object.keys(explicit).length) return explicit;

	const checklistForms = parseJsonEnv('FILLOUT_CHECKLIST_FORMS');
	const keys = Object.keys(checklistForms);
	if (!keys.length) {
		throw new Error('Set FILLOUT_CHECKLIST_FORMS or FILLOUT_FORM_IDS in env.local');
	}

	const forms = await getFilloutForms();
	const resolved = {};

	for (const key of keys) {
		const slug = slugFromChecklistUrl(checklistForms[key]);
		const ranked = forms
			.map((form) => ({ form, score: scoreFormMatch(form, key, slug) }))
			.filter(({ score }) => score > 0)
			.sort((a, b) => b.score - a.score);

		const match = ranked[0]?.form;
		if (!match) {
			throw new Error(
				`Could not match Fillout form for "${key}". Set FILLOUT_FORM_IDS={"${key}":"your-form-id"}}.`,
			);
		}
		resolved[key] = match.formId;
	}

	return resolved;
}
