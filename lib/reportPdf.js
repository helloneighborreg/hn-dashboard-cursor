import { formatDateOrDash } from './dates';
import { categoryLabel } from './bookkeepingCategories';
import { reportById } from './reportDefinitions';
import { OWNER_STATEMENT_MANAGER, OWNER_STATEMENT_MANAGER_ADDRESS, OWNER_STATEMENT_HN_TOTAL_LABEL, OWNER_STATEMENT_MANAGEMENT_FEE_NOTE, formatAddressTwoLines, ownerStatementPdfFilename, statementAdjustmentsTotal } from './ownerStatementReport';

const PDF_MARGIN = 10;
const PDF_LANDSCAPE_WIDTH = 297;
const PDF_LANDSCAPE_HEIGHT = 210;
const SUMMARY_COLUMN_WIDTH = 74;
const STATEMENT_NOTES = [
	OWNER_STATEMENT_MANAGEMENT_FEE_NOTE,
];

let logoDataUrlPromise = null;
let logoHorizontalDataUrlPromise = null;

function loadImageDataUrl(path) {
	if (typeof window === 'undefined') return Promise.resolve(null);
	return fetch(path)
		.then((res) => (res.ok ? res.blob() : null))
		.then((blob) => {
			if (!blob) return null;
			return new Promise((resolve) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result);
				reader.onerror = () => resolve(null);
				reader.readAsDataURL(blob);
			});
		})
		.catch(() => null);
}

function loadLogoDataUrl() {
	if (!logoDataUrlPromise) {
		logoDataUrlPromise = loadImageDataUrl('/logo-pdf-icon.png');
	}
	return logoDataUrlPromise;
}

function loadHorizontalLogoDataUrl() {
	if (!logoHorizontalDataUrlPromise) {
		logoHorizontalDataUrlPromise = loadImageDataUrl('/logo-pdf.png');
	}
	return logoHorizontalDataUrlPromise;
}

function transactionCategoryLabel(row) {
	if (row.category) return categoryLabel(row.category);
	return '—';
}

function transactionNotesLabel(row) {
	if (row.source === 'manual') return row.notes?.trim() || '—';
	return 'Bank transaction';
}

function drawStatementSectionLabel(doc, text, y) {
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7);
	doc.setTextColor(120);
	doc.text(text, PDF_MARGIN, y);
	return y + 4;
}

const STATEMENT_TABLE_STYLES = {
	fontSize: 6.5,
	cellPadding: 1,
	overflow: 'linebreak',
	lineColor: [220, 220, 220],
	lineWidth: 0.1,
};

const STATEMENT_TABLE_HEAD_STYLES = {
	fillColor: [245, 245, 245],
	textColor: [30, 30, 30],
	fontStyle: 'bold',
	fontSize: 6,
	overflow: 'hidden',
	cellPadding: 0.8,
};

const RESERVATION_COLUMN_STYLES = {
	0: { cellWidth: 20, halign: 'left' },
	1: { cellWidth: 17, halign: 'left' },
	2: { cellWidth: 13, halign: 'left' },
	3: { cellWidth: 15, halign: 'left' },
	4: { cellWidth: 9, halign: 'center' },
	5: { halign: 'right' },
	6: { halign: 'right' },
	7: { halign: 'right' },
	8: { halign: 'right' },
	9: { halign: 'right' },
};

function additionalTransactionColumnStyles(tableWidth) {
	const amountWidth = 26;
	const notesWidth = tableWidth - 20 - 34 - 34 - amountWidth;
	return {
		0: { cellWidth: 20, halign: 'left' },
		1: { cellWidth: 34, halign: 'left' },
		2: { cellWidth: 34, halign: 'left' },
		3: { cellWidth: notesWidth, halign: 'left' },
		4: { cellWidth: amountWidth, halign: 'right' },
	};
}

