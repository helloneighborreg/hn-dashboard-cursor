/** Format capture time for on-image stamp (local timezone). */
export function formatCaptureTimestamp(date = new Date()) {
	return date.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit',
	});
}

function loadImage(source) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = source;
	});
}

/** Downscale before upload — checklists include dozens of room photos per submission. */
export async function resizeImageDataUrl(dataUrl, maxDim = 1200, quality = 0.85) {
	const img = await loadImage(dataUrl);
	const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
	const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
	const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	ctx.drawImage(img, 0, 0, width, height);
	return {
		dataUrl: canvas.toDataURL('image/jpeg', quality),
		width,
		height,
	};
}

/** Draw white text with black outline in the bottom-left corner. */
export async function stampImageWithTimestamp(imageSource, capturedAt = new Date()) {
	const img = await loadImage(imageSource);
	const canvas = document.createElement('canvas');
	canvas.width = img.naturalWidth || img.width;
	canvas.height = img.naturalHeight || img.height;
	const ctx = canvas.getContext('2d');
	ctx.drawImage(img, 0, 0);

	const text = formatCaptureTimestamp(capturedAt);
	const padding = Math.max(12, Math.round(canvas.width * 0.02));
	const fontSize = Math.max(14, Math.round(canvas.width * 0.035));
	ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
	ctx.textBaseline = 'bottom';

	const x = padding;
	const y = canvas.height - padding;

	ctx.strokeStyle = '#000';
	ctx.lineWidth = Math.max(2, fontSize * 0.12);
	ctx.lineJoin = 'round';
	ctx.strokeText(text, x, y);
	ctx.fillStyle = '#fff';
	ctx.fillText(text, x, y);

	return {
		dataUrl: canvas.toDataURL('image/jpeg', 0.92),
		width: canvas.width,
		height: canvas.height,
	};
}

export function captureFrameFromVideo(video) {
	const canvas = document.createElement('canvas');
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;
	const ctx = canvas.getContext('2d');
	ctx.drawImage(video, 0, 0);
	return canvas.toDataURL('image/jpeg', 0.92);
}

export function dataUrlToBase64(dataUrl) {
	return String(dataUrl).split(',')[1] || '';
}

export async function buildCameraCaptureEntry(dataUrl, capturedAt = new Date()) {
	const resized = await resizeImageDataUrl(dataUrl);
	const stamped = await stampImageWithTimestamp(resized.dataUrl, capturedAt);
	const iso = capturedAt.toISOString();
	return {
		localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		filename: `photo-${iso.replace(/[:.]/g, '-')}.jpg`,
		contentType: 'image/jpeg',
		previewUrl: stamped.dataUrl,
		base64: dataUrlToBase64(stamped.dataUrl),
		capturedAt: iso,
		captureSource: 'camera',
		facingMode: 'environment',
		imageWidth: stamped.width,
		imageHeight: stamped.height,
	};
}

export async function openBackCameraStream() {
	if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
		throw new Error('Camera is not available in this browser. Open this form on your phone.');
	}

	const constraints = {
		video: {
			facingMode: { ideal: 'environment' },
			width: { ideal: 1920 },
			height: { ideal: 1080 },
		},
		audio: false,
	};

	return navigator.mediaDevices.getUserMedia(constraints);
}

export function stopMediaStream(stream) {
	if (!stream) return;
	for (const track of stream.getTracks()) {
		track.stop();
	}
}
