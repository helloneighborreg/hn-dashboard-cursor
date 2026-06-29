import { todayIso } from '../dates';

/** Build turn-clean checklist helpers from a Fillout-style schema export. */
export function createTurnCleanChecklistModule(schema, { ids, pagePath }) {
	const FORM = schema;
	const FORM_ID = schema.id;
	const FORM_SLUG = schema.slug;

	const URL_PARAM_TO_QUESTION = {
		Guest: ids.guest,
		Property: ids.property,
		ReservationID: ids.reservation,
		TaskID: ids.task,
		id: ids.task,
		CheckOut: ids.today,
		Cleaner: ids.cleaner,
		guest: ids.guest,
		property: ids.property,
		reservation_id: ids.reservation,
		task_id: ids.task,
		checkout_date: ids.today,
		cleaner: ids.cleaner,
		assignee: ids.cleaner,
	};

	const HEADER_QUESTION_IDS = new Set([
		ids.guest,
		ids.property,
		ids.reservation,
		ids.task,
		ids.cleaner,
		ids.today,
		ids.previousGuestPhoto,
		ids.keyFobPhoto,
	].filter(Boolean));

	const HIDDEN_QUESTION_IDS = new Set([
		ids.taskPrefill,
		ids.reservationPrefill,
	].filter(Boolean));

	const HIDDEN_FOOTER_QUESTION_IDS = new Set([
		ids.baseCleanFee,
		ids.additionalCalcMirror,
		ids.totalAmount,
	].filter(Boolean));

	const FOOTER_QUESTION_IDS = new Set([
		ids.additionalCharge,
		ids.additionalAmount,
		ids.additionalDetails,
		ids.additionalPhoto,
		ids.maintenance,
		ids.maintenanceDetails,
		ids.maintenancePhoto,
		ids.notes,
		ids.baseCleanFee,
		ids.additionalCalcMirror,
		ids.totalAmount,
	].filter(Boolean));

	const ADDITIONAL_CHARGES_QUESTION_IDS = new Set([
		ids.additionalCharge,
		ids.additionalAmount,
		ids.additionalDetails,
		ids.additionalPhoto,
	].filter(Boolean));

	const MAINTENANCE_QUESTION_IDS = new Set([
		ids.maintenance,
		ids.maintenanceDetails,
		ids.maintenancePhoto,
	].filter(Boolean));

	const QUESTIONS_BY_ID = Object.fromEntries(schema.questions.map((q) => [q.id, q]));

	function getQuestion(id) {
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
			.replace(/^Kirkwood\s*-\s*/i, '')
			.trim();
	}

	function normalizeSectionTitle(title) {
		return String(title || '').replace(/^Kitchen-\s*/i, 'Kitchen - ').trim();
	}

	function roomFromSectionTitle(title) {
		const normalized = normalizeSectionTitle(title);
		if (normalized.includes(' - ')) {
			return normalized.split(' - ')[0].trim();
		}
		return normalized || 'Other';
	}

	function areaFromSectionTitle(title) {
		const normalized = normalizeSectionTitle(title);
		if (normalized.includes(' - ')) {
			return normalized.split(' - ').slice(1).join(' - ').trim();
		}
		return normalized || 'Other';
	}

	function checkboxValues(q, values) {
		const selected = values[q.id];
		return Array.isArray(selected) ? selected : [];
	}

	function isChecklistFilled(q, values) {
		const selected = new Set(checkboxValues(q, values));
		return (q.options || []).every((opt) => selected.has(opt.value));
	}

	function isPhotoFilled(values, photoId) {
		const files = values[photoId];
		return Array.isArray(files) && files.length > 0;
	}

	function isSectionComplete(section, values) {
		if (section.checklist && !isChecklistFilled(section.checklist, values)) return false;
		if (section.photo && !isPhotoFilled(values, section.photo.id)) return false;
		return true;
	}

	function buildChecklistSections() {
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

	function buildChecklistRoomGroups() {
		const groups = [];
		const groupByRoom = new Map();

		for (const section of buildChecklistSections()) {
			const room = roomFromSectionTitle(section.title);
			const areaTitle = areaFromSectionTitle(section.title);
			const enriched = { ...section, areaTitle };

			if (!groupByRoom.has(room)) {
				const group = { id: room, title: room, sections: [] };
				groupByRoom.set(room, group);
				groups.push(group);
			}
			groupByRoom.get(room).sections.push(enriched);
		}

		return groups;
	}

	function isRoomGroupComplete(group, values) {
		return group.sections.every((section) => isSectionComplete(section, values));
	}

	function buildExamplePhotoSections() {
		const headerPhotos = schema.questions.filter(
			(q) => HEADER_QUESTION_IDS.has(q.id) && q.type === 'FileUpload',
		);
		const sections = headerPhotos.map((q) => ({
			id: q.id,
			title: q.name,
		}));
		for (const section of buildChecklistSections()) {
			sections.push({ id: section.id, title: section.title });
		}
		return sections;
	}

	function buildExamplePhotoRoomGroups() {
		const headerPhotos = schema.questions.filter(
			(q) => HEADER_QUESTION_IDS.has(q.id) && q.type === 'FileUpload',
		);
		const groups = [];

		if (headerPhotos.length) {
			groups.push({
				id: 'job-details',
				title: 'Reservation Details',
				sections: headerPhotos.map((q) => ({
					id: q.id,
					title: q.name,
				})),
			});
		}

		for (const roomGroup of buildChecklistRoomGroups()) {
			groups.push({
				id: roomGroup.id,
				title: roomGroup.title,
				sections: roomGroup.sections.map((section) => ({
					id: section.id,
					title: section.areaTitle,
				})),
			});
		}

		return groups;
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

	function createInitialFormValues(overrides = {}, { baseCleanFee = 0 } = {}) {
		const values = {};
		for (const q of schema.questions) {
			if (HIDDEN_QUESTION_IDS.has(q.id)) {
				values[q.id] = '';
				continue;
			}
			if (q.id === ids.today && !overrides[q.id]) {
				values[q.id] = todayIso();
				continue;
			}
			if (q.id === ids.baseCleanFee && overrides[q.id] == null) {
				values[q.id] = baseCleanFee;
				continue;
			}
			values[q.id] = emptyValueForQuestion(q);
		}
		return { ...values, ...overrides };
	}

	function applyUrlParamsToFormValues(query = {}, options = {}) {
		const overrides = {};
		const taskPrefill = String(query.id || query.TaskID || query.task_id || '').trim();
		const reservationPrefill = String(
			query.ReservationID || query.reservation_id || query[ids.reservation] || '',
		).trim();

		for (const [param, questionId] of Object.entries(URL_PARAM_TO_QUESTION)) {
			const raw = query[param];
			if (raw == null || String(raw).trim() === '') continue;
			overrides[questionId] = String(Array.isArray(raw) ? raw[0] : raw).trim();
		}

		if (taskPrefill && ids.taskPrefill) overrides[ids.taskPrefill] = taskPrefill;
		if (reservationPrefill && ids.reservationPrefill) overrides[ids.reservationPrefill] = reservationPrefill;

		return createInitialFormValues(overrides, options);
	}

	function parseNumber(value) {
		if (value === '' || value == null) return 0;
		const n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}

	function applyCalculations(values) {
		const base = parseNumber(values[ids.baseCleanFee]);
		const additionalInput = parseNumber(values[ids.additionalAmount]);
		const hasAdditional = values[ids.additionalCharge] === 'Yes';
		const additional = hasAdditional ? additionalInput : 0;

		return {
			...values,
			[ids.additionalCalcMirror]: hasAdditional ? additionalInput : '',
			[ids.totalAmount]: base + additional,
		};
	}

	function isEmptyText(value) {
		return value == null || String(value).trim() === '';
	}

	const PHOTO_REQUIRED_MESSAGE = 'A current photo is required.';

	function validateForm(values) {
		const errors = {};
		const requiredText = [
			[ids.guest, 'Guest is required'],
			[ids.property, 'Property is required'],
			[ids.reservation, 'Reservation ID is required'],
			[ids.task, 'Task ID is required'],
			[ids.cleaner, 'Cleaner is required'],
			[ids.today, "Today's date is required"],
		];

		for (const [id, message] of requiredText) {
			if (isEmptyText(values[id])) errors[id] = message;
		}

		for (const id of [ids.previousGuestPhoto, ids.keyFobPhoto].filter(Boolean)) {
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

		if (isEmptyText(values[ids.additionalCharge])) {
			errors[ids.additionalCharge] = 'Please indicate if there is an additional charge';
		} else if (values[ids.additionalCharge] === 'Yes') {
			if (parseNumber(values[ids.additionalAmount]) <= 0) {
				errors[ids.additionalAmount] = 'Enter the additional charge amount';
			}
			if (isEmptyText(values[ids.additionalDetails])) {
				errors[ids.additionalDetails] = 'Describe the additional charge';
			}
			const chargePhotos = values[ids.additionalPhoto];
			if (!Array.isArray(chargePhotos) || chargePhotos.length === 0) {
				errors[ids.additionalPhoto] = PHOTO_REQUIRED_MESSAGE;
			}
		}

		if (ids.maintenance) {
			if (isEmptyText(values[ids.maintenance])) {
				errors[ids.maintenance] = 'Please indicate if there is a maintenance request';
			} else if (values[ids.maintenance] === 'Yes' && isEmptyText(values[ids.maintenanceDetails])) {
				errors[ids.maintenanceDetails] = 'Describe the maintenance request';
			}
		}

		return errors;
	}

	function serializeAnswers(values) {
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
		if (ids.taskPrefill) {
			answers[ids.taskPrefill] = {
				type: 'ShortAnswer',
				name: 'Task Prefill URL Parameter',
				value: values[ids.taskPrefill] || '',
			};
		}
		if (ids.reservationPrefill) {
			answers[ids.reservationPrefill] = {
				type: 'ShortAnswer',
				name: 'Reservation Prefill URL Parameter',
				value: values[ids.reservationPrefill] || '',
			};
		}
		return answers;
	}

	function invoiceTotal(values) {
		return parseNumber(values[ids.totalAmount]);
	}

	function deserializeAnswers(answers) {
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

	function buildSubmissionViewUrl(submissionId) {
		return `${pagePath}?submission_id=${submissionId}`;
	}

	return {
		FORM,
		FORM_ID,
		FORM_SLUG,
		ids,
		pagePath,
		roomFromSectionTitle,
		areaFromSectionTitle,
		URL_PARAM_TO_QUESTION,
		HEADER_QUESTION_IDS,
		HIDDEN_QUESTION_IDS,
		HIDDEN_FOOTER_QUESTION_IDS,
		FOOTER_QUESTION_IDS,
		ADDITIONAL_CHARGES_QUESTION_IDS,
		MAINTENANCE_QUESTION_IDS,
		getQuestion,
		buildChecklistSections,
		buildChecklistRoomGroups,
		isRoomGroupComplete,
		buildExamplePhotoSections,
		buildExamplePhotoRoomGroups,
		createInitialFormValues,
		applyUrlParamsToFormValues,
		applyCalculations,
		validateForm,
		serializeAnswers,
		invoiceTotal,
		deserializeAnswers,
		buildSubmissionViewUrl,
	};
}
