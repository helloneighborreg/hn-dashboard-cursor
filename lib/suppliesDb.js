import { getSupabase } from './supabase.js';
import { isDbConnectivityError, DB_UNREACHABLE_MESSAGE } from './db.js';
import { orderTotal, SUPPLY_ORDER_STATUS, isLocationDescendant, replaceLocationPathPrefix } from './supplies.js';

function throwDbError(error) {
	if (isDbConnectivityError(error)) {
		throw new Error(DB_UNREACHABLE_MESSAGE);
	}
	if (error?.code === 'PGRST205' && /supply_/i.test(String(error?.message || ''))) {
		throw new Error(
			'Supplies tables missing. In Supabase → SQL Editor, run supabase/migrations/20260622_supplies.sql',
		);
	}
	if (error?.code === '42501' && /supply_/i.test(String(error?.message || ''))) {
		throw new Error(
			'Supplies tables need permissions. In Supabase → SQL Editor, run supabase/migrations/20260625_supply_permissions.sql',
		);
	}
	throw error?.message ? new Error(error.message) : error;
}

function now() {
	return new Date().toISOString();
}

function mapProduct(row) {
	if (!row) return row;
	return {
		...row,
		cost: Number(row.cost ?? 0),
		sales_tax_percent: Number(row.sales_tax_percent ?? 0),
		sale_price: Number(row.sale_price ?? 0),
	};
}

export async function getSupplyProducts(filters = {}) {
	const supabase = getSupabase();
	let query = supabase.from('supply_products').select('*');
	if (filters.category) query = query.eq('category', filters.category);
	query = query.order('title', { ascending: true });
	const { data, error } = await query;
	if (error) throwDbError(error);
	return (data || []).map(mapProduct);
}

export async function getSupplyProductById(id) {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('supply_products').select('*').eq('id', id).maybeSingle();
	if (error) throwDbError(error);
	return mapProduct(data);
}

export async function createSupplyProduct(product) {
	const supabase = getSupabase();
	const record = {
		...product,
		created_at: now(),
		updated_at: now(),
	};
	const { data, error } = await supabase.from('supply_products').insert(record).select().single();
	if (error) throwDbError(error);
	return mapProduct(data);
}

export async function updateSupplyProduct(id, patch) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('supply_products')
		.update({ ...patch, updated_at: now() })
		.eq('id', id)
		.select()
		.single();
	if (error) throwDbError(error);
	return mapProduct(data);
}

export async function deleteSupplyProduct(id) {
	const supabase = getSupabase();
	const { data: orderItems, error: itemsError } = await supabase
		.from('supply_order_items')
		.select('id, order_id, supply_orders(status)')
		.eq('product_id', id);
	if (itemsError) throwDbError(itemsError);

	const blocked = (orderItems || []).filter(
		(item) => item.supply_orders?.status !== SUPPLY_ORDER_STATUS.DRAFT,
	);
	if (blocked.length) {
		throw new Error('This product is in a submitted or delivered order and cannot be deleted.');
	}

	if (orderItems?.length) {
		const { error: removeError } = await supabase
			.from('supply_order_items')
			.delete()
			.eq('product_id', id);
		if (removeError) throwDbError(removeError);

		const orderIds = [...new Set(orderItems.map((item) => item.order_id))];
		for (const orderId of orderIds) {
			const { data: remaining, error: remainingError } = await supabase
				.from('supply_order_items')
				.select('quantity, unit_price, sales_tax_percent')
				.eq('order_id', orderId);
			if (remainingError) throwDbError(remainingError);
			if (!remaining?.length) {
				await deleteSupplyOrder(orderId);
			} else {
				const total = orderTotal(remaining);
				const { error: updateError } = await supabase
					.from('supply_orders')
					.update({ total_amount: total })
					.eq('id', orderId);
				if (updateError) throwDbError(updateError);
			}
		}
	}

	const { error } = await supabase.from('supply_products').delete().eq('id', id);
	if (error) throwDbError(error);
}

