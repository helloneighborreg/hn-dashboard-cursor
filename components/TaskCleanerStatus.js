import Badge from './Badge';
import { getCleanerTaskStatusMessage } from '../lib/constants';

/** Cleaner-facing status badge + hint for submitted/approved tasks. */
export default function TaskCleanerStatus({ task, className = '' }) {
	const message = getCleanerTaskStatusMessage(task);
	if (!message) return null;

	return (
		<div className={className}>
			<Badge label={message.label} variant={message.variant} />
			<p className="text-xs text-muted mt-1">{message.hint}</p>
		</div>
	);
}
