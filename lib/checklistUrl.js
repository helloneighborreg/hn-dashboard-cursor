import { getChecklistUrl } from './propertyChecklists';
import { resolvePropertyCode } from './codes';

function propertyNameFromTitle(title) {
	if (!title?.includes(' - ')) return '';
	return title.split(' - ').slice(1).join(' - ').trim();
}

/** Property code from task row (property_name, then title suffix). */
export function resolveTaskPropertyCode(task) {
	if (!task) return null;
	const fromName = resolvePropertyCode(task.property_name);
	if (fromName) return fromName;
	return resolvePropertyCode(propertyNameFromTitle(task.title)) || null;
}

function resolveChecklistBase(task) {
	const code = resolveTaskPropertyCode(task);
	const inApp = getChecklistUrl(code || task?.property_name);
	if (inApp) return inApp;

	const stored = task?.checklist_url?.trim();
	if (stored) return stored;

	return (process.env.FILLOUT_CHECKLIST_BASE_URL || '').trim() || null;
}

/** Map internal task fields → Fillout URL parameter names (customize in env). */
const DEFAULT_PARAM_MAP = {
	property: 'property',
	guest: 'guest',
	reservation_id: 'reservation_id',
	task_id: 'task_id',
	checkout_date: 'checkout_date',
	assignee: 'assignee',
};

function getParamMap() {
	if (!process.env.FILLOUT_URL_PARAM_MAP) return DEFAULT_PARAM_MAP;
	try {
		return { ...DEFAULT_PARAM_MAP, ...JSON.parse(process.env.FILLOUT_URL_PARAM_MAP) };
	} catch {
		return DEFAULT_PARAM_MAP;
	}
}

function appendChecklistParams(base, task) {
	const paramMap = getParamMap();
	const values = {
		property: resolveTaskPropertyCode(task) || task.property_name,
		guest: task.guest_name,
		reservation_id: task.reservation_id,
		task_id: task.id,
		checkout_date: task.checkout_date || task.due_date,
		assignee: task.assignee,
	};

	const params = new URLSearchParams();
	for (const [field, filloutKeyOrKeys] of Object.entries(paramMap)) {
		const v = values[field];
		if (v == null || String(v).trim() === '') continue;
		const keys = Array.isArray(filloutKeyOrKeys) ? filloutKeyOrKeys : [filloutKeyOrKeys];
		for (const filloutKey of keys) {
			if (!filloutKey) continue;
			params.set(filloutKey, String(v).trim());
		}
	}

	const qs = params.toString();
	if (!qs) return base;
	return `${base}${base.includes('?') ? '&' : '?'}${qs}`;
}

/**
 * Build the checklist link for a task (in-app form or legacy Fillout URL).
 * Prefers in-app routes for mapped properties, then stored URL, then FILLOUT_CHECKLIST_BASE_URL.
 */
export function buildChecklistUrl(task) {
	const base = resolveChecklistBase(task);
	if (!base) return null;
	return appendChecklistParams(base, task);
}

/** Checklist href for UI — recomputes when API omitted checklist_url on a partial task update. */
export function getTaskChecklistHref(task, { completed = false } = {}) {
	if (!task) return null;
	if (completed) {
		return buildCompletedChecklistUrl(task)
			|| task.checklist_submission_url?.trim()
			|| buildChecklistUrl(task)
			|| task.checklist_url
			|| null;
	}
	return buildChecklistUrl(task) || task.checklist_url || null;
}

/** URL for viewing a completed Fillout checklist submission (all answers, not the PDF). */
export function buildCompletedChecklistUrl(task) {
	const stored = task.checklist_submission_url?.trim();
	if (stored) return stored;
	return null;
}

/** Parse in-app submission id from a checklist view URL. */
export function submissionIdFromChecklistUrl(url) {
	if (!url) return null;
	try {
		const parsed = url.startsWith('http') ? new URL(url) : new URL(url, 'http://localhost');
		const id = parsed.searchParams.get('submission_id');
		return id?.trim() || null;
	} catch {
		return null;
	}
}

/** Attach computed checklist_url to a task row for API responses. */
export function withChecklistUrl(task) {
	if (!task) return task;
	return {
		...task,
		checklist_url: buildChecklistUrl(task),
		completed_checklist_url: buildCompletedChecklistUrl(task),
	};
}
