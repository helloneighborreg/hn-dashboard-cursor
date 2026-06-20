import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { downloadReportCsv, downloadReportPdf } from '../../lib/reportPdf';

export default function ReportExportBar({ data, title, subtitle }) {
	const [exporting, setExporting] = useState(false);

	if (!data) return null;

	const header = {
		...data,
		title: title || data.title,
		subtitle: subtitle || data.subtitle,
	};

	async function handlePdf() {
		setExporting(true);
		try {
			await downloadReportPdf(header);
		} catch (err) {
			console.error('PDF export failed:', err);
			alert('PDF export failed. Please try again.');
		} finally {
			setExporting(false);
		}
	}

	function handleCsv() {
		try {
			downloadReportCsv(header);
		} catch (err) {
			console.error('CSV export failed:', err);
			alert('CSV export failed. Please try again.');
		}
	}

	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between px-5 pt-5 pb-3 border-b border-border">
			<div>
				{header.title && (
					<h2 className="text-lg font-bold text-dark">{header.title}</h2>
				)}
				{header.subtitle && (
					<p className="text-sm text-muted mt-0.5">{header.subtitle}</p>
				)}
			</div>
			<div className="flex flex-wrap gap-2 self-start">
				<button
					type="button"
					onClick={handlePdf}
					disabled={exporting}
					className="btn-primary text-xs gap-1.5 justify-center"
				>
					<FileText size={14} />
					{exporting ? 'Generating…' : 'Download PDF'}
				</button>
				<button
					type="button"
					onClick={handleCsv}
					className="btn-secondary text-xs gap-1.5 justify-center"
				>
					<Download size={14} />
					Download CSV
				</button>
			</div>
		</div>
	);
}
