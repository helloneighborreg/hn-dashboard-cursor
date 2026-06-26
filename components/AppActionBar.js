import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { format } from 'date-fns';
import {
	Plus,
	FileBarChart,
	ShoppingCart,
	CheckSquare,
	DollarSign,
	ChevronDown,
	RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import { fetchJson } from '../lib/apiClient';
import { formatSyncResultAlert } from '../lib/syncResultMessage';
import TaskModal from './TaskModal';
import ExpenseModal from './ExpenseModal';
import PageSearchInput from './PageSearchInput';
import { useAuth } from './AuthContext';
import { useTaskCounts } from './TaskCountsContext';
import { isPathVisibleForRole } from '../lib/navPermissions';

export default function AppActionBar({ className }) {
	const router = useRouter();
	const { isAdmin, user, navPermissions } = useAuth();
	const { refreshTaskCounts } = useTaskCounts();
	const canSearch = isPathVisibleForRole('/search', user?.role, navPermissions);
	const [properties, setProperties] = useState([]);
	const [propertiesLoading, setPropertiesLoading] = useState(false);
	const [showTaskModal, setShowTaskModal] = useState(false);
	const [showExpenseModal, setShowExpenseModal] = useState(false);
	const [search, setSearch] = useState('');
	const [newMenuOpen, setNewMenuOpen] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const todayLabel = format(new Date(), 'EEEE, MMMM d, yyyy');

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
		setNewMenuOpen(false);
		await ensureProperties();
		setShowTaskModal(true);
	}

	async function openExpenseModal() {
		setNewMenuOpen(false);
		await ensureProperties();
		setShowExpenseModal(true);
	}

	function submitSearch(e) {
		e.preventDefault();
		const q = search.trim();
		if (!q) return;
		router.push(`/search?q=${encodeURIComponent(q)}`);
	}

	async function syncTasks() {
		setSyncing(true);
		try {
			const json = await fetchJson('/api/tasks/sync', { method: 'POST' });
			if (json) alert(formatSyncResultAlert(json));
			await refreshTaskCounts({});
			window.dispatchEvent(new CustomEvent('hn:tasks-synced'));
		} catch (err) {
			alert('Sync failed: ' + err.message);
		} finally {
			setSyncing(false);
		}
	}

	return (
		<>
			{showTaskModal && (
				<TaskModal
					properties={properties}
					onClose={() => setShowTaskModal(false)}
					onSaved={() => setShowTaskModal(false)}
				/>
			)}
			{showExpenseModal && (
				<ExpenseModal
					properties={properties}
					title="New Transaction"
					onClose={() => setShowExpenseModal(false)}
					onSaved={() => setShowExpenseModal(false)}
				/>
			)}
			<div
				className={clsx(
					'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2',
					className,
				)}
			>
				<p className="text-sm text-muted min-w-0">
					Hello, <span className="font-medium text-dark">{user?.name || 'there'}.</span> Today is{' '}
					<span className="font-medium text-dark">{todayLabel}</span>.
				</p>

				<div className="flex flex-wrap items-center gap-2 ml-auto">
					{canSearch && (
						<form onSubmit={submitSearch} className="min-w-0 sm:min-w-[12rem] sm:max-w-xs">
							<PageSearchInput
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search..."
								className="w-full"
							/>
						</form>
					)}

					{isAdmin && (
						<button
							type="button"
							onClick={syncTasks}
							disabled={syncing}
							className="btn-secondary text-xs gap-1.5 justify-center"
						>
							<RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
							{syncing ? 'Syncing…' : 'Sync'}
						</button>
					)}

					{isAdmin && (
						<div className="relative">
							<button
								type="button"
								onClick={() => setNewMenuOpen((open) => !open)}
								className="btn-primary text-xs gap-1.5 justify-center"
								aria-expanded={newMenuOpen}
								aria-haspopup="menu"
							>
								<Plus size={14} />
								Add
								<ChevronDown
									size={14}
									className={clsx('transition-transform', newMenuOpen && 'rotate-180')}
								/>
							</button>

							{newMenuOpen && (
								<>
									<button
										type="button"
										className="fixed inset-0 z-20"
										aria-label="Close add menu"
										onClick={() => setNewMenuOpen(false)}
									/>
									<ul
										className="absolute right-0 top-full z-30 mt-1 min-w-[11rem] rounded-lg border border-border bg-white shadow-lg p-1.5"
										role="menu"
										aria-label="Add"
									>
										<li role="none">
											<button
												type="button"
												role="menuitem"
												onClick={openTaskModal}
												className="w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2 text-sm text-dark hover:bg-gray-50 transition-colors"
											>
												<CheckSquare size={14} className="text-muted flex-shrink-0" />
												Add Task
											</button>
										</li>
										<li role="none">
											<button
												type="button"
												role="menuitem"
												onClick={openExpenseModal}
												className="w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2 text-sm text-dark hover:bg-gray-50 transition-colors"
											>
												<DollarSign size={14} className="text-muted flex-shrink-0" />
												Add Transaction
											</button>
										</li>
										<li role="none">
											<Link
												href="/reports"
												role="menuitem"
												onClick={() => setNewMenuOpen(false)}
												className="w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2 text-sm text-dark hover:bg-gray-50 transition-colors"
											>
												<FileBarChart size={14} className="text-muted flex-shrink-0" />
												Add Report
											</Link>
										</li>
										<li role="none">
											<Link
												href="/supplies/order"
												role="menuitem"
												onClick={() => setNewMenuOpen(false)}
												className="w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2 text-sm text-dark hover:bg-gray-50 transition-colors"
											>
												<ShoppingCart size={14} className="text-muted flex-shrink-0" />
												Add Order
											</Link>
										</li>
									</ul>
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</>
	);
}
