import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { fetchJson } from '../lib/apiClient';
import ExpenseModal from './ExpenseModal';
import { useAuth } from './AuthContext';

export default function PageActionButtons({
	onRefresh,
	refreshing = false,
	expenseTitle = 'New Transaction',
}) {
	const { isAdmin } = useAuth();
	const [properties, setProperties] = useState([]);
	const [propertiesLoading, setPropertiesLoading] = useState(false);
	const [showExpenseModal, setShowExpenseModal] = useState(false);

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

	async function openExpenseModal() {
		await ensureProperties();
		setShowExpenseModal(true);
	}

	function handleExpenseSaved() {
		setShowExpenseModal(false);
		onRefresh?.();
	}

	if (!isAdmin && !onRefresh) return null;

	return (
		<>
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
					<button
						type="button"
						onClick={openExpenseModal}
						className="btn-primary text-xs gap-1.5 justify-center"
					>
						<Plus size={14} />
						New Transaction
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
