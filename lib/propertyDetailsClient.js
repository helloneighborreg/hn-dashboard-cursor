/** Resize a backup lockbox image before upload to keep API payloads small. */
export function resizeImageFile(file, maxDim = 1200, quality = 0.85) {
	return new Promise((resolve, reject) => {
		if (!file?.type?.startsWith('image/')) {
			reject(new Error('Please choose an image file (JPEG, PNG, or WebP).'));
			return;
		}
		if (file.size > 12 * 1024 * 1024) {
			reject(new Error('Image must be 12 MB or smaller.'));
			return;
		}

		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
			const width = Math.max(1, Math.round(img.width * scale));
			const height = Math.max(1, Math.round(img.height * scale));
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0, width, height);
			const dataUrl = canvas.toDataURL('image/jpeg', quality);
			const base64 = dataUrl.split(',')[1];
			const ext = file.type === 'image/png' ? 'png' : 'jpg';
			const contentType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
			resolve({
				base64,
				contentType,
				filename: file.name.replace(/\.[^.]+$/, '') + '.' + ext,
			});
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Could not read image file.'));
		};
		img.src = url;
	});
}

export async function uploadPropertyBackupImage(file, propertyId) {
	const { base64, contentType, filename } = await resizeImageFile(file);
	const res = await fetch(`/api/properties/${propertyId}/details/upload`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ base64, contentType, filename }),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || res.statusText || 'Upload failed');
	return data.data;
}
