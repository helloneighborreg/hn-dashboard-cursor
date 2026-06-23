function readFileAsDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = () => reject(new Error('Could not read image file.'));
		reader.readAsDataURL(file);
	});
}

function loadImage(source, file) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(imageLoadErrorMessage(file)));
		img.src = source;
	});
}

function isHeicFile(file) {
	return /heic|heif/i.test(file?.type || '') || /\.hei[cf]$/i.test(file?.name || '');
}

function imageLoadErrorMessage(file) {
	if (isHeicFile(file)) {
		return 'HEIC photos are not supported in this browser. Use JPEG or PNG, or set iPhone camera format to Most Compatible.';
	}
	return 'Could not read image file. Use JPEG, PNG, or WebP.';
}

/** Resize a product image before upload to keep API payloads small. */
export async function resizeImageFile(file, maxDim = 800, quality = 0.85) {
	if (!file?.type?.startsWith('image/') && !/\.(jpe?g|png|webp|gif)$/i.test(file?.name || '')) {
		throw new Error('Please choose an image file (JPEG, PNG, or WebP).');
	}
	if (file.size > 12 * 1024 * 1024) {
		throw new Error('Image must be 12 MB or smaller.');
	}
	if (isHeicFile(file)) {
		throw new Error('HEIC photos are not supported in this browser. Use JPEG or PNG, or set iPhone camera format to Most Compatible.');
	}

	const dataUrl = await readFileAsDataUrl(file);
	const img = await loadImage(dataUrl, file);
	const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
	const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
	const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	ctx.drawImage(img, 0, 0, width, height);
	const contentType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
	const outDataUrl = canvas.toDataURL(contentType, quality);
	const base64 = outDataUrl.split(',')[1];
	const ext = contentType === 'image/png' ? 'png' : 'jpg';
	return {
		base64,
		contentType,
		filename: file.name.replace(/\.[^.]+$/, '') + '.' + ext,
	};
}

export async function uploadSupplyProductImage(file, productId) {
	const { base64, contentType, filename } = await resizeImageFile(file);
	const json = await fetch('/api/supplies/products/upload', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ base64, contentType, filename, product_id: productId || null }),
	}).then(async (res) => {
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || res.statusText || 'Upload failed');
		return data;
	});
	return json.data?.url;
}
