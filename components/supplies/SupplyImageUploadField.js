import { useRef } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { Package, Loader2, ImagePlus } from 'lucide-react';
import { uploadSupplyProductImage } from '../../lib/supplyImageClient';

export default function SupplyImageUploadField({
	label = 'Image',
	imageUrl,
	onImageUrlChange,
	productId,
	uploading,
	onUploadingChange,
	onError,
	showUrlInput = true,
}) {
	const fileRef = useRef(null);
	const dragDepthRef = useRef(0);

	async function uploadImageFile(file) {
		if (!file?.type?.startsWith('image/')) {
			onError?.('Please choose an image file (JPEG, PNG, or WebP).');
			return;
		}
		onError?.('');
		onUploadingChange?.(true);
		try {
			const url = await uploadSupplyProductImage(file, productId);
			onImageUrlChange(url);
		} catch (uploadErr) {
			onError?.(uploadErr.message);
		} finally {
			onUploadingChange?.(false);
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
	}

	function handleDragLeave(e) {
		e.preventDefault();
		e.stopPropagation();
		dragDepthRef.current -= 1;
	}

	function handleDragOver(e) {
		e.preventDefault();
		e.stopPropagation();
	}

	async function handleDrop(e) {
		e.preventDefault();
		e.stopPropagation();
		dragDepthRef.current = 0;
		if (uploading) return;
		const file = e.dataTransfer?.files?.[0];
		if (file) await uploadImageFile(file);
	}

	function openFilePicker() {
		if (!uploading) fileRef.current?.click();
	}

	return (
		<div>
			<label className="label" id="supply-image-upload-label">{label}</label>
			<input
				ref={fileRef}
				type="file"
				accept="image/jpeg,image/png,image/webp,image/gif"
				className="sr-only"
				aria-labelledby="supply-image-upload-label"
				onChange={handleImagePick}
			/>
			<div
				role="button"
				tabIndex={0}
				aria-label={`Upload ${label.toLowerCase()}`}
				className={clsx(
					'rounded-xl border-2 border-dashed p-4 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
					'border-border bg-gray-50/60 hover:bg-gray-50',
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
						{imageUrl ? (
							<Image
								src={imageUrl}
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
			{showUrlInput && (
				<div className="mt-3">
					<label className="label">Or paste image URL</label>
					<input
						className="input"
						type="url"
						placeholder="https://..."
						value={imageUrl || ''}
						onChange={(e) => onImageUrlChange(e.target.value)}
					/>
				</div>
			)}
		</div>
	);
}