export async function getSupplyInventory(filters = {}) {
	const supabase = getSupabase();
	let query = supabase
		.from('supply_inventory')
		.select('*, supply_products(*)');
	if (filters.location) query = query.eq('location', filters.location);
	if (filters.product_id) query = query.eq('product_id', filters.product_id);
	query = query.order('location', { ascending: true });
	const { data, error } = await query;
	if (error) throwDbError(error);
	return (data || []).map((row) => ({
		...row,
		quantity: Number(row.quantity ?? 0),
		product: mapProduct(row.supply_products),
	}));
}

export async function getSupplyInventoryById(id) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('supply_inventory')
		.select('*, supply_products(*)')
		.eq('id', id)
		.maybeSingle();
	if (error) throwDbError(error);
	if (!data) return null;
	return {
		...data,
		quantity: Number(data.quantity ?? 0),
		product: mapProduct(data.supply_products),
	};
}

export async function upsertSupplyInventory({ product_id, location, quantity }) {
	const supabase = getSupabase();
	const { data: existing, error: findError } = await supabase
		.from('supply_inventory')
		.select('*')
		.eq('product_id', product_id)
		.eq('location', location)
		.maybeSingle();
	if (findError) throwDbError(findError);

	if (existing) {
		const { data, error } = await supabase
			.from('supply_inventory')
			.update({ quantity, updated_at: now() })
			.eq('id', existing.id)
			.select('*, supply_products(*)')
			.single();
		if (error) throwDbError(error);
		return {
			...data,
			quantity: Number(data.quantity ?? 0),
			product: mapProduct(data.supply_products),
		};
	}

	const { data, error } = await supabase
		.from('supply_inventory')
		.insert({
			product_id,
			location,
			quantity,
			created_at: now(),
			updated_at: now(),
		})
		.select('*, supply_products(*)')
		.single();
	if (error) throwDbError(error);
	return {
		...data,
		quantity: Number(data.quantity ?? 0),
		product: mapProduct(data.supply_products),
	};
}

export async function updateSupplyInventory(id, patch) {
	const existing = await getSupplyInventoryById(id);
	if (!existing) throw new Error('Inventory item not found');

	const location = patch.location !== undefined ? String(patch.location).trim() : existing.location;
	const quantity = patch.quantity !== undefined
		? Math.max(0, parseInt(patch.quantity, 10) || 0)
		: existing.quantity;
	const product_id = patch.product_id ?? existing.product_id;

	if (!location) throw new Error('Location is required');
	if (!product_id) throw new Error('Product is required');

	const moved = location !== existing.location || product_id !== existing.product_id;
	if (moved) {
		const supabase = getSupabase();
		const { data: conflict, error: conflictError } = await supabase
			.from('supply_inventory')
			.select('*')
			.eq('product_id', product_id)
			.eq('location', location)
			.neq('id', id)
			.maybeSingle();
		if (conflictError) throwDbError(conflictError);

		if (conflict) {
			await upsertSupplyInventory({
				product_id,
				location,
				quantity: Number(conflict.quantity ?? 0) + quantity,
			});
			await deleteSupplyInventory(id);
			return getSupplyInventoryById(conflict.id);
		}
	}

	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('supply_inventory')
		.update({
			product_id,
			location,
			quantity,
			updated_at: now(),
		})
		.eq('id', id)
		.select('*, supply_products(*)')
		.single();
	if (error) throwDbError(error);
	return {
		...data,
		quantity: Number(data.quantity ?? 0),
		product: mapProduct(data.supply_products),
	};
}

export async function deleteSupplyInventory(id) {
	const supabase = getSupabase();
	const { error } = await supabase.from('supply_inventory').delete().eq('id', id);
	if (error) throwDbError(error);
}

async function moveInventoryRowsBetweenLocations(fromLoc, toLoc) {
	if (fromLoc === toLoc) return;

	const rows = await getSupplyInventory({ location: fromLoc });
	for (const row of rows) {
		const supabase = getSupabase();
		const { data: conflict, error: conflictError } = await supabase
			.from('supply_inventory')
			.select('*')
			.eq('product_id', row.product_id)
			.eq('location', toLoc)
			.maybeSingle();
		if (conflictError) throwDbError(conflictError);

		if (conflict) {
			await upsertSupplyInventory({
				product_id: row.product_id,
				location: toLoc,
				quantity: Number(conflict.quantity ?? 0) + Number(row.quantity ?? 0),
			});
			await deleteSupplyInventory(row.id);
		} else {
			await updateSupplyInventory(row.id, { location: toLoc });
		}
	}

	const supabase = getSupabase();
	const { error: ordersError } = await supabase
		.from('supply_orders')
		.update({ location: toLoc })
		.eq('location', fromLoc);
	if (ordersError) throwDbError(ordersError);
}

