import { useState, useRef } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { X, Package, Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { DEFAULT_SALES_TAX_PERCENT, SUPPLY_CATEGORIES, effectiveTaxPercent, resolveProductSalePrice, salePriceFromCost } from '../../lib/supplies';
import { fetchJson } from '../../lib/apiClient';
import { uploadSupplyProductImage } from '../../lib/supplyImageClient';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';

const EMPTY = {
	title: '',
	category: 'General',
	image_url: '',
	cost: '',
	sales_tax_percent: String(DEFAULT_SALES_TAX_PERCENT),
	sale_price: '',
};

export default function SupplyProductModal({ product, onClose, onSaved, onDeleted }) {
	const isEdit = Boolean(product?.id);
	const [form, setForm] = useState(
		product
			? {
				title: product.title || '',
				category: product.category || 'General',
				image_url: product.image_url || '',
				cost: String(product.cost ?? ''),
				sales_tax_percent: String(product.sales_tax_percent ?? ''),
				sale_price: String(product.sale_price ?? ''),
			}
			: { ...EMPTY },
	);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [err, setErr] = useState('');
	const fileRef = useRef(null);
	const dragDepthRef = useRef(0);
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();

	async function uploadImageFile(file) {
		if (!file?.type?.startsWith('image/')) {
			setErr('Please choose an image file (JPEG, PNG, or WebP).');
			return;
		}
		setErr('');
		setUploading(true);
		try {
			const url = await uploadSupplyProductImage(file, product?.id);
			setForm((f) => ({ ...f, image_url: url }));
		} catch (uploadErr) {
			setErr(uploadErr.message);
		} finally {
			setUploading(false);
		}
	}

	async function handleImagePick(e) {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;
		await uploadImageFile(file);
	}

	function handleDragEnter(e) {
		e.preventDefault();
		e.stopPropagation();
		dragDepthRef.current += 1;
		setDragging(true);
	}

	function handleDragLeave(e) {
		e.preventDefault();
		e.stopPropagation();
		dragDepthRef.current -= 1;
		if (dragDepthRef.current <= 0) {
			dragDepthRef.current = 0;
			setDragging(false);
		}
	}

	function handleDragOver(e) {
		e.preventDefault();
		e.stopPropagation();
	}

	async function handleDrop(e) {
		e.preventDefault();
		e.stopPropagation();
		dragDepthRef.current = 0;
		setDragging(false);
		if (uploading) return;
		const file = e.dataTransfer?.files?.[0];
		if (file) await uploadImageFile(file);
	}

	function openFilePicker() {
		if (!uploading) fileRef.current?.click();
	}

	function applyPricing(nextCost, nextTax, currentSalePrice) {
		const sale = salePriceFromCost(nextCost, nextTax, { isNewProduct: !isEdit });
		return sale != null ? sale : currentSalePrice;
	}

	function handleCostBlur(cost) {
		setForm((f) => ({
			...f,
			cost,
			sale_price: applyPricing(cost, f.sales_tax_percent, f.sale_price),
		}));
	}

	function handleCostChange(cost) {
		setForm((f) => ({
			...f,
			cost,
			sale_price: applyPricing(cost, f.sales_tax_percent, f.sale_price),
		}));
	}

	function handleTaxChange(sales_tax_percent) {
		setForm((f) => ({
			...f,
			sales_tax_percent,
			sale_price: applyPricing(f.cost, sales_tax_percent, f.sale_price),
		}));
	}

	function handleTaxBlur(sales_tax_percent) {
		setForm((f) => ({
			...f,
			sales_tax_percent,
			sale_price: applyPricing(f.cost, sales_tax_percent, f.sale_price),
		}));
	}

	async function submit(e) {
		e.preventDefault();
		setErr('');
		if (!form.title.trim()) {
			setErr('Title is required');
			return;
		}
		setSaving(true);
		try {
			const taxPercent = effectiveTaxPercent(form.sales_tax_percent, { isNewProduct: !isEdit });
			const body = {
				title: form.title.trim(),
				category: form.category,
				image_url: form.image_url.trim() || null,
				cost: parseFloat(form.cost) || 0,
				sales_tax_percent: taxPercent,
				sale_price: resolveProductSalePrice(
					{ cost: form.cost, sales_tax_percent: form.sales_tax_percent, sale_price: form.sale_price },
					{ isNewProduct: !isEdit },
				),
			};
			if (isEdit) {
				await fetchJson(`/api/supplies/products/${product.id}`, { method: 'PATCH', body });
			} else {
				await fetchJson('/api/supplies/products', { method: 'POST', body });
			}
			onSaved?.();
			onClose();
		} catch (e) {
			setErr(e.message);
		} finally {
			setSaving(false);
		}
	}

	async function remove() {
		if (!isEdit) return;
		setErr('');
		setDeleting(true);
		try {
			await fetchJson(`/api/supplies/products/${product.id}`, { method: 'DELETE' });
			onDeleted?.(product.id);
			onClose();
		} catch (e) {
			setErr(e.message);
		} finally {
			setDeleting(false);
			setConfirmDelete(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={isEdit ? 'Edit product' : 'Add product'}
				className="bg-white rounded-2xl shadow-2xl w-full max-w-lg focus:outline-none max-h-[90vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-white z-10">
					<h2 className="font-semibold text-dark">{isEdit ? 'Edit Product' : 'Add Product'}</h2>
					<button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-dark">
						<X size={18} />
					</button>
				</div>
				<form onSubmit={submit} className="p-5 space-y-4">
					<div>
						<label className="label" id="supply-product-image-label">Product image</label>
						<input
							ref={fileRef}
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							className="sr-only"
							aria-labelledby="supply-product-image-label"
							onChange={handleImagePick}
						/>
						<div
							role="button"
							tabIndex={0}
							aria-label="Upload product image"
							className={clsx(
								'rounded-xl border-2 border-dashed p-4 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
								dragging
									? 'border-brand-400 bg-brand-50'
									: 'border-border bg-gray-50/60 hover:bg-gray-50',
								uploading && 'pointer-events-none opacity-70',
							)}
							onClick={openFilePicker}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									openFilePicker();
								}
							}}
							onDragEnter={handleDragEnter}
							onDragLeave={handleDragLeave}
							onDragOver={handleDragOver}
							onDrop={handleDrop}
						>
							<div className="flex items-center gap-4">
								<div className="relative w-24 h-24 rounded-xl bg-white border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
									{form.image_url ? (
										<Image
											src={form.image_url}
											alt="Preview"
											fill
											sizes="96px"
											className="object-contain"
										/>
									) : (
										<Package size={32} className="text-brand-300" strokeWidth={1.25} />
									)}
									{uploading && (
										<div className="absolute inset-0 bg-white/80 flex items-center justify-center">
											<Loader2 size={20} className="animate-spin text-brand-500" />
										</div>
									)}
								</div>
								<div className="flex-1 min-w-0">
									{uploading ? (
										<p className="text-sm font-medium text-dark">Uploading…</p>
									) : dragging ? (
										<p className="text-sm font-medium text-brand-600">Drop image here</p>
									) : (
										<>
											<p className="text-sm font-medium text-dark flex items-center gap-1.5">
												<ImagePlus size={16} className="text-brand-500 flex-shrink-0" />
												Drag and drop an image
											</p>
											<p className="text-xs text-muted mt-1">
												or click to browse · JPEG, PNG, or WebP · max 12 MB
											</p>
										</>
									)}
								</div>
							</div>
						</div>
					</div>
					<div>
						<label className="label">Or paste image URL</label>
						<input
							className="input"
							type="url"
							placeholder="https://..."
							value={form.image_url}
							onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
						/>
					</div>
					<div>
						<label className="label">Title *</label>
						<input
							className="input"
							value={form.title}
							onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
							required
						/>
					</div>
					<div>
						<label className="label">Category</label>
						<select
							className="input"
							value={form.category}
							onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
						>
							{SUPPLY_CATEGORIES.map((cat) => (
								<option key={cat} value={cat}>{cat}</option>
							))}
						</select>
					</div>
					<div className="grid grid-cols-3 gap-3">
						<div>
							<label className="label">Cost</label>
							<input
								type="number"
								step="0.01"
								min="0"
								className="input"
								value={form.cost}
								onChange={(e) => handleCostChange(e.target.value)}
								onBlur={(e) => handleCostBlur(e.target.value)}
							/>
						</div>
						<div>
							<label className="label">Sales Tax %</label>
							<input
								type="number"
								step="0.01"
								min="0"
								className="input"
								value={form.sales_tax_percent}
								onChange={(e) => handleTaxChange(e.target.value)}
								onBlur={(e) => handleTaxBlur(e.target.value)}
							/>
						</div>
						<div>
							<label className="label">Sale Price</label>
							<input
								type="number"
								step="0.01"
								min="0"
								className="input"
								value={form.sale_price}
								onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
							/>
						</div>
					</div>
					{err && <p className="text-sm text-red-600">{err}</p>}
					<div className="flex gap-2 pt-2">
						<button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
						<button type="submit" disabled={saving || uploading} className="btn-primary flex-1">
							{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Product'}
						</button>
					</div>
					{isEdit && (
						<div className="pt-2 border-t border-border">
							{confirmDelete ? (
								<div className="space-y-2">
									<p className="text-sm text-amber-800">
										Delete this product? Inventory for this item will also be removed. This cannot be undone.
									</p>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={() => setConfirmDelete(false)}
											disabled={deleting}
											className="btn-secondary flex-1"
										>
											Cancel
										</button>
										<button
											type="button"
											onClick={remove}
											disabled={deleting}
											className={clsx('btn-danger flex-1', deleting && 'opacity-60')}
										>
											{deleting ? 'Deleting…' : 'Delete'}
										</button>
									</div>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setConfirmDelete(true)}
									className="btn-secondary w-full text-sm gap-2 inline-flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50"
								>
									<Trash2 size={16} />
									Delete product
								</button>
							)}
						</div>
					)}
				</form>
			</div>
		</div>
	);
}
