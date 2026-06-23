import { fetchJson } from './apiClient';

export async function setOwnerStatementInclusion({
	property_id,
	reservation_id,
	statement_month,
	check_in,
	included,
	admin_password,
}) {
	return fetchJson('/api/owner-statements/inclusions', {
		method: 'PUT',
		body: {
			property_id,
			reservation_id,
			statement_month,
			check_in,
			included,
			admin_password,
		},
	});
}

export async function saveOwnerStatementNotes({
	property_id,
	reservation_id,
	notes,
	admin_password,
}) {
	return fetchJson('/api/owner-statements/notes', {
		method: 'PUT',
		body: {
			property_id,
			reservation_id,
			notes,
			admin_password,
		},
	});
}

export async function approveOwnerStatements({ statements, date_from, date_to, pdfs }) {
	const pdfPayload = Array.isArray(pdfs)
		? pdfs
		: Object.entries(pdfs || {}).map(([property_id, pdf_base64]) => ({
			property_id,
			pdf_base64,
		}));

	return fetchJson('/api/owner-statements/approve', {
		method: 'POST',
		body: {
			statements,
			date_from,
			date_to,
			pdfs: pdfPayload,
		},
	});
}
