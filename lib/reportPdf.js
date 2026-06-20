import { formatDateOrDash } from './dates';
import { reportById } from './reportDefinitions';

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

function pdfFilename(data) {
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

function ownerStatementsPdf(doc, autoTable, data) {
	const y = addHeader(doc, { ...data, title: data.title || 'Owner Statements' });
	autoTable(doc, {
		startY: y,
		head: [['Property', 'Guest', 'Check-in', 'Check-out', 'Revenue', 'Paid to manager', 'Remaining due']],
		body: (data.reservations || []).map((row) => [
			row.property_name,
			row.guest_name || row.code,
			formatDateOrDash(row.check_in),
			formatDateOrDash(row.check_out),
			fmtReport$(row.revenue),
			fmtReport$(row.total_paid_to_manager),
			fmtReport$(row.remaining_balance_due),
		]),
		styles: { fontSize: 8, cellPadding: 2 },
		headStyles: { fillColor: [249, 250, 251], fontStyle: 'bold' },
		columnStyles: {
			4: { halign: 'right' },
			5: { halign: 'right' },
			6: { halign: 'right' },
		},
		margin: { left: 14, right: 14 },
	});
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

export async function downloadReportPdf(data) {
	if (!data || typeof window === 'undefined') return;

	const [{ jsPDF }, { default: autoTable }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable'),
	]);

	const landscape = ['net-cash-flow', 'noi', 'inflow-outflow'].includes(data.report)
		&& (data.periods?.length || 0) > 4;

	const doc = new jsPDF({
		orientation: landscape ? 'landscape' : 'portrait',
		unit: 'mm',
		format: 'a4',
	});

	switch (data.report) {
		case 'net-cash-flow':
		case 'noi':
		case 'inflow-outflow':
			incomeStatementPdf(doc, autoTable, data);
			break;
		case 'owner-statements':
			ownerStatementsPdf(doc, autoTable, data);
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
		for (const row of data.reservations || []) {
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