function adjustmentColumnStyles(tableWidth) {
	const amountWidth = 26;
	const reasonWidth = tableWidth - 20 - 26 - 20 - 26 - amountWidth;
	return {
		0: { cellWidth: 20, halign: 'left' },
		1: { cellWidth: 26, halign: 'left' },
		2: { cellWidth: 20, halign: 'left' },
		3: { cellWidth: 26, halign: 'left' },
		4: { cellWidth: reasonWidth, halign: 'left' },
		5: { cellWidth: amountWidth, halign: 'right' },
	};
}

function statementSummaryColumnX(pageWidth) {
	return pageWidth - PDF_MARGIN - SUMMARY_COLUMN_WIDTH;
}

function leftColumnWidth(contentWidth) {
	return contentWidth - SUMMARY_COLUMN_WIDTH - 6;
}

function ensureStatementPageSpace(doc, y, neededHeight) {
	if (y + neededHeight > PDF_LANDSCAPE_HEIGHT - PDF_MARGIN) {
		doc.addPage('a4', 'landscape');
		return PDF_MARGIN;
	}
	return y;
}

function drawStatementSummaryBar(doc, { y, label, amount, x, width }) {
	const barHeight = 7;
	doc.setFillColor(30, 30, 30);
	doc.rect(x, y, width, barHeight, 'F');
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8.5);
	doc.setTextColor(255, 255, 255);
	doc.text(label, x + 2.5, y + 4.8);
	doc.text(amount, x + width - 2.5, y + 4.8, { align: 'right' });
	return y + barHeight + 2;
}

function drawStatementSummary(doc, {
	startY,
	statement,
	pageWidth,
	contentWidth,
}) {
	const summaryX = statementSummaryColumnX(pageWidth);
	const summaryWidth = SUMMARY_COLUMN_WIDTH;
	const dueToOwnerLabel = statement.recipient?.name
		? `Due to ${statement.recipient.name}`
		: 'Due to Owner';
	const dueToHnItems = [
		['Management Fee', statement.totals?.reservation_commissions_to_manager],
		['Cleaning Fee', statement.totals?.total_cleaning_fee],
		['Adjustments', statementAdjustmentsTotal(statement.totals)],
	];

	let summaryY = startY;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(7.5);
	doc.setTextColor(30);
	doc.text('Net Booking Revenue', summaryX, summaryY);
	doc.text(fmtStatement$(statement.totals?.total_net_revenue), summaryX + summaryWidth, summaryY, { align: 'right' });
	summaryY += 3.8;

	for (const [label, amount] of dueToHnItems) {
		doc.text(label, summaryX, summaryY);
		doc.text(fmtStatement$(amount), summaryX + summaryWidth, summaryY, { align: 'right' });
		summaryY += 3.8;
	}

	summaryY += 2;
	summaryY = drawStatementSummaryBar(doc, {
		y: summaryY,
		label: OWNER_STATEMENT_HN_TOTAL_LABEL,
		amount: fmtStatement$(statement.totals?.total_due_to_hn_global),
		x: summaryX,
		width: summaryWidth,
	});
	summaryY = drawStatementSummaryBar(doc, {
		y: summaryY,
		label: dueToOwnerLabel,
		amount: fmtStatement$(statement.totals?.total_due_to_owner),
		x: summaryX,
		width: summaryWidth,
	});
	return summaryY;
}

function fmtReport$(n) {
	if (n == null || n === '') return '$0.00';
	const val = Number(n) || 0;
	const formatted = Math.abs(val).toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	if (val === 0) return '$0.00';
	return val < 0 ? `($${formatted})` : `$${formatted}`;
}

function resolveAddressLines(line1, line2, fallbackAddress) {
	if (line1 || line2) return { line1: line1 || '', line2: line2 || '' };
	return formatAddressTwoLines(fallbackAddress);
}

function fmtStatement$(n) {
	if (n == null || n === '') return '$0.00';
	const val = Number(n) || 0;
	const formatted = Math.abs(val).toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	if (val === 0) return '$0.00';
	return val < 0 ? `-$${formatted}` : `$${formatted}`;
}

