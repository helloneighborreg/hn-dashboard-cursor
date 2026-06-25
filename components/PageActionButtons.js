import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchJson } from '../lib/apiClient';
import { formatSyncResultAlert } from '../lib/syncResultMessage';
import { useAuth } from './AuthContext';

/** Page-level sync control — global create/search actions live in AppActionBar. */
export default function PageActionButtons({
	onRefresh,
	onSynced,
	showSync = false,
	refreshing = false,
	syncLabel = 'Sync from Reservations',
}) {
	const { isAdmin } = useAuth();
	const [syncing, setSyncing] = useState(false);

	async function syncTasks() {
		setSyncing(true);
		try {
			const json = await fetchJson('/api/tasks/sync', { method: 'POST' });
			if (json) alert(formatSyncResultAlert(json));
			onSynced?.();
			onRefresh?.();
		} catch (err) {
			alert('Sync failed: ' + err.message);
		} finally {
			setSyncing(false);
		}
	}

	const busy = syncing || refreshing;

	if (showSync && isAdmin) {
		return (
			<button
				type="button"
				onClick={syncTasks}
				disabled={busy}
				className="btn-secondary text-xs gap-1.5 justify-center"
			>
				<RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
				{syncing ? 'Syncing…' : refreshing ? 'Refreshing…' : syncLabel}
			</button>
		);
	}

	if (onRefresh) {
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

	return null;
}
