import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Head from 'next/head';
import { Plus, ShoppingCart, RefreshCw, ListOrdered } from 'lucide-react';
import Layout from '../../components/Layout';
import PageSearchInput from '../../components/PageSearchInput';
import SupplyProductCard from '../../components/supplies/SupplyProductCard';
import SupplyProductModal from '../../components/supplies/SupplyProductModal';
import SupplyCart from '../../components/supplies/SupplyCart';
import SupplyOutstandingOrders, { openSupplyInvoice } from '../../components/supplies/SupplyOutstandingOrders';
import { PageLoader, ErrorState } from '../../components/LoadingSpinner';
import { fetchJson } from '../../lib/apiClient';
import { requireAuth } from '../../lib/auth';
import { getPropertyDisplayName } from '../../lib/codes';
import { DEFAULT_INVENTORY_LOCATION, fmtSupplyPrice, isInventoryOnlyProduct, parseMarkupPercent, resolveDeliveryLocation, SUPPLY_CATEGORIES, SUPPLY_ORDER_STATUS, supplyInvoicePdfUrl } from '../../lib/supplies';
import clsx from 'clsx';

function orderToCartItems(order) {
	return (order?.items || []).map((item) => ({
		product_id: item.product_id,
		quantity: item.quantity,
		unit_price: item.unit_price,
		sales_tax_percent: item.sales_tax_percent,
	}));
}

function isCustomDeliveryLocation(loc, propertyName) {
	if (!loc || loc === DEFAULT_INVENTORY_LOCATION) return false;
	if (propertyName && loc === propertyName) return false;
	return true;
}

function orderLabel(order) {
	if (!order) return 'New order';
	const prop = order.property_name || 'No property';
	if (order.status === SUPPLY_ORDER_STATUS.SUBMITTED) {
		return `Invoice · ${prop}`;
	}
	return `Draft · ${prop}`;
}

