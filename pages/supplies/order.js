import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Head from 'next/head';
import { Plus, ShoppingCart, RefreshCw, PackageCheck, ChevronDown } from 'lucide-react';
import Layout from '../../components/Layout';
import PageSearchInput from '../../components/PageSearchInput';
import SupplyProductCard from '../../components/supplies/SupplyProductCard';
import SupplyProductModal from '../../components/supplies/SupplyProductModal';
import SupplyCart from '../../components/supplies/SupplyCart';
import { PageLoader, ErrorState } from '../../components/LoadingSpinner';
import { fetchJson } from '../../lib/apiClient';
import { requireAuth } from '../../lib/auth';
import { DEFAULT_INVENTORY_LOCATION, SUPPLY_CATEGORIES, SUPPLY_ORDER_STATUS } from '../../lib/supplies';

function orderToCartItems(order) {
	return (order?.items || []).map((item) => ({
		product_id: item.product_id,
		quantity: item.quantity,
		unit_price: item.unit_price,
		sales_tax_percent: item.sales_tax_percent,
	}));
}

export default function SuppliesOrderPage() {
	const [products, setProducts] = useState([]);
	const [inventory, setInventory] = useState([]);
	const [activeOrder, setActiveOrder] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	const [category, setCategory] = useState('');
	const [cart, setCart] = useState([]);
	const [cartOpen, setCartOpen] = useState(false);
	const [location, setLocation] = useState(DEFAULT_INVENTORY_LOCATION);
	const [notes, setNotes] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [delivering, setDelivering] = useState(false);
	const [savingDraft, setSavingDraft] = useState(false);
	const [showProductModal, setShowProductModal] = useState(false);
	const [editingProduct, setEditingProduct] = useState(null);
	const skipDraftSave = useRef(true);

	const orderLocked = activeOrder?.status === SUPPLY_ORDER_STATUS.SUBMITTED;

	function applyActiveOrder(order) {
		setActiveOrder(order);
		if (order) {
			setCart(orderToCartItems(order));
			setLocation(order.location || DEFAULT_INVENTORY_LOCATION);
			setNotes(order.notes || '');
		} else {
			setCart([]);
			setNotes('');
			setLocation(DEFAULT_INVENTORY_LOCATION);
		}
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
			const [productsJson, inventoryJson, activeJson] = await Promise.all([
				fetchJson('/api/supplies/products'),
				fetchJson('/api/supplies/inventory'),
				fetchJson('/api/supplies/orders/active'),
			]);
			setProducts(productsJson?.data || []);
			setInventory(inventoryJson?.data || []);
			skipDraftSave.current = true;
			applyActiveOrder(activeJson?.data || null);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	const saveDraft = useCallback(async () => {
		if (orderLocked) return;
		setSavingDraft(true);
		try {
			const json = await fetchJson('/api/supplies/orders/active', {
				method: 'PUT',
				body: { items: cart, location, notes },
			});
			setActiveOrder(json?.data || null);
		} catch (err) {
			console.error('Draft save failed:', err.message);
		} finally {
			setSavingDraft(false);
		}
	}, [cart, location, notes, orderLocked]);

	useEffect(() => {
		if (skipDraftSave.current) {
			skipDraftSave.current = false;
			return undefined;
		}
		if (orderLocked) return undefined;
		const timer = setTimeout(() => { saveDraft(); }, 500);
		return () => clearTimeout(timer);
	}, [cart, location, notes, orderLocked, saveDraft]);

	const productsById = useMemo(
		() => Object.fromEntries(products.map((p) => [p.id, p])),
		[products],
	);

	const locations = useMemo(() => {
		const fromInventory = inventory.map((i) => i.location).filter(Boolean);
		return [...new Set([DEFAULT_INVENTORY_LOCATION, ...fromInventory])].sort();
	}, [inventory]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return products.filter((p) => {
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

	async function submitOrder() {
		if (!cart.length || orderLocked) return;
		setSubmitting(true);
		try {
			let orderId = activeOrder?.id;
			if (!orderId || activeOrder?.status !== SUPPLY_ORDER_STATUS.DRAFT) {
				const saved = await fetchJson('/api/supplies/orders/active', {
					method: 'PUT',
					body: { items: cart, location, notes },
				});
				orderId = saved?.data?.id;
			}
			if (!orderId) throw new Error('Could not save order draft');
			const json = await fetchJson(`/api/supplies/orders/${orderId}/submit`, { method: 'POST' });
			applyActiveOrder(json?.data || null);
			setCartOpen(true);
		} catch (err) {
			alert('Order failed: ' + err.message);
		} finally {
			setSubmitting(false);
		}
	}

	async function deliverOrder() {
		if (!activeOrder?.id || !orderLocked) return;
		setDelivering(true);
		try {
			await fetchJson(`/api/supplies/orders/${activeOrder.id}/deliver`, { method: 'POST' });
			skipDraftSave.current = true;
			applyActiveOrder(null);
			setCartOpen(false);
			await load();
		} catch (err) {
			alert('Delivery failed: ' + err.message);
		} finally {
			setDelivering(false);
		}
	}

	const cartCount = cart.reduce((n, c) => n + c.quantity, 0);

	return (
		<>
			<Head><title>Supply Order — Supplies — Hello Neighbor</title></Head>
			<Layout title="">
				<div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						<h1 className="text-xl sm:text-2xl font-bold text-dark">Supply Order</h1>
						{orderLocked && (
							<p className="text-sm text-amber-700 mt-1 flex items-center gap-1.5">
								<PackageCheck size={14} />
								An order is awaiting delivery. Mark it delivered to start a new cart.
							</p>
						)}
						{!orderLocked && savingDraft && (
							<p className="text-xs text-muted mt-1">Saving cart…</p>
						)}
					</div>
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
							<ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
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
							{orderLocked ? 'Invoice' : 'Cart'}
							{cartCount > 0 && (
								<span className="absolute -top-1.5 -right-1.5 bg-white text-brand-600 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
									{cartCount}
								</span>
							)}
						</button>
					</div>
				</div>

				{loading && <PageLoader message="Loading products…" />}
				{error && <ErrorState message={error} retry={load} />}
				{!loading && !error && (
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
					activeOrder={activeOrder}
					location={location}
					locations={locations}
					onLocationChange={setLocation}
					notes={notes}
					onNotesChange={setNotes}
					onQtyChange={changeQty}
					onRemove={removeFromCart}
					onClose={() => setCartOpen(false)}
					onSubmit={submitOrder}
					onDeliver={deliverOrder}
					submitting={submitting}
					delivering={delivering}
				/>
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
