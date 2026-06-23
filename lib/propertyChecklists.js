/**
 * Turnover checklist routes by property.
 *
 * CJC properties use the in-app turn clean checklist (`/forms/cjc-turn-clean-checklist`).
 */
import { resolvePropertyCode } from './codes';

export const CHECKLIST_FORM_BY_PROPERTY = {
	CJC8103: 'cjc',
	CJC8201: 'cjc',
	CJC8303: 'cjc',
	CJC9203: 'cjc',
	CJC9206: 'cjc',
};

/** In-app checklist routes (property group key → path). */
export const IN_APP_CHECKLIST_PATHS = {
	cjc: '/forms/cjc-turn-clean-checklist',
};

function normalizeCode(code) {
	return String(code || '').trim().toUpperCase();
}

export function getChecklistFormKey(propertyCode) {
	const code = normalizeCode(propertyCode);
	return CHECKLIST_FORM_BY_PROPERTY[code] || null;
}

export function getInAppChecklistPath(propertyCode) {
	const formKey = getChecklistFormKey(propertyCode);
	if (!formKey) return null;
	return IN_APP_CHECKLIST_PATHS[formKey] || null;
}

export function usesInAppChecklist(propertyCode) {
	return Boolean(getInAppChecklistPath(propertyCode));
}

export function getChecklistUrl(propertyCode) {
	if (!propertyCode) return null;

	const code = resolvePropertyCode(propertyCode);
	if (!code) return null;

	return getInAppChecklistPath(normalizeCode(code));
}
