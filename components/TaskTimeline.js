import clsx from 'clsx';
import { buildTaskHistoryEntries, formatTaskHistoryTimestamp } from '../lib/taskHistory';

export default function TaskTimeline({ task, className }) {
	const entries = buildTaskHistoryEntries(task);
	if (!entries.length) return null;

	return (
		<div className={className}>
			<p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">History</p>
			<ol className="relative border-l border-border ml-1.5 space-y-4">
				{entries.map((entry, index) => {
					const isLast = index === entries.length - 1;
					return (
						<li key={entry.key} className="relative pl-5">
							<span
								className={clsx(
									'absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white',
									isLast ? 'bg-primary' : 'bg-gray-300',
								)}
								aria-hidden
							/>
							<p className="text-sm font-medium text-dark leading-snug">{entry.label}</p>
							<p className="text-xs text-muted mt-0.5">{formatTaskHistoryTimestamp(entry.at)}</p>
							{entry.detail && (
								<p className="text-xs text-muted mt-0.5">{entry.detail}</p>
							)}
						</li>
					);
				})}
			</ol>
		</div>
	);
}
