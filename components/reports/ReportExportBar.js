import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { downloadReportCsv, downloadReportPdf } from '../../lib/reportPdf';

export default function ReportExportBar({ data, title, subtitle, hideExport = false }) {
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
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-2.5 border-b border-border">
			<div className="min-w-0">
				{header.title && (
					<h2 className="text-base font-bold text-dark leading-tight">{header.title}</h2>
				)}
				{header.subtitle && (
					<p className="text-xs text-muted mt-0.5 truncate">{header.subtitle}</p>
				)}
			</div>
			{!hideExport && (
				<div className="flex flex-wrap gap-1.5 self-start shrink-0">
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
			)}
		</div>
	);
}
