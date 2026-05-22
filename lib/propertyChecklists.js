/**
 * Turnover checklist form URLs.
 *
 * Two forms: CJC properties share one Fillout form; KWD502 uses another.
 * Set FILLOUT_CHECKLIST_FORMS in env.local (JSON), e.g.:
 * {"cjc":"https://forms.fillout.com/t/cjc-form","kwd502":"https://forms.fillout.com/t/kwd-form"}
 *
 * Per-property overrides still work via TASK_CHECKLIST_URLS.
 */
import { resolvePropertyCode } from './codes';
export const CHECKLIST_FORM_BY_PROPERTY = {
	CJC8103: 'cjc',
	CJC8201: 'cjc',
	CJC8303: 'cjc',
	CJC9203: 'cjc',
	CJC9206: 'cjc',
	KWD502: 'kwd502',
};

function parseJsonEnv(name) {
	try {
		return JSON.parse(process.env[name] || '{}');
	} catch {
		return {};
	}
}

function normalizeCode(code) {
	return String(code || '').trim().toUpperCase();
}

export function getChecklistFormKey(propertyCode) {
	const code = normalizeCode(propertyCode);
	return CHECKLIST_FORM_BY_PROPERTY[code] || null;
}

export function getChecklistUrl(propertyCode) {
	if (!propertyCode) return null;

	const code = resolvePropertyCode(propertyCode);
	if (!code) return null;

	const perProperty = parseJsonEnv('TASK_CHECKLIST_URLS');
	const normalized = normalizeCode(code);
	const directKey = Object.keys(perProperty).find((k) => normalizeCode(k) === normalized);
	if (directKey && perProperty[directKey]) return perProperty[directKey];

	const formKey = getChecklistFormKey(normalized);
	if (!formKey) return null;

	const forms = parseJsonEnv('FILLOUT_CHECKLIST_FORMS');
	return forms[formKey] || null;
}
