import { useEffect, useState, Fragment } from 'react';
import Head from 'next/head';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import Layout from '../../components/Layout';
import { ErrorState } from '../../components/LoadingSpinner';
import { useAuth } from '../../components/AuthContext';
import { fetchJson } from '../../lib/apiClient';
import { requireAuth } from '../../lib/auth';
import {
	getDefaultNavPermissions,
	groupPermissionItems,
	PERMISSION_ITEMS,
} from '../../lib/navPermissions';

function ToggleSwitch({ checked, onChange, label }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className={clsx(
				'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors',
				checked ? 'bg-brand-500' : 'bg-gray-200',
			)}
		>
			<span
				className={clsx(
					'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
					checked ? 'translate-x-5' : 'translate-x-0',
				)}
			/>
		</button>
	);
}

export default function PermissionsSettingsPage({ initialPermissions }) {
	const { setNavPermissions } = useAuth();
	const [permissions, setPermissions] = useState(initialPermissions || getDefaultNavPermissions());
	const [expandedGroups, setExpandedGroups] = useState(() => new Set());
	const [expandedParents, setExpandedParents] = useState(() => new Set());
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		setPermissions(initialPermissions || getDefaultNavPermissions());
	}, [initialPermissions]);

	function updatePermission(href, roleKey, value) {
		setPermissions((prev) => ({
			...prev,
			[href]: {
				...prev[href],
				[roleKey]: value,
			},
		}));
		setSaved(false);
	}

	async function handleSave() {
		setSaving(true);
		setError('');
		try {
			const json = await fetchJson('/api/settings/nav-permissions', {
				method: 'PUT',
				body: { permissions },
			});
			const next = json?.data || permissions;
			setPermissions(next);
			setNavPermissions(next);
			setSaved(true);
		} catch (err) {
			setError(err.message || 'Could not save permissions.');
		} finally {
			setSaving(false);
		}
	}

	async function handleReset() {
		const defaults = getDefaultNavPermissions();
		setPermissions(defaults);
		setSaved(false);
	}

	function toggleGroup(group) {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(group)) next.delete(group);
			else next.add(group);
			return next;
		});
	}

	function toggleParent(href) {
		setExpandedParents((prev) => {
			const next = new Set(prev);
			if (next.has(href)) next.delete(href);
			else next.add(href);
			return next;
		});
	}

	function renderPermissionRow(item, { nested = false, allItems = [] } = {}) {
		const entry = permissions[item.href] || { admin: false, nonAdmin: false };
		const children = allItems.filter((child) => child.parentHref === item.href);
		const hasChildren = children.length > 0;
		const isParentOpen = expandedParents.has(item.href);

		return (
			<Fragment key={item.href}>
				<tr className={clsx('border-b border-border', !nested && 'last:border-b-0')}>
					<td className={clsx('py-3 text-dark', nested ? 'pl-10 pr-4' : 'px-4')}>
						<div className="flex items-center gap-2">
							{hasChildren ? (
								<button
									type="button"
									onClick={() => toggleParent(item.href)}
									className="inline-flex items-center gap-1.5 text-left hover:text-brand-600 transition-colors"
									aria-expanded={isParentOpen}
								>
									<ChevronDown
										size={16}
										className={clsx(
											'text-muted flex-shrink-0 transition-transform duration-200',
											isParentOpen && 'rotate-180',
										)}
									/>
									<span className={nested ? 'text-sm' : undefined}>{item.label}</span>
								</button>
							) : (
								<span className={nested ? 'text-sm' : undefined}>{item.label}</span>
							)}
						</div>
					</td>
					<td className="px-4 py-3 text-center">
						<div className="flex justify-center">
							<ToggleSwitch
								checked={entry.admin === true}
								onChange={(value) => updatePermission(item.href, 'admin', value)}
								label={`${item.label} visible to admins`}
							/>
						</div>
					</td>
					<td className="px-4 py-3 text-center">
						<div className="flex justify-center">
							<ToggleSwitch
								checked={entry.nonAdmin === true}
								onChange={(value) => updatePermission(item.href, 'nonAdmin', value)}
								label={`${item.label} visible to non-admins`}
							/>
						</div>
					</td>
				</tr>
				{hasChildren && isParentOpen && children.map((child) => renderPermissionRow(child, { nested: true, allItems }))}
			</Fragment>
		);
	}

	const groups = groupPermissionItems(PERMISSION_ITEMS);

	return (
		<>
			<Head><title>Permissions — Hello Neighbor</title></Head>
			<Layout title="">
				<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-2xl font-bold text-dark">Permissions</h1>
						<p className="text-sm text-muted mt-1">
							Choose what is visible to admin and non-admin users in the app.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleReset}
							className="btn-secondary"
							disabled={saving}
						>
							Reset to Defaults
						</button>
						<button
							type="button"
							onClick={handleSave}
							className="btn-primary"
							disabled={saving}
						>
							{saving ? 'Saving…' : 'Save'}
						</button>
					</div>
				</div>

				{error && <div className="mb-4"><ErrorState message={error} /></div>}
				{saved && !error && (
					<p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
						Permissions saved.
					</p>
				)}

				<div className="space-y-3">
					{groups.map(({ group, items }) => {
						const isOpen = expandedGroups.has(group);
						return (
							<div key={group} className="card overflow-hidden">
								<button
									type="button"
									onClick={() => toggleGroup(group)}
									className={clsx(
										'flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors',
										isOpen ? 'bg-brand-50/70 border-b border-border' : 'bg-gray-50 hover:bg-gray-100/80',
									)}
									aria-expanded={isOpen}
								>
									<h2 className="text-lg font-semibold text-dark">{group}</h2>
									<ChevronDown
										size={20}
										className={clsx(
											'text-muted flex-shrink-0 transition-transform duration-200',
											isOpen && 'rotate-180',
										)}
									/>
								</button>
								{isOpen && (
									<div className="overflow-x-auto">
										<table className="min-w-full text-sm">
											<thead className="bg-white border-b border-border">
												<tr>
													<th className="text-left font-semibold text-dark px-4 py-3" />
													<th className="text-center font-semibold text-dark px-4 py-3 w-28">Admin</th>
													<th className="text-center font-semibold text-dark px-4 py-3 w-32">Non-Admin</th>
												</tr>
											</thead>
											<tbody>
												{items
													.filter((item) => !item.parentHref)
													.map((item) => renderPermissionRow(item, { allItems: items }))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async (_context, _session, navPermissions) => ({
	props: {
		initialPermissions: navPermissions,
	},
}));
