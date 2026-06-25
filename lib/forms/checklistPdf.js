import {
	CJC_TURN_CLEAN_FORM,
	buildChecklistSections,
	FOOTER_QUESTION_IDS,
	getQuestion,
} from './cjcTurnCleanChecklist.js';
import { formatDateTime } from '../dates.js';

const PDF_MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LINE_HEIGHT = 5;

function answerText(questionId, answer) {
	if (!answer) return '—';
	if (answer.type === 'Checkboxes') {
		const selected = new Set(answer.value || []);
		const options = answer.options || getQuestion(questionId)?.options || [];
		if (options.length) {
			return options.map((opt) => `${selected.has(opt.value) ? '☑' : '☐'} ${opt.label || opt.value}`).join('\n');
		}
		return (answer.value || []).join(', ') || '—';
	}
	if (answer.type === 'FileUpload') {
		const count = (answer.files || []).length;
		return count ? `${count} photo${count === 1 ? '' : 's'}` : '—';
	}
	const value = answer.value;
	if (value == null || value === '') return '—';
	return String(value);
}

function addPageIfNeeded(doc, y, needed = LINE_HEIGHT) {
	if (y + needed > PAGE_HEIGHT - PDF_MARGIN) {
		doc.addPage();
		return PDF_MARGIN + 8;
	}
	return y;
}

function writeWrapped(doc, text, x, y, maxWidth) {
	const lines = doc.splitTextToSize(String(text || '—'), maxWidth);
	for (const line of lines) {
		y = addPageIfNeeded(doc, y, LINE_HEIGHT);
		doc.text(line, x, y);
		y += LINE_HEIGHT;
	}
	return y;
}

/** Build a portrait PDF of a submitted checklist (server-side). */
export async function buildChecklistPdfBytes(submission) {
	const { jsPDF } = await import('jspdf');
	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

	const answers = submission?.answers || {};
	const property = answers.jXsd?.value || submission.property_code || '—';
	const guest = answers['2h8B']?.value || submission.guest_name || '—';
	const cleaner = answers.kKyP?.value || submission.cleaner_name || '—';
	const reservation = answers.cdyd?.value || submission.reservation_id || '—';
	const submittedAt = submission.submitted_at || submission.updated_at;

	let y = PDF_MARGIN;
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(16);
	doc.text(CJC_TURN_CLEAN_FORM.name, PDF_MARGIN, y);
	y += 8;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(10);
	const meta = [
		`Property: ${property}`,
		`Guest: ${guest}`,
		`Cleaner: ${cleaner}`,
		`Reservation: ${reservation}`,
		`Submitted: ${formatDateTime(submittedAt)}`,
	];
	for (const line of meta) {
		y = writeWrapped(doc, line, PDF_MARGIN, y, PAGE_WIDTH - PDF_MARGIN * 2);
	}
	y += 4;

	for (const section of buildChecklistSections()) {
		y = addPageIfNeeded(doc, y, LINE_HEIGHT * 3);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(11);
		doc.text(section.title, PDF_MARGIN, y);
		y += LINE_HEIGHT + 1;

		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		if (section.checklist) {
			const answer = answers[section.checklist.id];
			y = writeWrapped(doc, answerText(section.checklist.id, answer), PDF_MARGIN + 2, y, PAGE_WIDTH - PDF_MARGIN * 2 - 2);
		}
		if (section.photo) {
			const answer = answers[section.photo.id];
			y = writeWrapped(doc, `Photos: ${answerText(section.photo.id, answer)}`, PDF_MARGIN + 2, y, PAGE_WIDTH - PDF_MARGIN * 2 - 2);
		}
		y += 2;
	}

	const footerQuestions = CJC_TURN_CLEAN_FORM.questions.filter((q) => FOOTER_QUESTION_IDS.has(q.id));
	if (footerQuestions.length) {
		y = addPageIfNeeded(doc, y, LINE_HEIGHT * 3);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(11);
		doc.text('Additional charges & notes', PDF_MARGIN, y);
		y += LINE_HEIGHT + 1;
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		for (const q of footerQuestions) {
			const answer = answers[q.id];
			if (!answer) continue;
			y = addPageIfNeeded(doc, y, LINE_HEIGHT * 2);
			doc.setFont('helvetica', 'bold');
			y = writeWrapped(doc, q.name, PDF_MARGIN + 2, y, PAGE_WIDTH - PDF_MARGIN * 2 - 2);
			doc.setFont('helvetica', 'normal');
			y = writeWrapped(doc, answerText(q.id, answer), PDF_MARGIN + 4, y, PAGE_WIDTH - PDF_MARGIN * 2 - 4);
			y += 1;
		}
	}

	return doc.output('arraybuffer');
}

export function checklistPdfStoragePath(submissionId) {
	return `${submissionId}/checklist.pdf`;
}

export function checklistPdfApiUrl(submissionId) {
	return `/api/forms/cjc-turn-clean-checklist/${submissionId}/pdf`;
}
