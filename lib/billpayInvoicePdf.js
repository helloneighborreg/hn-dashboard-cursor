import { readFileSync } from 'fs';
import { join } from 'path';
import {
	MANAGEMENT_COMPANY_NAME,
	OWNER_STATEMENT_MANAGER,
	OWNER_STATEMENT_MANAGER_ADDRESS,
} from './ownerStatementReport.js';
import { formatDateOrDash } from './dates.js';

const PDF_MARGIN = 14;
const PAGE_WIDTH = 210;

let logoDataUrlPromise = null;

function loadHorizontalLogoDataUrl() {
	if (logoDataUrlPromise) return logoDataUrlPromise;
	logoDataUrlPromise = Promise.resolve().then(() => {
		try {
			const buf = readFileSync(join(process.cwd(), 'public', 'logo-pdf.png'));
			return `data:image/png;base64,${buf.toString('base64')}`;
		} catch {
			return null;
		}
	});
	return logoDataUrlPromise;
}

function fmtAmount(value) {
	const n = Number(value) || 0;
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(n);
}

export function billpayInvoicePdfFilename(invoice) {
	const payee = (invoice?.payee || 'cleaner').replace(/[^\w.-]+/g, '-');
	const property = (invoice?.property_name || 'property').replace(/[^\w.-]+/g, '-');
	const date = invoice?.checkout_date || 'invoice';
	return `cleaning-invoice-${payee}-${property}-${date}.pdf`;
}

/** Build a portrait cleaning invoice PDF for Billpay (server-side). */
export async function buildBillpayInvoicePdfBytes(invoice) {
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable'),
	]);
	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
	const logoDataUrl = await loadHorizontalLogoDataUrl();
	const rightEdge = PAGE_WIDTH - PDF_MARGIN;
	let y = PDF_MARGIN;

	if (logoDataUrl) {
		try {
			doc.addImage(logoDataUrl, 'PNG', PDF_MARGIN, y, 55, 9);
		} catch {
			// ignore logo failures
		}
	}

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(18);
	doc.text('CLEANING INVOICE', rightEdge, y + 4, { align: 'right' });
	y += 14;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.setTextColor(80);
	doc.text('From', PDF_MARGIN, y);
	doc.text('Pay To', PAGE_WIDTH / 2, y);
	y += 5;

	doc.setTextColor(30);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(10);
	doc.text(OWNER_STATEMENT_MANAGER, PDF_MARGIN, y);
	doc.text(invoice.payee || '—', PAGE_WIDTH / 2, y);
	y += 5;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.text(MANAGEMENT_COMPANY_NAME, PDF_MARGIN, y);
	y += 4;
	doc.text(OWNER_STATEMENT_MANAGER_ADDRESS.line1, PDF_MARGIN, y);
	y += 4;
	doc.text(OWNER_STATEMENT_MANAGER_ADDRESS.line2, PDF_MARGIN, y);

	y += 8;
	doc.setTextColor(80);
	const checkout = formatDateOrDash(invoice.checkout_date);
	doc.text(`Property: ${invoice.property_name || '—'}`, PDF_MARGIN, y);
	y += 4;
	doc.text(`Guest: ${invoice.guest_name || '—'}`, PDF_MARGIN, y);
	y += 4;
	doc.text(`Reservation: ${invoice.reservation_id || '—'}`, PDF_MARGIN, y);
	y += 4;
	doc.text(`Checkout: ${checkout}`, PDF_MARGIN, y);
	y += 4;
	if (invoice.description) {
		const descLines = doc.splitTextToSize(`Task: ${invoice.description}`, PAGE_WIDTH - PDF_MARGIN * 2);
		doc.text(descLines, PDF_MARGIN, y);
		y += descLines.length * 4;
	}

	y += 4;
	const body = [
		['Base cleaning fee', fmtAmount(invoice.base_amount)],
	];
	if (Number(invoice.additional_amount) > 0) {
		const detail = invoice.additional_description?.trim();
		body.push([
			detail ? `Additional charge — ${detail}` : 'Additional charge',
			fmtAmount(invoice.additional_amount),
		]);
	}
	body.push(['Total due', fmtAmount(invoice.amount)]);

	autoTable(doc, {
		startY: y,
		head: [['Description', 'Amount']],
		body,
		theme: 'grid',
		headStyles: { fillColor: [249, 250, 251], textColor: [30, 30, 30], fontStyle: 'bold' },
		styles: { fontSize: 9, cellPadding: 2.5 },
		columnStyles: {
			0: { cellWidth: 120 },
			1: { halign: 'right', cellWidth: 40 },
		},
		margin: { left: PDF_MARGIN, right: PDF_MARGIN },
	});

	y = (doc.lastAutoTable?.finalY || y) + 8;
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(11);
	doc.setTextColor(30);
	doc.text('Total Due', rightEdge - 40, y);
	doc.text(fmtAmount(invoice.amount), rightEdge, y, { align: 'right' });

	return doc.output('arraybuffer');
}
