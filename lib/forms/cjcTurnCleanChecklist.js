import schema from './cjcTurnCleanChecklist.schema.json';
import { todayIso } from '../dates';

export const CJC_TURN_CLEAN_FORM = schema;
export const CJC_TURN_CLEAN_FORM_ID = schema.id;
export const CJC_TURN_CLEAN_FORM_SLUG = schema.slug;

/** Map Fillout URL parameter names → question ids. */
export const URL_PARAM_TO_QUESTION = {
	Guest: '2h8B',
	Property: 'jXsd',
	ReservationID: 'cdyd',
	TaskID: 'nqZp',
	id: 'nqZp',
	CheckOut: 'oNEm',
	Cleaner: 'kKyP',
	assignee: 'kKyP',
};

export const HEADER_QUESTION_IDS = new Set([
	'2h8B', // Guest
	'jXsd', // Property
	'cdyd', // Reservation ID
	'nqZp', // Task ID
	'kKyP', // Cleaner
	'oNEm', // Today's Date
	'5bXK', // Previous Guest - Photos
	'jb5y', // Key Fob & Garage Remote
]);

export const HIDDEN_QUESTION_IDS = new Set([
	'4TQe', // Task Prefill URL Parameter
	'mz41', // Reservation Prefill URL Parameter
]);

export const HIDDEN_FOOTER_QUESTION_IDS = new Set([
	'43sB', // + Base Clean Fee
	'8Fo1', // + Additional Charge Amount (calc mirror)
	'3sV8', // = Total Amount Due
]);

export const FOOTER_QUESTION_IDS = new Set([
	'kmJc', // Additional Charge
	'7Mpe', // Additional Charge Amount
	'jxUf', // Additional Charge Details
	'7p1o', // Additional Charge Photo
	'aaYL', // Notes
	'43sB', // Base Clean Fee
	'8Fo1', // + Additional Charge Amount (calc mirror)
	'3sV8', // Total Amount Due
]);

const QUESTIONS_BY_ID = Object.fromEntries(schema.questions.map((q) => [q.id, q]));

export function getQuestion(id) {
	return QUESTIONS_BY_ID[id] || null;
}

function isTaskListQuestion(q) {
	return q.type === 'Checkboxes' && /task list|checklist/i.test(q.name);
}

function isPhotoQuestion(q) {
	return q.type === 'FileUpload' && /photo upload/i.test(q.name);
}

function sectionTitleFromName(name) {
	return String(name || '')
		.replace(/\s*-\s*(Task List|Checklist|Photo Upload)\s*$/i, '')
		.trim();
}

/** Group checklist + photo pairs into accordion sections (bedroom, bath, kitchen, etc.). */
export function buildChecklistSections() {
	const bodyQuestions = schema.questions.filter(
		(q) => !HEADER_QUESTION_IDS.has(q.id)
			&& !HIDDEN_QUESTION_IDS.has(q.id)
			&& !FOOTER_QUESTION_IDS.has(q.id),
	);

	const sections = [];
	let i = 0;
	while (i < bodyQuestions.length) {
		const q = bodyQuestions[i];
		if (isTaskListQuestion(q)) {
			const next = bodyQuestions[i + 1];
			const photo = next && isPhotoQuestion(next) ? next : null;
			sections.push({
				id: q.id,
				title: sectionTitleFromName(q.name),
				checklist: q,
				photo: photo || null,
			});
			i += photo ? 2 : 1;
			continue;
		}
		if (isPhotoQuestion(q)) {
			sections.push({
				id: q.id,
				title: sectionTitleFromName(q.name),
				checklist: null,
				photo: q,
			});
			i += 1;
			continue;
		}
		i += 1;
	}
	return sections;
}

function emptyValueForQuestion(q) {
	switch (q.type) {
		case 'Checkboxes':
			return [];
		case 'FileUpload':
			return [];
		case 'NumberInput':
			return '';
		default:
			return '';
	}
}

export function createInitialFormValues(overrides = {}, { baseCleanFee = 0 } = {}) {
	const values = {};
	for (const q of schema.questions) {
		if (HIDDEN_QUESTION_IDS.has(q.id)) {
			values[q.id] = '';
			continue;
		}
		if (q.id === 'oNEm' && !overrides[q.id]) {
			values[q.id] = todayIso();
			continue;
		}
		if (q.id === '43sB' && overrides[q.id] == null) {
			values[q.id] = baseCleanFee;
			continue;
		}
		values[q.id] = emptyValueForQuestion(q);
	}
	return { ...values, ...overrides };
}

export function applyUrlParamsToFormValues(query = {}, options = {}) {
	const overrides = {};
	const taskPrefill = String(query.id || query.TaskID || '').trim();
	const reservationPrefill = String(query.ReservationID || '').trim();

	for (const [param, questionId] of Object.entries(URL_PARAM_TO_QUESTION)) {
		const raw = query[param];
		if (raw == null || String(raw).trim() === '') continue;
		overrides[questionId] = String(Array.isArray(raw) ? raw[0] : raw).trim();
	}

	if (taskPrefill) overrides['4TQe'] = taskPrefill;
	if (reservationPrefill) overrides['mz41'] = reservationPrefill;

	return createInitialFormValues(overrides, options);
}