function pdfFilename(data) {
	if (data.report === 'owner-statements' && data.statements?.length === 1) {
		return ownerStatementPdfFilename(data.statements[0]);
	}
	const from = data.filters?.date_from || 'report';
	const to = data.filters?.date_to || '';
	return `${data.report || 'report'}-${from}${to ? `-${to}` : ''}.pdf`;
}

function reportTitle(data) {
	if (data.title) return data.title;
	return reportById(data.report).label;
}

function addHeader(doc, data, startY = 14) {
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(14);
	doc.text(reportTitle(data), 14, startY);
	let y = startY + 6;
	if (data.subtitle) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(10);
		doc.text(data.subtitle, 14, y);
		y += 4;
	}
	if (data.note) {
		doc.setFontSize(9);
		doc.setTextColor(100);
		const lines = doc.splitTextToSize(data.note, 180);
		doc.text(lines, 14, y);
		y += lines.length * 4;
		doc.setTextColor(0);
	}
	return y + 4;
}

function incomeStatementPdf(doc, autoTable, data) {
	const y = addHeader(doc, data);
	const head = [['', ...data.periods.map((p) => p.label), 'Total']];
	const body = [];

	for (const row of data.rows || []) {
		if (row.type === 'section') {
			body.push([{ content: row.label, colSpan: head[0].length, styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } }]);
			continue;
		}
		if (row.type === 'subsection') {
			body.push([{ content: row.label, colSpan: head[0].length, styles: { fontStyle: 'bold' } }]);
			continue;
		}
		const values = row.values || {};
		const indent = row.indent ? '  '.repeat(row.indent) : '';
		const fillColor = row.style === 'noi' ? [219, 234, 254]
			: row.style === 'net_cash_flow' ? [220, 252, 231]
				: row.style === 'uncategorized' ? [254, 226, 226]
					: row.style === 'section_total' ? [229, 231, 235]
						: row.style === 'subtotal' ? [249, 250, 251]
							: null;
		body.push([
			{ content: `${indent}${row.label}`, styles: fillColor ? { fillColor, fontStyle: row.style?.includes('total') || row.type === 'highlight' ? 'bold' : 'normal' } : {} },
			...data.periods.map((p) => ({ content: fmtReport$(values[p.key]), styles: { halign: 'right', ...(fillColor ? { fillColor } : {}) } })),
			{ content: fmtReport$(values.total), styles: { halign: 'right', fontStyle: 'bold', ...(fillColor ? { fillColor } : {}) } },
		]);
	}

	autoTable(doc, {
		startY: y,
		head,
		body,
		styles: { fontSize: 8, cellPadding: 2 },
		headStyles: { fillColor: [249, 250, 251], textColor: [30, 30, 30], fontStyle: 'bold' },
		margin: { left: 14, right: 14 },
	});
}

function ownerStatementsPdf(doc, autoTable, data, logoHorizontalDataUrl) {
	const statements = data.statements?.length
		? data.statements
		: [{
			property_name: data.title || 'Owner Statement',
			property_address: '',
			recipient: { name: '', address: '' },
			statement_period: data.statement_period || data.subtitle || 'Statement',
			reservations: data.reservations || [],
			transactions: [],
			adjustments: [],
			totals: {
				total_reservation_income: data.summary?.total_revenue || 0,
				reservation_commissions_to_manager: 0,
				total_owed_to_manager: data.summary?.total_paid_to_manager || 0,
				total_net_reservation_income_to_owner: data.summary?.total_revenue || 0,
				total_due_to_owner: data.summary?.total_due_to_owner || data.summary?.total_revenue || 0,
			},
		}];

	statements.forEach((statement, index) => {
		if (index > 0) doc.addPage('a4', 'landscape');
		renderOwnerStatementPage(doc, autoTable, statement, {
			managerName: data.manager?.name || OWNER_STATEMENT_MANAGER,
			logoHorizontalDataUrl,
		});
	});
}

