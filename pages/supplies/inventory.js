import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { Plus, RefreshCw, ChevronRight, Pencil, FolderOpen } from 'lucide-react';
import Layout from '../../components/Layout';
import PageSearchInput from '../../components/PageSearchInput';
import SupplyInventoryItemModal from '../../components/supplies/SupplyInventoryItemModal';
import SupplyLocationModal, { countNestedLocations } from '../../components/supplies/SupplyLocationModal';
import SupplyInventoryTable from '../../components/supplies/SupplyInventoryTable';
import { PageLoader, ErrorState, EmptyState } from '../../components/LoadingSpinner';
import { fetchJson } from '../../lib/apiClient';
import { requireAuth } from '../../lib/auth';
import {
	DEFAULT_INVENTORY_LOCATION,
	getDirectChildLocations,
	getInventoryContainerPath,
	isLocationDescendant,
	joinLocationPath,
	parseLocationPath,
	replaceLocationPathPrefix,
	sortLocationPaths,
} from '../../lib/supplies';
import { useAuth } from '../../components/AuthContext';

function countItemsAtOrBelow(location, items) {
	return items.filter((item) => isLocationDescendant(item.location, location)).length;
}

export default function SuppliesInventoryPage() {
	const { isAdmin } = useAuth();
	const [items, setItems] = useState([]);
	const [products, setProducts] = useState([]);
	const [emptyLocations, setEmptyLocations] = useState([]);
	const [defaultLocationOverride, setDefaultLocationOverride] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	const [locationFilter, setLocationFilter] = useState('');
	const [itemModal, setItemModal] = useState(null);
	const [locationModal, setLocationModal] = useState(null);

	async function load() {
		setLoading(true);
		setError('');
		try {
			const [inventoryJson, productsJson] = await Promise.all([
				fetchJson('/api/supplies/inventory'),
				isAdmin ? fetchJson('/api/supplies/products') : Promise.resolve({ data: [] }),
			]);
			setItems(inventoryJson?.data || []);
			setProducts(productsJson?.data || []);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, [isAdmin]);

	useEffect(() => {
		setEmptyLocations((prev) => prev.filter((loc) => !items.some((item) => item.location === loc)));
	}, [items]);

	const locations = useMemo(() => {
		const fromItems = items.map((i) => i.location).filter(Boolean);
		const defaultLoc = defaultLocationOverride || DEFAULT_INVENTORY_LOCATION;
		const all = [...new Set([defaultLoc, ...fromItems, ...emptyLocations])];
		return sortLocationPaths(all);
	}, [items, emptyLocations, defaultLocationOverride]);

	const searchActive = search.trim().length > 0;

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return items.filter((item) => {
			if (locationFilter && !isLocationDescendant(item.location, locationFilter)) return false;
			if (!q) return true;
			const title = item.product?.title?.toLowerCase() || '';
			const category = item.product?.category?.toLowerCase() || '';
			const loc = item.location?.toLowerCase() || '';
			return title.includes(q) || category.includes(q) || loc.includes(q);
		});
	}, [items, search, locationFilter]);

	const childLocations = useMemo(() => {
		if (searchActive) return [];
		return getDirectChildLocations(locationFilter, locations);
	}, [locations, locationFilter, searchActive]);

	const currentItems = useMemo(() => {
		if (searchActive) return filtered;
		return filtered.filter((item) => item.location === locationFilter);
	}, [filtered, locationFilter, searchActive]);

	const itemsByLocation = useMemo(() => {
		const grouped = {};
		for (const loc of locations) {
			grouped[loc] = items.filter((item) => item.location === loc);
		}
		return grouped;
	}, [items, locations]);

	function openAddLocation() {
		setLocationModal({ mode: 'add', parentLocation: locationFilter || null });
	}

	function openEditLocation(location) {
		setLocationModal({ mode: 'edit', location });
	}

	function openAddItem(location) {
		setItemModal({ mode: 'add', location });
	}

	function openEditItem(item) {
		setItemModal({ mode: 'edit', item });
	}

	function openContainer(item) {
		const path = getInventoryContainerPath(item);
		if (!path) return;
		setEmptyLocations((prev) => (prev.includes(path) ? prev : [...prev, path]));
		setLocationFilter(path);
	}

	function openLocationPath(path) {
		setLocationFilter(path || '');
		if (path && !locations.includes(path)) {
			setEmptyLocations((prev) => (prev.includes(path) ? prev : [...prev, path]));
		}
	}

	function handleLocationSaved(result) {
		if (result?.name) {
			setEmptyLocations((prev) => [...new Set([...prev, result.name])]);
		}
		if (result?.from && result?.to) {
			const defaultLoc = defaultLocationOverride || DEFAULT_INVENTORY_LOCATION;
			if (result.from === defaultLoc) {
				setDefaultLocationOverride(result.to);
			}
			setEmptyLocations((prev) => prev.map((loc) => {
				if (loc === result.from) return result.to;
				if (isLocationDescendant(loc, result.from)) {
					return replaceLocationPathPrefix(loc, result.from, result.to);
				}
				return loc;
			}));
		}
		load();
	}

	function handleLocationDeleted(location) {
		setEmptyLocations((prev) => prev.filter((loc) => (
			loc !== location && !isLocationDescendant(loc, location)
		)));
		if (locationFilter && isLocationDescendant(locationFilter, location)) {
			setLocationFilter('');
		}
		load();
	}

	const existingLocations = locations;
	const modalLocation = locationModal?.location;
	const modalItemCount = modalLocation
		? items.filter((item) => isLocationDescendant(item.location, modalLocation)).length
		: 0;
	const modalSubLocationCount = modalLocation
		? countNestedLocations(modalLocation, existingLocations)
		: 0;

	const showEmpty = !loading && !error
		&& childLocations.length === 0
		&& currentItems.length === 0
		&& !searchActive;

	return (
		<>
			<Head><title>Inventory — Supplies — Hello Neighbor</title></Head>
			<Layout title="">
				<div className="flex flex-col gap-4 mb-5 sm:flex-row sm:items-center sm:justify-between">
					<h1 className="text-2xl font-bold text-dark">Inventory</h1>
					<div className="flex flex-wrap gap-2">
						{isAdmin && (
							<button
								type="button"
								onClick={openAddLocation}
								className="btn-primary text-xs gap-1.5"
							>
								<Plus size={14} />
								{locationFilter ? 'Add Sub-location' : 'Add Location'}
							</button>
						)}
						<button
							type="button"
							onClick={load}
							disabled={loading}
							className="btn-secondary text-xs gap-1.5"
						>
							<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
							Refresh
						</button>
					</div>
				</div>

				<div className="mb-4">
					<PageSearchInput
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search inventory…"
					/>
				</div>

				{!searchActive && (
					<nav aria-label="Location breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted mb-4">
						<button
							type="button"
							onClick={() => openLocationPath('')}
							className={`font-medium ${locationFilter ? 'text-brand-600 hover:text-brand-700' : 'text-dark'}`}
						>
							All locations
						</button>
						{locationFilter && parseLocationPath(locationFilter).map((segment, index, parts) => {
							const resolvedPath = parts.slice(0, index + 1).reduce(
								(acc, part, i) => (i === 0 ? part : joinLocationPath(acc, part)),
								'',
							);
							const isLast = index === parts.length - 1;
							return (
								<span key={resolvedPath} className="inline-flex items-center gap-1">
									<ChevronRight size={14} className="text-muted flex-shrink-0" />
									{isLast ? (
										<span className="text-dark font-medium">{segment}</span>
									) : (
										<button
											type="button"
											onClick={() => openLocationPath(resolvedPath)}
											className="text-brand-600 hover:text-brand-700 font-medium"
										>
											{segment}
										</button>
									)}
								</span>
							);
						})}
					</nav>
				)}

				{isAdmin && locationFilter && !searchActive && (
					<div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
						<button
							type="button"
							onClick={() => openEditLocation(locationFilter)}
							className="inline-flex items-center gap-1 text-muted hover:text-brand-600"
						>
							<Pencil size={14} />
							Edit location
						</button>
						<button
							type="button"
							onClick={() => openAddItem(locationFilter)}
							className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium"
						>
							<Plus size={14} />
							Add item
						</button>
					</div>
				)}

				{loading && <PageLoader message="Loading inventory…" />}
				{error && <ErrorState message={error} retry={load} />}

				{!loading && !error && searchActive && (
					currentItems.length === 0 ? (
						<EmptyState title="No matches" message="Try a different search term." />
					) : (
						<SupplyInventoryTable
							items={currentItems}
							isAdmin={isAdmin}
							onEditItem={openEditItem}
							onOpenContainer={openContainer}
							showLocation
						/>
					)
				)}

				{!loading && !error && !searchActive && childLocations.length > 0 && (
					<div className="card overflow-hidden mb-4">
						<ul className="divide-y divide-border">
							{childLocations.map((loc) => {
								const name = parseLocationPath(loc).at(-1);
								const count = countItemsAtOrBelow(loc, items);
								return (
									<li key={loc}>
										<button
											type="button"
											onClick={() => openLocationPath(loc)}
											className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
										>
											<FolderOpen size={18} className="text-brand-500 flex-shrink-0" />
											<span className="flex-1 font-medium text-dark truncate">{name}</span>
											{count > 0 && (
												<span className="text-xs text-muted tabular-nums">
													{count} item{count === 1 ? '' : 's'}
												</span>
											)}
											<ChevronRight size={16} className="text-muted flex-shrink-0" />
										</button>
									</li>
								);
							})}
						</ul>
					</div>
				)}

				{!loading && !error && !searchActive && currentItems.length > 0 && (
					<SupplyInventoryTable
						items={currentItems}
						isAdmin={isAdmin}
						onEditItem={openEditItem}
						onOpenContainer={openContainer}
					/>
				)}

				{showEmpty && (
					<EmptyState
						title={locationFilter ? 'Nothing here yet' : 'No inventory yet'}
						message={
							isAdmin
								? (locationFilter ? 'Add items or sub-locations to this location.' : 'Add a location to start tracking stock.')
								: undefined
						}
					/>
				)}

				{itemModal && (
					<SupplyInventoryItemModal
						item={itemModal.mode === 'edit' ? itemModal.item : null}
						location={itemModal.mode === 'add' ? itemModal.location : itemModal.item?.location}
						products={products}
						existingProductIds={
							itemModal.mode === 'add'
								? (itemsByLocation[itemModal.location] || []).map((i) => i.product_id)
								: []
						}
						onClose={() => setItemModal(null)}
						onSaved={() => { setItemModal(null); load(); }}
						onDeleted={() => { setItemModal(null); load(); }}
					/>
				)}

				{locationModal && (
					<SupplyLocationModal
						location={locationModal.mode === 'edit' ? locationModal.location : null}
						parentLocation={locationModal.mode === 'add' ? locationModal.parentLocation : null}
						existingLocations={existingLocations}
						itemCount={modalItemCount}
						subLocationCount={modalSubLocationCount}
						onClose={() => setLocationModal(null)}
						onSaved={handleLocationSaved}
						onDeleted={handleLocationDeleted}
					/>
				)}
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
