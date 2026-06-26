import { readFileSync } from 'fs';
import { join } from 'path';
import {
	MANAGEMENT_COMPANY_NAME,
	OWNER_STATEMENT_MANAGER,
	OWNER_STATEMENT_MANAGER_ADDRESS,
	formatPropertyAddressTwoLines,
} from './ownerStatementReport.js';
import { fmtSupplyPrice, lineTotal, orderTotal, pricedUnit } from './supplies.js';
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

function shortInvoiceId(orderId) {
	if (!orderId) return '—';
	return String(orderId).slice(0, 8).toUpperCase();
}

export function supplyInvoicePdfFilename(order) {
	const property = (order?.property_name || 'property').replace(/[^\w.-]+/g, '-');
	const date = (order?.submitted_at || order?.created_at || '').slice(0, 10) || 'invoice';
	return `supply-invoice-${property}-${date}.pdf`;
}

/** Build a portrait supply invoice PDF (server-side). */
export async function buildSupplyInvoicePdfBytes(order, { property } = {}) {
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
	doc.text('INVOICE', rightEdge, y + 4, { align: 'right' });
	y += 14;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.setTextColor(80);
	doc.text('From', PDF_MARGIN, y);
	doc.text('Bill To', PAGE_WIDTH / 2, y);
	y += 5;

	doc.setTextColor(30);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(10);
	doc.text(OWNER_STATEMENT_MANAGER, PDF_MARGIN, y);
	doc.text(order.property_name || property?.name || '—', PAGE_WIDTH / 2, y);
	y += 5;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.text(MANAGEMENT_COMPANY_NAME, PDF_MARGIN, y);
	y += 4;
	doc.text(OWNER_STATEMENT_MANAGER_ADDRESS.line1, PDF_MARGIN, y);
	y += 4;
	doc.text(OWNER_STATEMENT_MANAGER_ADDRESS.line2, PDF_MARGIN, y);

	const billToAddress = formatPropertyAddressTwoLines(property);
	let billY = y - 13;
	if (billToAddress.line1) {
		doc.text(billToAddress.line1, PAGE_WIDTH / 2, billY);
		billY += 4;
	}
	if (billToAddress.line2) {
		doc.text(billToAddress.line2, PAGE_WIDTH / 2, billY);
	}

	y += 8;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.setTextColor(80);
	const invoiceDate = formatDateOrDash((order.submitted_at || order.created_at || '').slice(0, 10));
	doc.text(`Invoice #: ${shortInvoiceId(order.id)}`, PDF_MARGIN, y);
	doc.text(`Date: ${invoiceDate}`, rightEdge, y, { align: 'right' });
	y += 5;
	if (order.location) {
		doc.text(`Deliver to: ${order.location}`, PDF_MARGIN, y);
		y += 5;
	}
	if (order.notes) {
		const noteLines = doc.splitTextToSize(`Notes: ${order.notes}`, PAGE_WIDTH - PDF_MARGIN * 2);
		doc.text(noteLines, PDF_MARGIN, y);
		y += noteLines.length * 4 + 2;
	}

	y += 2;
	const markupPercent = order.markup_percent ?? 0;
	const items = order.items || [];
	const body = items.map((item) => {
		const title = item.product?.title || 'Item';
		const qty = Number(item.quantity) || 0;
		const unit = pricedUnit(Number(item.unit_price) || 0, markupPercent);
		const total = lineTotal(item.unit_price, item.sales_tax_percent, qty, markupPercent);
		return [title, String(qty), fmtSupplyPrice(unit), fmtSupplyPrice(total)];
	});

	autoTable(doc, {
		startY: y,
		head: [['Item', 'Qty', 'Unit Price', 'Total']],
		body,
		theme: 'grid',
		headStyles: { fillColor: [249, 250, 251], textColor: [30, 30, 30], fontStyle: 'bold' },
		styles: { fontSize: 9, cellPadding: 2.5 },
		columnStyles: {
			0: { cellWidth: 90 },
			1: { halign: 'center', cellWidth: 18 },
			2: { halign: 'right', cellWidth: 32 },
			3: { halign: 'right', cellWidth: 32 },
		},
		margin: { left: PDF_MARGIN, right: PDF_MARGIN },
	});

	y = (doc.lastAutoTable?.finalY || y) + 8;
	const total = orderTotal(items, markupPercent);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(11);
	doc.setTextColor(30);
	doc.text('Total Due', rightEdge - 40, y);
	doc.text(fmtSupplyPrice(total), rightEdge, y, { align: 'right' });

	return doc.output('arraybuffer');
}