function renderOwnerStatementPage(doc, autoTable, statement, { managerName, logoHorizontalDataUrl }) {
	const pageWidth = PDF_LANDSCAPE_WIDTH;
	const contentWidth = pageWidth - PDF_MARGIN * 2;
	const leftWidth = leftColumnWidth(contentWidth);
	let y = PDF_MARGIN;
	const logoWidth = 50;
	const logoHeight = 8;
	const logoX = pageWidth - PDF_MARGIN - logoWidth;
	const rightEdge = pageWidth - PDF_MARGIN;

	if (logoHorizontalDataUrl) {
		try {
			doc.addImage(logoHorizontalDataUrl, 'PNG', logoX, y, logoWidth, logoHeight);
		} catch {
			// ignore logo failures
		}
	}

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(10);
	doc.setTextColor(30);
	doc.text(statement.property_name || '', PDF_MARGIN, y);
	y += 4;

	let propertyBlockBottom = y;
	if (statement.property_address_line1 || statement.property_address_line2 || statement.property_address) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(7.5);
		doc.setTextColor(80);
		const propertyAddress = resolveAddressLines(
			statement.property_address_line1,
			statement.property_address_line2,
			statement.property_address,
		);
		if (propertyAddress.line1) {
			doc.text(propertyAddress.line1, PDF_MARGIN, y);
			y += 3.2;
		}
		if (propertyAddress.line2) {
			doc.text(propertyAddress.line2, PDF_MARGIN, y);
			y += 3.2;
		}
		propertyBlockBottom = y;
	}

	const businessTop = PDF_MARGIN + logoHeight + 1;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(7.5);
	doc.setTextColor(30);
	doc.text(managerName, rightEdge, businessTop, { align: 'right' });
	doc.setFontSize(7);
	doc.setTextColor(80);
	doc.text(OWNER_STATEMENT_MANAGER_ADDRESS.line1, rightEdge, businessTop + 3.5, { align: 'right' });
	doc.text(OWNER_STATEMENT_MANAGER_ADDRESS.line2, rightEdge, businessTop + 6.5, { align: 'right' });

	y = Math.max(propertyBlockBottom, businessTop + 10) + 3;

	doc.setDrawColor(220);
	doc.line(PDF_MARGIN, y, pageWidth - PDF_MARGIN, y);
	y += 4;

	const recipientName = statement.recipient?.name || '';
	const recipientAddress = resolveAddressLines(
		statement.recipient?.address_line1,
		statement.recipient?.address_line2,
		statement.recipient?.address,
	);
	const periodLabel = statement.statement_period || 'Statement';

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7);
	doc.setTextColor(120);
	doc.text('TO', PDF_MARGIN, y);
	doc.text('REPORTING PERIOD', PDF_MARGIN + leftWidth * 0.55, y);
	y += 3.5;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.setTextColor(30);
	doc.text(recipientName || '—', PDF_MARGIN, y);
	doc.text(periodLabel, PDF_MARGIN + leftWidth * 0.55, y);
	y += 3.8;

	if (recipientAddress.line1 || recipientAddress.line2) {
		doc.setFontSize(7);
		doc.setTextColor(80);
		if (recipientAddress.line1) {
			doc.text(recipientAddress.line1, PDF_MARGIN, y);
			y += 3.2;
		}
		if (recipientAddress.line2) {
			doc.text(recipientAddress.line2, PDF_MARGIN, y);
			y += 3.2;
		}
	}

	y += 3;
	y = drawStatementSectionLabel(doc, 'RESERVATIONS', y);

	const reservations = statement.reservations || [];
	const reservationBody = reservations.map((row) => [
		row.code || '—',
		row.guest_name || '—',
		row.platform_label || row.platform || '—',
		row.date_range || formatDateOrDash(row.check_in),
		String(row.nights || '—'),
		fmtStatement$(row.gross_booking_amount),
		fmtStatement$(row.guest_service_fee),
		fmtStatement$(row.reservation_commissions),
		fmtStatement$(row.cleaning_fee),
		fmtStatement$(row.booking_net_revenue),
	]);

	if (reservations.length) {
		const totals = statement.totals || {};
		reservationBody.push([
			{ content: '', colSpan: 4, styles: { fontStyle: 'bold' } },
			{ content: String(totals.total_nights || 0), styles: { fontStyle: 'bold', halign: 'right' } },
			{ content: fmtStatement$(totals.total_gross_booking_amount), styles: { fontStyle: 'bold', halign: 'right' } },
			{ content: fmtStatement$(totals.total_guest_service_fee), styles: { fontStyle: 'bold', halign: 'right' } },
			{ content: fmtStatement$(totals.reservation_commissions_to_manager), styles: { fontStyle: 'bold', halign: 'right' } },
			{ content: fmtStatement$(totals.total_cleaning_fee), styles: { fontStyle: 'bold', halign: 'right' } },
			{ content: fmtStatement$(totals.total_booking_net_revenue), styles: { fontStyle: 'bold', halign: 'right' } },
		]);
	}

	autoTable(doc, {
		startY: y,
		tableWidth: contentWidth,
		head: [[
			'Reservation',
			'Guest',
			'Platform',
			'Dates',
			'Nights',
			'Gross Booking',
			'Guest Fee',
			'Mgmt Fee',
			'Cleaning',
			'Net Revenue',
		]],
		body: reservationBody.length ? reservationBody : [[
			{ content: 'No reservations for this period.', colSpan: 10, styles: { halign: 'center', textColor: [120, 120, 120] } },
		]],
		styles: STATEMENT_TABLE_STYLES,
		headStyles: STATEMENT_TABLE_HEAD_STYLES,
		columnStyles: RESERVATION_COLUMN_STYLES,
		margin: { left: PDF_MARGIN, right: PDF_MARGIN },
		showHead: 'everyPage',
	});

	y = doc.lastAutoTable.finalY + 2;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(6);
	doc.setTextColor(100);
	for (const note of STATEMENT_NOTES) {
		const lines = doc.splitTextToSize(`* ${note}`, leftWidth);
		doc.text(lines, PDF_MARGIN, y);
		y += lines.length * 2.8 + 0.5;
	}

	const summaryHeight = 48;
	let summaryAnchorY = y + 1;
	let leftY = y + 2;
	const transactions = statement.transactions || [];
	const adjustments = statement.adjustments || [];

	if (summaryAnchorY + summaryHeight > PDF_LANDSCAPE_HEIGHT - PDF_MARGIN) {
		doc.addPage('a4', 'landscape');
		summaryAnchorY = PDF_MARGIN;
		leftY = PDF_MARGIN + 4;
	}

	if (transactions.length) {
		leftY = drawStatementSectionLabel(doc, 'ADDITIONAL TRANSACTIONS', leftY);
		autoTable(doc, {
			startY: leftY,
			tableWidth: leftWidth,
			head: [['Date', 'Property', 'Category', 'Notes', 'Amount']],
			body: transactions.map((row) => [
				formatDateOrDash(row.date),
				row.property_name || '—',
				transactionCategoryLabel(row),
				transactionNotesLabel(row),
				fmtStatement$(row.amount),
			]),
			styles: STATEMENT_TABLE_STYLES,
			headStyles: STATEMENT_TABLE_HEAD_STYLES,
			columnStyles: additionalTransactionColumnStyles(leftWidth),
			margin: { left: PDF_MARGIN, right: pageWidth - PDF_MARGIN - leftWidth },
		});
		leftY = doc.lastAutoTable.finalY + 3;
	}

	if (adjustments.length) {
		leftY = drawStatementSectionLabel(doc, 'ADJUSTMENTS', leftY);
		autoTable(doc, {
			startY: leftY,
			tableWidth: leftWidth,
			head: [['Date', 'Property', 'Code', 'Guest', 'Reason', 'Amount']],
			body: adjustments.map((row) => [
				formatDateOrDash(row.date),
				row.property_name || '—',
				row.code || '—',
				row.guest_name || '—',
				row.reason || '—',
				fmtStatement$(row.amount),
			]),
			styles: STATEMENT_TABLE_STYLES,
			headStyles: STATEMENT_TABLE_HEAD_STYLES,
			columnStyles: adjustmentColumnStyles(leftWidth),
			margin: { left: PDF_MARGIN, right: pageWidth - PDF_MARGIN - leftWidth },
		});
		leftY = doc.lastAutoTable.finalY + 3;
	}

	const notesHeight = statement.notes?.trim()
		? doc.splitTextToSize(statement.notes.trim(), leftWidth).length * 2.8 + 8
		: 0;
	if (notesHeight) {
		leftY = ensureStatementPageSpace(doc, leftY, notesHeight);
	}

	const summaryBottomY = drawStatementSummary(doc, {
		startY: summaryAnchorY,
		statement,
		pageWidth,
		contentWidth,
	});
	y = Math.max(leftY, summaryBottomY);

	if (statement.notes?.trim()) {
		y = drawStatementSectionLabel(doc, 'NOTES', y);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(7);
		doc.setTextColor(80);
		const noteLines = doc.splitTextToSize(statement.notes.trim(), leftWidth);
		doc.text(noteLines, PDF_MARGIN, y);
	}
}