function parseNumber(value) {
	if (value === '' || value == null) return 0;
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

/** Sync calculated invoice fields (+ additional, = total). */
export function applyCalculations(values) {
	const base = parseNumber(values['43sB']);
	const additionalInput = parseNumber(values['7Mpe']);
	const hasAdditional = values['kmJc'] === 'Yes';
	const additional = hasAdditional ? additionalInput : 0;

	return {
		...values,
		'8Fo1': hasAdditional ? additionalInput : '',
		'3sV8': base + additional,
	};
}

function isEmptyText(value) {
	return value == null || String(value).trim() === '';
}

function checkboxValues(q, values) {
	const selected = values[q.id];
	return Array.isArray(selected) ? selected : [];
}

const PHOTO_REQUIRED_MESSAGE = "A current photo is required... your camera archive doesn't count. 🙄";

export function validateForm(values) {
	const errors = {};
	const requiredText = [
		['2h8B', 'Guest is required'],
		['jXsd', 'Property is required'],
		['cdyd', 'Reservation ID is required'],
		['nqZp', 'Task ID is required'],
		['kKyP', 'Cleaner is required'],
		['oNEm', "Today's date is required"],
	];

	for (const [id, message] of requiredText) {
		if (isEmptyText(values[id])) errors[id] = message;
	}

	const headerPhotos = ['5bXK', 'jb5y'];
	for (const id of headerPhotos) {
		const files = values[id];
		if (!Array.isArray(files) || files.length === 0) {
			errors[id] = PHOTO_REQUIRED_MESSAGE;
		}
	}

	for (const section of buildChecklistSections()) {
		if (section.checklist) {
			const q = section.checklist;
			const selected = new Set(checkboxValues(q, values));
			const missing = (q.options || []).filter((opt) => !selected.has(opt.value));
			if (missing.length) {
				errors[q.id] = 'Acknowledge completion of all tasks.';
			}
		}
		if (section.photo) {
			const files = values[section.photo.id];
			if (!Array.isArray(files) || files.length === 0) {
				errors[section.photo.id] = PHOTO_REQUIRED_MESSAGE;
			}
		}
	}

	if (isEmptyText(values['kmJc'])) {
		errors['kmJc'] = 'Please indicate if there is an additional charge';
	} else if (values['kmJc'] === 'Yes') {
		if (parseNumber(values['7Mpe']) <= 0) {
			errors['7Mpe'] = 'Enter the additional charge amount';
		}
		if (isEmptyText(values['jxUf'])) {
			errors['jxUf'] = 'Describe the additional charge';
		}
		const chargePhotos = values['7p1o'];
		if (!Array.isArray(chargePhotos) || chargePhotos.length === 0) {
			errors['7p1o'] = PHOTO_REQUIRED_MESSAGE;
		}
	}

	return errors;
}

/** Shape answers for persistence — keyed by Fillout question id. */
export function serializeAnswers(values) {
	const answers = {};
	for (const q of schema.questions) {
		if (HIDDEN_QUESTION_IDS.has(q.id)) continue;
		const value = values[q.id];
		if (q.type === 'Checkboxes') {
			answers[q.id] = {
				type: q.type,
				name: q.name,
				value: Array.isArray(value) ? value : [],
			};
		} else if (q.type === 'FileUpload') {
			answers[q.id] = {
				type: q.type,
				name: q.name,
				files: Array.isArray(value) ? value : [],
			};
		} else {
			answers[q.id] = {
				type: q.type,
				name: q.name,
				value: value ?? '',
			};
		}
	}
	answers['4TQe'] = { type: 'ShortAnswer', name: 'Task Prefill URL Parameter', value: values['4TQe'] || '' };
	answers['mz41'] = { type: 'ShortAnswer', name: 'Reservation Prefill URL Parameter', value: values['mz41'] || '' };
	return answers;
}

export function invoiceTotal(values) {
	return parseNumber(values['3sV8']);
}

/** Restore form field values from a stored submission answers object. */
export function deserializeAnswers(answers) {
	const values = createInitialFormValues();
	for (const [id, answer] of Object.entries(answers || {})) {
		if (!answer || HIDDEN_QUESTION_IDS.has(id)) continue;
		if (answer.type === 'Checkboxes') {
			values[id] = Array.isArray(answer.value) ? answer.value : [];
		} else if (answer.type === 'FileUpload') {
			values[id] = (answer.files || []).map((file) => ({
				storage_path: file.storage_path || null,
				url: file.url || file.public_url || null,
				previewUrl: file.url || file.public_url || null,
				filename: file.filename || null,
				content_type: file.content_type || null,
				captured_at: file.captured_at || null,
			}));
		} else {
			values[id] = answer.value ?? '';
		}
	}
	return applyCalculations(values);
}
