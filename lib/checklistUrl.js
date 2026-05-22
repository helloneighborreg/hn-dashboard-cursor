import { getChecklistUrl } from './propertyChecklists';
import { resolvePropertyCode } from './codes';

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
		property: resolvePropertyCode(task.property_name) || task.property_name,
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
 * Build the Fillout checklist link for a task.
 * Base URL from FILLOUT_CHECKLIST_BASE_URL (single form), FILLOUT_CHECKLIST_FORMS (by property group),
 * TASK_CHECKLIST_URLS (per property), or stored task.checklist_url.
 */
export function buildChecklistUrl(task) {
	const stored = task.checklist_url?.trim();
	const base =
		(process.env.FILLOUT_CHECKLIST_BASE_URL || '').trim()
		|| getChecklistUrl(task.property_name)
		|| stored
		|| null;

	if (!base) return null;
	return appendChecklistParams(base, task);
}

/** Attach computed checklist_url to a task row for API responses. */
export function withChecklistUrl(task) {
	if (!task) return task;
	return { ...task, checklist_url: buildChecklistUrl(task) };
}