function balanceSheetPdf(doc, autoTable, data) {
	const y = addHeader(doc, { ...data, title: data.title || 'Balance Sheet' });
	const sections = [
		{ title: 'Assets', rows: data.assets, total: data.totals?.assets },
		{ title: 'Liabilities', rows: data.liabilities, total: data.totals?.liabilities },
		{ title: 'Equity', rows: data.equity, total: data.totals?.equity },
	];
	let startY = y;
	for (const section of sections) {
		autoTable(doc, {
			startY,
			head: [[section.title, 'Amount']],
			body: [
				...(section.rows || []).map((row) => [row.label, fmtReport$(row.amount)]),
				[{ content: `Total ${section.title}`, styles: { fontStyle: 'bold' } }, { content: fmtReport$(section.total), styles: { fontStyle: 'bold', halign: 'right' } }],
			],
			styles: { fontSize: 9, cellPadding: 2 },
			headStyles: { fillColor: [229, 231, 235], fontStyle: 'bold' },
			columnStyles: { 1: { halign: 'right' } },
			margin: { left: 14, right: 14 },
		});
		startY = doc.lastAutoTable.finalY + 8;
	}
}

function scheduleEPdf(doc, autoTable, data) {
	const y = addHeader(doc, { ...data, title: data.title || 'Schedule E' });
	autoTable(doc, {
		startY: y,
		head: [['Line', 'Category', 'Amount']],
		body: (data.lines || []).map((row) => [
			String(row.line),
			row.label,
			fmtReport$(row.amount),
		]),
		styles: { fontSize: 9, cellPadding: 2 },
		headStyles: { fillColor: [249, 250, 251], fontStyle: 'bold' },
		columnStyles: { 2: { halign: 'right' } },
		margin: { left: 14, right: 14 },
	});
}