export default function SuppliesOrderPage() {
	const [viewMode, setViewMode] = useState('new');
	const [products, setProducts] = useState([]);
	const [inventory, setInventory] = useState([]);
	const [properties, setProperties] = useState([]);
	const [openOrders, setOpenOrders] = useState([]);
	const [selectedOrderId, setSelectedOrderId] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	const [category, setCategory] = useState('');
	const [cart, setCart] = useState([]);
	const [cartOpen, setCartOpen] = useState(false);
	const [location, setLocation] = useState(DEFAULT_INVENTORY_LOCATION);
	const [propertyId, setPropertyId] = useState('');
	const [markupPercent, setMarkupPercent] = useState(0);
	const [notes, setNotes] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [delivering, setDelivering] = useState(false);
	const [paying, setPaying] = useState(false);
	const [reopeningId, setReopeningId] = useState(null);
	const [payingId, setPayingId] = useState(null);
	const [deliveringId, setDeliveringId] = useState(null);
	const [savingDraft, setSavingDraft] = useState(false);
	const [showProductModal, setShowProductModal] = useState(false);
	const [editingProduct, setEditingProduct] = useState(null);
	const skipDraftSave = useRef(true);
	const locationTouched = useRef(false);
	const skipMarkupSave = useRef(true);

	const activeOrder = useMemo(
		() => openOrders.find((o) => o.id === selectedOrderId) || null,
		[openOrders, selectedOrderId],
	);
	const orderLocked = activeOrder?.status === SUPPLY_ORDER_STATUS.SUBMITTED;
	const editingExisting = Boolean(selectedOrderId);

	function applyOrderToForm(order) {
		if (order) {
			setCart(orderToCartItems(order));
			setPropertyId(order.property_id || '');
			setMarkupPercent(parseMarkupPercent(order.markup_percent));
			setNotes(order.notes || '');
			const propName = order.property_name || '';
			const savedLoc = order.location || DEFAULT_INVENTORY_LOCATION;
			const custom = isCustomDeliveryLocation(savedLoc, propName);
			locationTouched.current = custom;
			setLocation(custom ? savedLoc : resolveDeliveryLocation(savedLoc, propName));
		} else {
			setCart([]);
			setNotes('');
			setLocation(DEFAULT_INVENTORY_LOCATION);
			setPropertyId('');
			locationTouched.current = false;
		}
	}

	function upsertOpenOrder(order) {
		if (!order) return;
		setOpenOrders((prev) => {
			const idx = prev.findIndex((o) => o.id === order.id);
			if (idx === -1) return [order, ...prev];
			const next = [...prev];
			next[idx] = order;
			return next;
		});
	}

	function removeOpenOrder(orderId) {
		setOpenOrders((prev) => prev.filter((o) => o.id !== orderId));
	}

	function selectOrder(order) {
		skipDraftSave.current = true;
		skipMarkupSave.current = true;
		if (!order) {
			setSelectedOrderId(null);
			applyOrderToForm(null);
			return;
		}
		setSelectedOrderId(order.id);
		applyOrderToForm(order);
	}

	function startNewOrder() {
		selectOrder(null);
		setViewMode('new');
	}

	function editOutstandingOrder(order) {
		selectOrder(order);
		setViewMode('new');
		setCartOpen(true);
	}

	function openAddProduct() {
		setEditingProduct(null);
		setShowProductModal(true);
	}

	function openEditProduct(product) {
		setEditingProduct(product);
		setShowProductModal(true);
	}

	function closeProductModal() {
		setShowProductModal(false);
		setEditingProduct(null);
	}

	function handleProductDeleted(productId) {
		setCart((prev) => prev.filter((c) => c.product_id !== productId));
		closeProductModal();
		load();
	}

	async function deleteProduct(product) {
		try {
			await fetchJson(`/api/supplies/products/${product.id}`, { method: 'DELETE' });
			handleProductDeleted(product.id);
		} catch (err) {
			alert('Delete failed: ' + err.message);
			throw err;
		}
	}

	async function load() {
		setLoading(true);
		setError('');
		try {
			const [productsJson, inventoryJson, activeJson, propertiesJson, markupJson] = await Promise.all([
				fetchJson('/api/supplies/products'),
				fetchJson('/api/supplies/inventory'),
				fetchJson('/api/supplies/orders/active'),
				fetchJson('/api/properties'),
				fetchJson('/api/supplies/settings/markup'),
			]);
			setProducts(productsJson?.data || []);
			setInventory(inventoryJson?.data || []);
			setProperties(propertiesJson?.data || []);
			skipDraftSave.current = true;
			skipMarkupSave.current = true;
			const orders = activeJson?.data || [];
			setOpenOrders(orders);
			setSelectedOrderId(null);
			applyOrderToForm(null);
			setMarkupPercent(parseMarkupPercent(markupJson?.data?.percent));
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	const propertyName = useMemo(() => {
		if (!propertyId) return '';
		const prop = properties.find((p) => p.id === propertyId);
		return getPropertyDisplayName(prop) || prop?.name || '';
	}, [propertyId, properties]);

	const effectiveLocation = useMemo(() => {
		if (locationTouched.current) return location || DEFAULT_INVENTORY_LOCATION;
		return resolveDeliveryLocation(location, propertyName);
	}, [location, propertyName]);

	useEffect(() => {
		if (locationTouched.current || !propertyName) return;
		setLocation((prev) => (
			prev === DEFAULT_INVENTORY_LOCATION || !prev || prev === propertyName
				? propertyName
				: prev
		));
	}, [propertyName]);

	function handlePropertyChange(nextPropertyId) {
		setPropertyId(nextPropertyId);
		if (!locationTouched.current) {
			const prop = properties.find((p) => p.id === nextPropertyId);
			const name = getPropertyDisplayName(prop) || prop?.name || '';
			setLocation(resolveDeliveryLocation(location, name));
		}
	}

	function handleLocationChange(nextLocation) {
		locationTouched.current = true;
		setLocation(nextLocation);
	}

	function handleMarkupChange(nextMarkup) {
		setMarkupPercent(parseMarkupPercent(nextMarkup));
	}

	const saveDefaultMarkup = useCallback(async (percent) => {
		try {
			await fetchJson('/api/supplies/settings/markup', {
				method: 'PUT',
				body: { percent: parseMarkupPercent(percent) },
			});
		} catch (err) {
			console.error('Markup save failed:', err.message);
		}
	}, []);

	useEffect(() => {
		if (skipMarkupSave.current) {
			skipMarkupSave.current = false;
			return undefined;
		}
		const timer = setTimeout(() => { saveDefaultMarkup(markupPercent); }, 500);
		return () => clearTimeout(timer);
	}, [markupPercent, saveDefaultMarkup]);

	const saveDraft = useCallback(async () => {
		if (orderLocked) return;
		setSavingDraft(true);
		try {
			const json = await fetchJson('/api/supplies/orders/active', {
				method: 'PUT',
				body: {
					order_id: selectedOrderId,
					items: cart,
					location: effectiveLocation,
					notes,
					property_id: propertyId || null,
					property_name: propertyName || null,
					markup_percent: markupPercent,
				},
			});
			const order = json?.data || null;
			if (order) {
				upsertOpenOrder(order);
				if (!selectedOrderId) setSelectedOrderId(order.id);
			} else if (selectedOrderId) {
				removeOpenOrder(selectedOrderId);
				setSelectedOrderId(null);
			}
		} catch (err) {
			console.error('Draft save failed:', err.message);
		} finally {
			setSavingDraft(false);
		}
	}, [cart, effectiveLocation, notes, propertyId, propertyName, markupPercent, orderLocked, selectedOrderId]);

	useEffect(() => {
		if (skipDraftSave.current) {
			skipDraftSave.current = false;
			return undefined;
		}
		if (orderLocked) return undefined;
		const timer = setTimeout(() => { saveDraft(); }, 500);
		return () => clearTimeout(timer);
	}, [cart, effectiveLocation, notes, propertyId, markupPercent, orderLocked, saveDraft]);

	const productsById = useMemo(
		() => Object.fromEntries(products.map((p) => [p.id, p])),
		[products],
	);

	const sortedProperties = useMemo(
		() => [...properties].sort((a, b) =>
			(getPropertyDisplayName(a) || a.name || '').localeCompare(getPropertyDisplayName(b) || b.name || ''),
		),
		[properties],
	);

	const locations = useMemo(() => {
		const fromInventory = inventory.map((i) => i.location).filter(Boolean);
		const fromProperties = sortedProperties
			.map((p) => getPropertyDisplayName(p) || p.name)
			.filter(Boolean);
		return [...new Set([DEFAULT_INVENTORY_LOCATION, ...fromProperties, ...fromInventory])].sort();
	}, [inventory, sortedProperties]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return products.filter((p) => {
			if (isInventoryOnlyProduct(p)) return false;
			if (category && p.category !== category) return false;
			if (!q) return true;
			return p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
		});
	}, [products, search, category]);

	const addToCart = useCallback((product, quantity = 1) => {
		if (orderLocked) return;
		const qty = Math.max(1, Math.floor(Number(quantity)) || 1);
		setCart((prev) => {
			const existing = prev.find((c) => c.product_id === product.id);
			if (existing) {
				return prev.map((c) =>
					c.product_id === product.id ? { ...c, quantity: c.quantity + qty } : c,
				);
			}
			return [
				...prev,
				{
					product_id: product.id,
					quantity: qty,
					unit_price: product.sale_price,
					sales_tax_percent: product.sales_tax_percent,
				},
			];
		});
	}, [orderLocked]);

	function changeQty(productId, qty) {
		if (orderLocked) return;
		if (qty < 1) {
			setCart((prev) => prev.filter((c) => c.product_id !== productId));
			return;
		}
		setCart((prev) => prev.map((c) => (c.product_id === productId ? { ...c, quantity: qty } : c)));
	}

	function removeFromCart(productId) {
		if (orderLocked) return;
		setCart((prev) => prev.filter((c) => c.product_id !== productId));
	}

	async function viewInvoice() {
		if (!cart.length || orderLocked) return;
		if (!propertyId) {
			alert('Select a property to bill before viewing the invoice.');
			return;
		}
		setSubmitting(true);
		try {
			const saved = await fetchJson('/api/supplies/orders/active', {
				method: 'PUT',
				body: {
					order_id: selectedOrderId,
					items: cart,
					location: effectiveLocation,
					notes,
					property_id: propertyId,
					property_name: propertyName,
					markup_percent: markupPercent,
				},
			});
			const orderId = saved?.data?.id;
			if (!orderId) throw new Error('Could not save order draft');
			const json = await fetchJson(`/api/supplies/orders/${orderId}/submit`, { method: 'POST' });
			const submitted = json?.data || null;
			if (submitted) {
				upsertOpenOrder(submitted);
				setSelectedOrderId(submitted.id);
				applyOrderToForm(submitted);
			}
			setCartOpen(true);
			window.open(supplyInvoicePdfUrl(orderId), '_blank', 'noopener,noreferrer');
		} catch (err) {
			alert('Invoice failed: ' + err.message);
		} finally {
			setSubmitting(false);
		}
	}

	async function deliverOrder(order = activeOrder) {
		if (!order?.id || order.status !== SUPPLY_ORDER_STATUS.SUBMITTED) return;
		const deliveredId = order.id;
		setDelivering(true);
		setDeliveringId(deliveredId);
		try {
			await fetchJson(`/api/supplies/orders/${deliveredId}/deliver`, { method: 'POST' });
			skipDraftSave.current = true;
			removeOpenOrder(deliveredId);
			if (selectedOrderId === deliveredId) {
				startNewOrder();
				setCartOpen(false);
			}
			await load();
		} catch (err) {
			alert('Delivery failed: ' + err.message);
		} finally {
			setDelivering(false);
			setDeliveringId(null);
		}
	}

	async function markOrderPaid(order = activeOrder) {
		if (!order?.id || order.status === SUPPLY_ORDER_STATUS.DRAFT) return;
		if (order.paid_at) return;
		setPaying(true);
		setPayingId(order.id);
		try {
			const json = await fetchJson(`/api/supplies/orders/${order.id}/pay`, { method: 'POST' });
			const paid = json?.data || null;
			if (paid) {
				upsertOpenOrder(paid);
				if (selectedOrderId === paid.id) {
					applyOrderToForm(paid);
				}
			}
		} catch (err) {
			alert('Could not mark paid: ' + err.message);
		} finally {
			setPaying(false);
			setPayingId(null);
		}
	}

	async function reopenOrder(order) {
		if (!order?.id || order.status !== SUPPLY_ORDER_STATUS.SUBMITTED || order.paid_at) return;
		setReopeningId(order.id);
		try {
			const json = await fetchJson(`/api/supplies/orders/${order.id}/reopen`, { method: 'POST' });
			const reopened = json?.data || null;
			if (reopened) {
				upsertOpenOrder(reopened);
				editOutstandingOrder(reopened);
			}
		} catch (err) {
			alert('Could not reopen order: ' + err.message);
		} finally {
			setReopeningId(null);
		}
	}

	function viewOutstandingInvoice(order) {
		if (order.status === SUPPLY_ORDER_STATUS.SUBMITTED) {
			openSupplyInvoice(order.id);
			return;
		}
		editOutstandingOrder(order);
	}

	const cartCount = cart.reduce((n, c) => n + c.quantity, 0);

	return (
		<>
			<Head><title>Supply Order — Supplies — Hello Neighbor</title></Head>
			<Layout title="">
				<div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						<h1 className="text-xl sm:text-2xl font-bold text-dark">Supply Order</h1>
						<div className="mt-3 inline-flex rounded-lg border border-border bg-bg p-1">
							<button
								type="button"
								onClick={() => setViewMode('new')}
								className={clsx(
									'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
									viewMode === 'new' ? 'bg-white text-dark shadow-sm' : 'text-muted hover:text-dark',
								)}
							>
								New order
							</button>
							<button
								type="button"
								onClick={() => setViewMode('outstanding')}
								className={clsx(
									'px-3 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5',
									viewMode === 'outstanding' ? 'bg-white text-dark shadow-sm' : 'text-muted hover:text-dark',
								)}
							>
								<ListOrdered size={12} />
								Outstanding
								{openOrders.length > 0 && (
									<span className="bg-brand-100 text-brand-700 text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
										{openOrders.length}
									</span>
								)}
							</button>
						</div>
						{viewMode === 'new' && editingExisting && activeOrder && (
							<p className="text-xs text-muted mt-2">
								Editing {orderLabel(activeOrder)}
								{activeOrder.total_amount ? ` · ${fmtSupplyPrice(activeOrder.total_amount)}` : ''}
								{' · '}
								<button type="button" onClick={startNewOrder} className="text-brand-600 hover:text-brand-700">
									Start fresh
								</button>
							</p>
						)}
						{viewMode === 'new' && !orderLocked && savingDraft && (
							<p className="text-xs text-muted mt-1">Saving cart…</p>
						)}
					</div>
					{viewMode === 'new' && (
					<div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:self-start">
						<PageSearchInput
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search…"
							className="min-w-0 flex-1 sm:flex-none sm:w-44 sm:max-w-xs"
						/>
						<div className="relative">
							<select
								className="select-compact sm:w-40 pr-7"
								value={category}
								onChange={(e) => setCategory(e.target.value)}
								aria-label="Categories"
							>
								<option value="">All Categories</option>
								{SUPPLY_CATEGORIES.map((cat) => (
									<option key={cat} value={cat}>{cat}</option>
								))}
							</select>
						</div>
						<button
							type="button"
							onClick={openAddProduct}
							className="btn-secondary text-xs gap-1.5"
						>
							<Plus size={14} />
							Add
						</button>
						<button
							type="button"
							onClick={load}
							disabled={loading}
							className="btn-secondary text-xs gap-1.5"
						>
							<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
							Refresh
						</button>
						<button
							type="button"
							onClick={() => setCartOpen(true)}
							className="btn-primary text-xs gap-1.5 relative"
						>
							<ShoppingCart size={14} />
							{orderLocked ? 'Invoice' : cartCount > 0 ? 'Review Order' : 'Cart'}
							{cartCount > 0 && (
								<span className="absolute -top-1.5 -right-1.5 bg-white text-brand-600 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
									{cartCount}
								</span>
							)}
						</button>
					</div>
					)}
					{viewMode === 'outstanding' && (
						<button
							type="button"
							onClick={load}
							disabled={loading}
							className="btn-secondary text-xs gap-1.5 sm:self-start"
						>
							<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
							Refresh
						</button>
					)}
				</div>

				{loading && <PageLoader message="Loading products…" />}
				{error && <ErrorState message={error} retry={load} />}
				{!loading && !error && viewMode === 'outstanding' && (
					<SupplyOutstandingOrders
						orders={openOrders}
						onEdit={editOutstandingOrder}
						onViewInvoice={viewOutstandingInvoice}
						onReopen={reopenOrder}
						onMarkPaid={markOrderPaid}
						onDeliver={deliverOrder}
						payingId={payingId}
						deliveringId={deliveringId}
						reopeningId={reopeningId}
					/>
				)}
				{!loading && !error && viewMode === 'new' && (
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
						{filtered.map((product) => (
							<SupplyProductCard
								key={product.id}
								product={product}
								onAdd={addToCart}
								onEdit={openEditProduct}
								onDelete={deleteProduct}
								disabled={orderLocked}
							/>
						))}
					</div>
				)}

				{showProductModal && (
					<SupplyProductModal
						product={editingProduct}
						onClose={closeProductModal}
						onSaved={load}
						onDeleted={handleProductDeleted}
					/>
				)}

				<SupplyCart
					open={cartOpen}
					items={cart}
					productsById={productsById}
					properties={sortedProperties}
					propertyId={propertyId}
					onPropertyChange={handlePropertyChange}
					markupPercent={markupPercent}
					onMarkupChange={handleMarkupChange}
					activeOrder={activeOrder}
					location={effectiveLocation}
					locations={locations}
					onLocationChange={handleLocationChange}
					notes={notes}
					onNotesChange={setNotes}
					onQtyChange={changeQty}
					onRemove={removeFromCart}
					onClose={() => setCartOpen(false)}
					onSubmit={viewInvoice}
					onDeliver={() => deliverOrder()}
					onMarkPaid={() => markOrderPaid()}
					submitting={submitting}
					delivering={delivering}
					paying={paying}
				/>
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
