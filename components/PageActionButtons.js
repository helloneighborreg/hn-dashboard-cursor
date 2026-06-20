import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { fetchJson } from '../lib/apiClient';
import { formatSyncResultAlert } from '../lib/syncResultMessage';
import TaskModal from './TaskModal';
import ExpenseModal from './ExpenseModal';
import { useAuth } from './AuthContext';

export default function PageActionButtons({
	onRefresh,
	onSynced,
	showSync = false,
	refreshing = false,
	syncLabel = 'Sync from Reservations',
	expenseTitle = 'New Transaction',
}) {
	const { isAdmin } = useAuth();
	const [properties, setProperties] = useState([]);
	const [propertiesLoading, setPropertiesLoading] = useState(false);
	const [showTaskModal, setShowTaskModal] = useState(false);
	const [showExpenseModal, setShowExpenseModal] = useState(false);
	const [syncing, setSyncing] = useState(false);

	async function ensureProperties() {
		if (properties.length || propertiesLoading) return properties;
		setPropertiesLoading(true);
		try {
			const json = await fetchJson('/api/properties');
			const list = json?.data || [];
			setProperties(list);
			return list;
		} catch {
			return [];
		} finally {
			setPropertiesLoading(false);
		}
	}

	async function openTaskModal() {
		await ensureProperties();
		setShowTaskModal(true);
	}

	async function openExpenseModal() {
		await ensureProperties();
		setShowExpenseModal(true);
	}

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

	function handleTaskSaved() {
		setShowTaskModal(false);
		onSynced?.();
		onRefresh?.();
	}

	function handleExpenseSaved() {
		setShowExpenseModal(false);
		onRefresh?.();
	}

	if (!isAdmin && !onRefresh) return null;

	return (
		<>
			{showTaskModal && (
				<TaskModal
					properties={properties}
					onClose={() => setShowTaskModal(false)}
					onSaved={handleTaskSaved}
				/>
			)}
			{showExpenseModal && (
				<ExpenseModal
					properties={properties}
					title={expenseTitle}
					onClose={() => setShowExpenseModal(false)}
					onSaved={handleExpenseSaved}
				/>
			)}
			<div className="flex flex-wrap items-center gap-2 justify-end">
				{isAdmin && (
					<>
						<button
							type="button"
							onClick={openTaskModal}
							className="btn-primary text-xs gap-1.5 justify-center"
						>
							<Plus size={14} />
							New Task
						</button>
						<button
							type="button"
							onClick={openExpenseModal}
							className="btn-primary text-xs gap-1.5 justify-center"
						>
							<Plus size={14} />
							New Transaction
						</button>
					</>
				)}
				{isAdmin && showSync && (
					<button
						type="button"
						onClick={syncTasks}
						disabled={syncing}
						className="btn-secondary text-xs gap-1.5 justify-center"
					>
						<RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
						{syncing ? 'Syncing…' : syncLabel}
					</button>
				)}
				{onRefresh && (
					<button
						type="button"
						onClick={onRefresh}
						disabled={refreshing}
						className="btn-secondary text-xs gap-1.5 justify-center"
					>
						<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
						{refreshing ? 'Refreshing…' : 'Refresh'}
					</button>
				)}
			</div>
		</>
	);
}
