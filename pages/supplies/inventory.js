import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { Plus, RefreshCw, ChevronRight } from 'lucide-react';
import Layout from '../../components/Layout';
import PageSearchInput from '../../components/PageSearchInput';
import SupplyInventoryItemModal from '../../components/supplies/SupplyInventoryItemModal';
import SupplyLocationModal, { countNestedLocations } from '../../components/supplies/SupplyLocationModal';
import SupplyInventoryLocationSection, {
	filterLocationTree,
	locationTreeHasVisibleNodes,
} from '../../components/supplies/SupplyInventoryLocationSection';
import { PageLoader, ErrorState, EmptyState } from '../../components/LoadingSpinner';
import { fetchJson } from '../../lib/apiClient';
import { requireAuth } from '../../lib/auth';
import {
	DEFAULT_INVENTORY_LOCATION,
	buildLocationTree,
	getLocationLeafName,
	getInventoryContainerPath,
	isLocationDescendant,
	joinLocationPath,
	parseLocationPath,
	replaceLocationPathPrefix,
	sortLocationPaths,
} from '../../lib/supplies';
import { useAuth } from '../../components/AuthContext';

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

	const itemsByLocation = useMemo(() => {
		const grouped = {};
		for (const loc of locations) {
			grouped[loc] = filtered.filter((item) => item.location === loc);
		}
		return grouped;
	}, [locations, filtered]);

	const locationTree = useMemo(() => buildLocationTree(locations), [locations]);

	const visibleTree = useMemo(() => {
		const scoped = filterLocationTree(locationTree, locationFilter || null);
		if (locationFilter) return scoped;
		return scoped.filter((node) => {
			const hasDirectItems = (itemsByLocation[node.path] || []).length > 0;
			const isEmptyTracked = emptyLocations.includes(node.path);
			const hasVisibleChild = locationTreeHasVisibleNodes(node.children, itemsByLocation, emptyLocations, search);
			return hasDirectItems || isEmptyTracked || hasVisibleChild
				|| (!search.trim() && node.path === (defaultLocationOverride || DEFAULT_INVENTORY_LOCATION));
		});
	}, [locationTree, locationFilter, itemsByLocation, emptyLocations, search, defaultLocationOverride]);

	function openAddLocation() {
		setLocationModal({ mode: 'add' });
	}

	function openAddSubLocation(parentLocation) {
		setLocationModal({ mode: 'add', parentLocation });
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
		if (!path) {
			setLocationFilter('');
			return;
		}
		setEmptyLocations((prev) => (prev.includes(path) ? prev : [...prev, path]));
		setLocationFilter(path);
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
		load();
	}

	function handleItemSaved() {
		load();
	}

	function handleItemDeleted() {
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

	return (
		<>
			<Head><title>Inventory — Supplies — Hello Neighbor</title></Head>
			<Layout title="">
				<div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h1 className="text-2xl font-bold text-dark">Inventory</h1>
					</div>
					<div className="flex flex-wrap gap-2 self-start">
						{isAdmin && (
							<button
								type="button"
								onClick={openAddLocation}
								className="btn-primary text-xs gap-1.5"
							>
								<Plus size={14} />
								Add Location
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

				<div className="flex flex-col sm:flex-row gap-3 mb-6">
					<PageSearchInput
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search inventory…"
						className="flex-1 w-full sm:w-auto"
					/>
					{locations.length > 0 && (
						<select
							className="input sm:w-56"
							value={locationFilter}
							onChange={(e) => setLocationFilter(e.target.value)}
						>
							<option value="">All locations</option>
							{locations.map((loc) => {
								const depth = parseLocationPath(loc).length - 1;
								const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';
								return (
									<option key={loc} value={loc}>
										{prefix}{getLocationLeafName(loc)}
									</option>
								);
							})}
						</select>
					)}
				</div>

				{locationFilter && (
					<nav aria-label="Location breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted mb-4">
						<button
							type="button"
							onClick={() => openLocationPath('')}
							className="text-brand-600 hover:text-brand-700 font-medium"
						>
							All locations
						</button>
						{parseLocationPath(locationFilter).map((segment, index, parts) => {
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

				{loading && <PageLoader message="Loading inventory…" />}
				{error && <ErrorState message={error} retry={load} />}
				{!loading && !error && visibleTree.length === 0 && (
					<EmptyState
						title="No inventory yet"
						message={isAdmin ? 'Add a location to start tracking stock.' : undefined}
					/>
				)}
				{!loading && !error && visibleTree.length > 0 && (
					<div className="space-y-8">
						{visibleTree.map((node) => (
							<SupplyInventoryLocationSection
								key={node.path}
								node={node}
								itemsByLocation={itemsByLocation}
								emptyLocations={emptyLocations}
								isAdmin={isAdmin}
								search={search}
								onEditLocation={openEditLocation}
								onAddSubLocation={openAddSubLocation}
								onAddItem={openAddItem}
								onEditItem={openEditItem}
								onOpenContainer={openContainer}
							/>
						))}
					</div>
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
						onSaved={handleItemSaved}
						onDeleted={handleItemDeleted}
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
