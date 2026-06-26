import { RefreshCw } from 'lucide-react';

/** Page-level refresh control — sync lives in AppActionBar. */
export default function PageActionButtons({
	onRefresh,
	refreshing = false,
}) {
	if (!onRefresh) return null;

	return (
		<button
			type="button"
			onClick={onRefresh}
			disabled={refreshing}
			className="btn-secondary text-xs gap-1.5 justify-center"
		>
			<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
			{refreshing ? 'Refreshing…' : 'Refresh'}
		</button>
	);
}