/** Build a landscape owner-statement PDF in the browser (one or more property statements). */
export async function buildOwnerStatementPdfBytes(statements, manager) {
	if (typeof window === 'undefined') {
		throw new Error('Owner statement PDF generation is only available in the browser.');
	}
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable'),
	]);
	const doc = new jsPDF({
		orientation: 'landscape',
		unit: 'mm',
		format: 'a4',
	});
	const logoHorizontalDataUrl = await loadHorizontalLogoDataUrl();
	ownerStatementsPdf(doc, autoTable, {
		report: 'owner-statements',
		statements,
		manager: manager || { name: OWNER_STATEMENT_MANAGER },
	}, logoHorizontalDataUrl);
	return doc.output('arraybuffer');
}

export async function buildOwnerStatementPdfBase64(statements, manager) {
	const bytes = await buildOwnerStatementPdfBytes(statements, manager);
	const arr = new Uint8Array(bytes);
	let binary = '';
	for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
	return btoa(binary);
}

export async function downloadReportPdf(data) {
	if (!data || typeof window === 'undefined') return;

	const [{ jsPDF }, { default: autoTable }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable'),
	]);

	const ownerStatement = data.report === 'owner-statements';
	const landscape = ownerStatement
		|| (['net-cash-flow', 'noi', 'inflow-outflow'].includes(data.report)
			&& (data.periods?.length || 0) > 4);

	const doc = new jsPDF({
		orientation: landscape ? 'landscape' : 'portrait',
		unit: 'mm',
		format: 'a4',
	});

	const logoHorizontalDataUrl = ownerStatement ? await loadHorizontalLogoDataUrl() : null;

	switch (data.report) {
		case 'net-cash-flow':
		case 'noi':
		case 'inflow-outflow':
			incomeStatementPdf(doc, autoTable, data);
			break;
		case 'owner-statements':
			ownerStatementsPdf(doc, autoTable, data, logoHorizontalDataUrl);
			break;
		case 'balance-sheet':
			balanceSheetPdf(doc, autoTable, data);
			break;
		case 'schedule-e':
			scheduleEPdf(doc, autoTable, data);
			break;
		default:
			addHeader(doc, data);
			break;
	}

	doc.save(pdfFilename(data));
}