export async function renameSupplyInventoryLocation(from, to) {
	const fromLoc = String(from || '').trim();
	const toLoc = String(to || '').trim();
	if (!fromLoc || !toLoc) throw new Error('Location names are required');
	if (fromLoc === toLoc) return;

	const allRows = await getSupplyInventory();
	const affectedLocations = [...new Set(
		allRows.map((row) => row.location).filter((rowLoc) => isLocationDescendant(rowLoc, fromLoc)),
	)].sort((a, b) => b.length - a.length);

	for (const loc of affectedLocations) {
		const nextLoc = replaceLocationPathPrefix(loc, fromLoc, toLoc);
		await moveInventoryRowsBetweenLocations(loc, nextLoc);
	}
}

export async function deleteSupplyInventoryLocation(location) {
	const loc = String(location || '').trim();
	if (!loc) throw new Error('Location is required');

	const allRows = await getSupplyInventory();
	const affectedLocations = [...new Set(
		allRows.map((row) => row.location).filter((rowLoc) => isLocationDescendant(rowLoc, loc)),
	)];

	const supabase = getSupabase();
	for (const rowLoc of affectedLocations) {
		const { error } = await supabase.from('supply_inventory').delete().eq('location', rowLoc);
		if (error) throwDbError(error);
	}
}

export async function adjustSupplyInventory(product_id, location, delta) {
	const supabase = getSupabase();
	const { data: existing, error: findError } = await supabase
		.from('supply_inventory')
		.select('*')
		.eq('product_id', product_id)
		.eq('location', location)
		.maybeSingle();
	if (findError) throwDbError(findError);

	const nextQty = Math.max(0, Number(existing?.quantity ?? 0) + Number(delta));
	return upsertSupplyInventory({ product_id, location, quantity: nextQty });
}

function mapOrder(row) {
	if (!row) return row;
	return {
		...row,
		total_amount: Number(row.total_amount ?? 0),
		items: (row.supply_order_items || []).map((item) => ({
			...item,
			quantity: Number(item.quantity ?? 0),
			unit_price: Number(item.unit_price ?? 0),
			sales_tax_percent: Number(item.sales_tax_percent ?? 0),
			product: mapProduct(item.supply_products),
		})),
	};
}

const ORDER_WITH_ITEMS = '*, supply_order_items(*, supply_products(*))';

export async function getActiveSupplyOrder() {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('supply_orders')
		.select(ORDER_WITH_ITEMS)
		.in('status', [SUPPLY_ORDER_STATUS.DRAFT, SUPPLY_ORDER_STATUS.SUBMITTED])
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throwDbError(error);
	return mapOrder(data);
}

async function replaceSupplyOrderItems(orderId, items) {
	const supabase = getSupabase();
	const { error: deleteError } = await supabase
		.from('supply_order_items')
		.delete()
		.eq('order_id', orderId);
	if (deleteError) throwDbError(deleteError);
	if (!items?.length) return;

	const lineRows = items.map((item) => ({
		order_id: orderId,
		product_id: item.product_id,
		quantity: item.quantity,
		unit_price: item.unit_price,
		sales_tax_percent: item.sales_tax_percent,
	}));
	const { error: itemsError } = await supabase.from('supply_order_items').insert(lineRows);
	if (itemsError) throwDbError(itemsError);
}

async function deleteSupplyOrder(orderId) {
	const supabase = getSupabase();
	const { error } = await supabase.from('supply_orders').delete().eq('id', orderId);
	if (error) throwDbError(error);
}

export async function getSupplyOrderById(id) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('supply_orders')
		.select(ORDER_WITH_ITEMS)
		.eq('id', id)
		.maybeSingle();
	if (error) throwDbError(error);
	return mapOrder(data);
}

