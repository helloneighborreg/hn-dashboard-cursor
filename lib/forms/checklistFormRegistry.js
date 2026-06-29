import * as cjc from './cjcTurnCleanChecklist';
import * as kwd from './kwdTurnCleanChecklist';

const CHECKLIST_FORMS = {
	[cjc.CJC_TURN_CLEAN_FORM_SLUG]: cjc,
	[kwd.KWD_TURN_CLEAN_FORM_SLUG]: kwd,
};

export function getChecklistFormModule(formSlug) {
	return CHECKLIST_FORMS[formSlug] || null;
}

export function getChecklistFormModuleByPath(path) {
	const slug = String(path || '').replace(/^\/forms\//, '').split('?')[0];
	return CHECKLIST_FORMS[slug] || null;
}

export function resolveChecklistFormFromSubmission(submission) {
	if (!submission) return cjc;
	return CHECKLIST_FORMS[submission.form_slug] || cjc;
}

export { cjc, kwd };