export function downloadReportCsv(data) {
	if (!data || typeof window === 'undefined') return;

	let lines = [];

	if (['net-cash-flow', 'noi', 'inflow-outflow'].includes(data.report) && data.periods?.length) {
		lines.push(['', ...data.periods.map((p) => p.label), 'Total']);
		for (const row of data.rows || []) {
			if (row.type === 'section' || row.type === 'subsection') {
				lines.push([row.label]);
				continue;
			}
			const values = row.values || {};
			lines.push([
				row.label,
				...data.periods.map((p) => fmtReport$(values[p.key])),
				fmtReport$(values.total),
			]);
		}
	} else if (data.report === 'owner-statements') {
		lines.push(['Property', 'Guest', 'Check-in', 'Check-out', 'Revenue', 'Paid to manager', 'Remaining due']);
		for (const row of (data.reservations || []).filter((r) => r.included_on_statement)) {
			lines.push([
				row.property_name,
				row.guest_name || row.code,
				formatDateOrDash(row.check_in),
				formatDateOrDash(row.check_out),
				fmtReport$(row.revenue),
				fmtReport$(row.total_paid_to_manager),
				fmtReport$(row.remaining_balance_due),
			]);
		}
	} else if (data.report === 'schedule-e') {
		lines.push(['Line', 'Category', 'Amount']);
		for (const row of data.lines || []) {
			lines.push([row.line, row.label, fmtReport$(row.amount)]);
		}
	} else if (data.report === 'balance-sheet') {
		for (const section of [
			{ title: 'Assets', rows: data.assets, total: data.totals?.assets },
			{ title: 'Liabilities', rows: data.liabilities, total: data.totals?.liabilities },
			{ title: 'Equity', rows: data.equity, total: data.totals?.equity },
		]) {
			lines.push([section.title, 'Amount']);
			for (const row of section.rows || []) {
				lines.push([row.label, fmtReport$(row.amount)]);
			}
			lines.push([`Total ${section.title}`, fmtReport$(section.total)]);
			lines.push([]);
		}
	}

	const csv = lines.map((row) => row.map((cell) => {
		const s = String(cell ?? '');
		return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
	}).join(',')).join('\n');

	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = pdfFilename(data).replace('.pdf', '.csv');
	link.click();
	URL.revokeObjectURL(url);
}
