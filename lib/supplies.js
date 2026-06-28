/** Supplies catalog categories and helpers. */

export const SUPPLY_CATEGORIES = [
	'Batteries',
	'Bathroom',
	'Beverages',
	'Cleaning',
	'Dish',
	'General',
	'Kitchen',
	'Office',
	'Paper Products',
	'Personal Care',
	'Seasoning',
	'Trash & Bags',
];

export const DEFAULT_INVENTORY_LOCATION = 'Warehouse';

/** Default delivery location to the billed property when still at warehouse default. */
export function resolveDeliveryLocation(location, propertyName) {
	const loc = String(location || '').trim();
	const prop = String(propertyName || '').trim();
	if (prop && (!loc || loc === DEFAULT_INVENTORY_LOCATION)) return prop;
	return loc || DEFAULT_INVENTORY_LOCATION;
}

/** Separator for nested inventory locations, e.g. "Garage › Tote A › Bin 1". */
export const LOCATION_PATH_SEPARATOR = ' › ';

export function parseLocationPath(path) {
	const value = String(path || '').trim();
	if (!value) return [];
	return value.split(LOCATION_PATH_SEPARATOR).map((part) => part.trim()).filter(Boolean);
}

export function formatLocationPath(parts) {
	return parts.map((part) => String(part).trim()).filter(Boolean).join(LOCATION_PATH_SEPARATOR);
}

export function getLocationLeafName(path) {
	const parts = parseLocationPath(path);
	return parts[parts.length - 1] || String(path || '').trim();
}

export function getLocationParentPath(path) {
	const parts = parseLocationPath(path);
	if (parts.length <= 1) return null;
	return formatLocationPath(parts.slice(0, -1));
}

export function joinLocationPath(parent, name) {
	const leaf = String(name || '').trim();
	if (!leaf) return '';
	const parentPath = String(parent || '').trim();
	if (!parentPath) return leaf;
	return formatLocationPath([...parseLocationPath(parentPath), leaf]);
}

/** Sub-location path for items stored inside a container (tote, bin, etc.). */
export function getInventoryContainerPath(item) {
	const title = item?.product?.title?.trim();
	if (!title || !item?.location) return null;
	return joinLocationPath(item.location, title);
}

export function isLocationDescendant(path, ancestor) {
	const value = String(path || '').trim();
	const prefix = String(ancestor || '').trim();
	if (!value || !prefix) return false;
	if (value === prefix) return true;
	return value.startsWith(`${prefix}${LOCATION_PATH_SEPARATOR}`);
}

export function replaceLocationPathPrefix(path, fromPrefix, toPrefix) {
	const value = String(path || '').trim();
	const from = String(fromPrefix || '').trim();
	const to = String(toPrefix || '').trim();
	if (value === from) return to;
	if (!isLocationDescendant(value, from)) return value;
	return `${to}${value.slice(from.length)}`;
}

export function sortLocationPaths(paths) {
	return [...paths].sort((a, b) => {
		const aParts = parseLocationPath(a);
		const bParts = parseLocationPath(b);
		const len = Math.min(aParts.length, bParts.length);
		for (let i = 0; i < len; i += 1) {
			const cmp = aParts[i].localeCompare(bParts[i], undefined, { sensitivity: 'base' });
			if (cmp !== 0) return cmp;
		}
		return aParts.length - bParts.length;
	});
}

/** Immediate child locations under a parent path (empty parent = top level). */
export function getDirectChildLocations(parentPath, paths) {
	const parent = String(parentPath || '').trim();
	const parentDepth = parent ? parseLocationPath(parent).length : 0;
	return sortLocationPaths((paths || []).filter((loc) => {
		const parts = parseLocationPath(loc);
		if (parts.length !== parentDepth + 1) return false;
		if (!parent) return true;
		return formatLocationPath(parts.slice(0, parentDepth)) === parent;
	}));
}

/** Build a tree of location nodes from flat path strings (creates implicit parent nodes). */
export function buildLocationTree(paths) {
	const sorted = sortLocationPaths([...new Set((paths || []).filter(Boolean))]);
	const byPath = new Map();
	const roots = [];

	function ensureNode(path) {
		if (byPath.has(path)) return byPath.get(path);
		const parts = parseLocationPath(path);
		const parentPath = parts.length > 1 ? formatLocationPath(parts.slice(0, -1)) : null;
		const node = {
			path,
			name: parts[parts.length - 1],
			parentPath,
			depth: parts.length - 1,
			children: [],
		};
		byPath.set(path, node);

		if (parentPath) {
			const parent = ensureNode(parentPath);
			if (!parent.children.some((child) => child.path === path)) {
				parent.children.push(node);
			}
		} else if (!roots.some((root) => root.path === path)) {
			roots.push(node);
		}
		return node;
	}

	for (const path of sorted) {
		ensureNode(path);
	}

	function sortChildren(node) {
		node.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
		node.children.forEach(sortChildren);
	}
	roots.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
	roots.forEach(sortChildren);
	return roots;
}

