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

export const SUPPLY_ORDER_STATUS = {
	DRAFT: 'draft',
	SUBMITTED: 'submitted',
	DELIVERED: 'delivered',
};

export const DEFAULT_SALES_TAX_PERCENT = 7;

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

/** Line total — sale_price already includes the tax markup from cost. */
export function lineTotal(unitPrice, _salesTaxPercent, quantity) {
	const price = Number(unitPrice) || 0;
	const qty = Number(quantity) || 0;
	return price * qty;
}

export function orderTotal(items) {
	return (items || []).reduce(
		(sum, item) => sum + lineTotal(item.unit_price ?? item.sale_price, item.sales_tax_percent, item.quantity),
		0,
	);
}