export async function saveSupplyDraft({ items, location, notes, property_id, property_name, created_by }) {
	const active = await getActiveSupplyOrder();
	if (active?.status === SUPPLY_ORDER_STATUS.SUBMITTED) {
		throw new Error('An order is awaiting delivery. Mark it delivered before starting a new cart.');
	}

	if (!items?.length) {
		if (active?.status === SUPPLY_ORDER_STATUS.DRAFT) {
			await deleteSupplyOrder(active.id);
		}
		return null;
	}

	const supabase = getSupabase();
	const total = orderTotal(items);
	const orderLocation = location || 'Warehouse';
	const orderNotes = notes || null;
	const orderPropertyId = property_id?.trim() || null;
	const orderPropertyName = property_name?.trim() || null;

	if (active?.status === SUPPLY_ORDER_STATUS.DRAFT) {
		const { error } = await supabase
			.from('supply_orders')
			.update({
				location: orderLocation,
				notes: orderNotes,
				property_id: orderPropertyId,
				property_name: orderPropertyName,
				total_amount: total,
			})
			.eq('id', active.id);
		if (error) throwDbError(error);
		await replaceSupplyOrderItems(active.id, items);
		return getActiveSupplyOrder();
	}

	const { data: order, error: orderError } = await supabase
		.from('supply_orders')
		.insert({
			status: SUPPLY_ORDER_STATUS.DRAFT,
			location: orderLocation,
			notes: orderNotes,
			property_id: orderPropertyId,
			property_name: orderPropertyName,
			created_by: created_by || null,
			total_amount: total,
			created_at: now(),
			submitted_at: null,
		})
		.select()
		.single();
	if (orderError) throwDbError(orderError);
	await replaceSupplyOrderItems(order.id, items);
	return getActiveSupplyOrder();
}

export async function submitSupplyOrder(orderId) {
	const supabase = getSupabase();
	const active = await getActiveSupplyOrder();
	if (!active || active.id !== orderId) {
		throw new Error('No active draft order found');
	}
	if (active.status !== SUPPLY_ORDER_STATUS.DRAFT) {
		throw new Error('Only draft orders can be submitted');
	}
	if (!active.items?.length) {
		throw new Error('Order must include at least one item');
	}
	if (!active.property_id) {
		throw new Error('Select a property before viewing the invoice');
	}

	const { data, error } = await supabase
		.from('supply_orders')
		.update({
			status: SUPPLY_ORDER_STATUS.SUBMITTED,
			submitted_at: now(),
		})
		.eq('id', orderId)
		.select(ORDER_WITH_ITEMS)
		.single();
	if (error) throwDbError(error);
	return mapOrder(data);
}

export async function deliverSupplyOrder(orderId) {
	const supabase = getSupabase();
	const { data: order, error: findError } = await supabase
		.from('supply_orders')
		.select(ORDER_WITH_ITEMS)
		.eq('id', orderId)
		.maybeSingle();
	if (findError) throwDbError(findError);
	if (!order) throw new Error('Order not found');
	if (order.status !== SUPPLY_ORDER_STATUS.SUBMITTED) {
		throw new Error('Only submitted orders can be marked delivered');
	}

	const items = (order.supply_order_items || []).map((item) => ({
		product_id: item.product_id,
		quantity: Number(item.quantity ?? 0),
	}));
	for (const item of items) {
		await adjustSupplyInventory(item.product_id, order.location || 'Warehouse', item.quantity);
	}

	const { data, error } = await supabase
		.from('supply_orders')
		.update({
			status: SUPPLY_ORDER_STATUS.DELIVERED,
			delivered_at: now(),
		})
		.eq('id', orderId)
		.select(ORDER_WITH_ITEMS)
		.single();
	if (error) throwDbError(error);
	return mapOrder(data);
}

/** @deprecated Use saveSupplyDraft + submitSupplyOrder + deliverSupplyOrder */
export async function createSupplyOrder({ items, location, notes, created_by }) {
	const draft = await saveSupplyDraft({ items, location, notes, created_by });
	if (!draft) throw new Error('Order must include at least one item');
	return submitSupplyOrder(draft.id);
}

export async function getSupplyOrders(limit = 50) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('supply_orders')
		.select('*, supply_order_items(*, supply_products(*))')
		.order('created_at', { ascending: false })
		.limit(limit);
	if (error) throwDbError(error);
	return (data || []).map(mapOrder);
}