/** One-off inventory items — not shown on the supplies order catalog. */
export const INVENTORY_ONLY_CATEGORY = 'Inventory Only';

export function isInventoryOnlyProduct(product) {
	return product?.category === INVENTORY_ONLY_CATEGORY;
}

export const SUPPLY_ORDER_STATUS = {
	DRAFT: 'draft',
	SUBMITTED: 'submitted',
	DELIVERED: 'delivered',
};

export const DEFAULT_SALES_TAX_PERCENT = 7;

export const SUPPLY_MARKUP_SETTINGS_KEY = 'supply_markup_percent';

export const DEFAULT_SUPPLY_MARKUP_PERCENT = 0;

export function parseMarkupPercent(value) {
	if (value === '' || value == null) return DEFAULT_SUPPLY_MARKUP_PERCENT;
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0) return DEFAULT_SUPPLY_MARKUP_PERCENT;
	return n;
}

/** Billable unit price with markup baked in (not shown as a separate line). */
export function pricedUnit(unitPrice, markupPercent = DEFAULT_SUPPLY_MARKUP_PERCENT) {
	const price = Number(unitPrice) || 0;
	const markup = parseMarkupPercent(markupPercent);
	return price * (1 + markup / 100);
}

/** Tax % for pricing; blank on new products defaults to 7%. */
export function effectiveTaxPercent(salesTaxPercent, { isNewProduct = false } = {}) {
	if (salesTaxPercent === '' || salesTaxPercent == null) {
		return isNewProduct ? DEFAULT_SALES_TAX_PERCENT : 0;
	}
	const tax = Number(salesTaxPercent);
	if (!Number.isFinite(tax)) return isNewProduct ? DEFAULT_SALES_TAX_PERCENT : 0;
	return tax;
}

/** Unit sale price from cost plus tax markup (e.g. $10 cost + 7% → $10.70). */
export function salePriceFromCost(cost, salesTaxPercent = DEFAULT_SALES_TAX_PERCENT, { isNewProduct = false } = {}) {
	const c = Number(cost);
	if (!Number.isFinite(c) || c < 0) return null;
	const tax = effectiveTaxPercent(salesTaxPercent, { isNewProduct });
	return (c * (1 + tax / 100)).toFixed(2);
}

/** Prefer explicit sale price; otherwise derive from cost + tax. */
export function resolveProductSalePrice({ cost, sales_tax_percent, sale_price }, { isNewProduct = false } = {}) {
	const costNum = parseFloat(cost) || 0;
	const tax = effectiveTaxPercent(sales_tax_percent, { isNewProduct });
	const manual = parseFloat(sale_price);
	if (Number.isFinite(manual) && manual > 0) return manual;
	const computed = salePriceFromCost(costNum, tax);
	return computed != null ? parseFloat(computed) : 0;
}

export function fmtSupplyPrice(amount) {
	const n = Number(amount);
	if (!Number.isFinite(n)) return '$0.00';
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

/** Line total — sale_price already includes tax; optional markup is baked into the amount. */
export function lineTotal(unitPrice, _salesTaxPercent, quantity, markupPercent = DEFAULT_SUPPLY_MARKUP_PERCENT) {
	const qty = Number(quantity) || 0;
	return pricedUnit(unitPrice, markupPercent) * qty;
}

export function orderTotal(items, markupPercent = DEFAULT_SUPPLY_MARKUP_PERCENT) {
	return (items || []).reduce(
		(sum, item) => sum + lineTotal(
			item.unit_price ?? item.sale_price,
			item.sales_tax_percent,
			item.quantity,
			markupPercent,
		),
		0,
	);
}

export function supplyInvoicePdfUrl(orderId) {
	return `/api/supplies/orders/${orderId}/pdf`;
}

export function isCustomSupplyCartItem(item) {
	return Boolean(String(item?.custom_title || '').trim());
}

export function supplyCartLineKey(item) {
	if (item?.product_id) return `p:${item.product_id}`;
	return `c:${String(item?.custom_title || '').trim().toLowerCase()}`;
}

export function supplyCartLineTitle(item, product) {
	if (isCustomSupplyCartItem(item)) return String(item.custom_title).trim();
	return product?.title || 'Unknown';
}
