import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../supabase.js';

export const CHECKLIST_UPLOADS_BUCKET = 'form-checklist-uploads';

function extensionFor(contentType, filename) {
	const map = {
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp',
		'image/gif': 'gif',
		'image/heic': 'heic',
		'image/heif': 'heif',
		'application/pdf': 'pdf',
	};
	if (map[contentType]) return map[contentType];
	const fromName = filename?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
	if (fromName) return fromName === 'jpeg' ? 'jpg' : fromName;
	return 'bin';
}

function base64ToUint8Array(base64) {
	if (typeof Buffer !== 'undefined') {
		return new Uint8Array(Buffer.from(base64, 'base64'));
	}
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

const ALLOWED_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/heic',
	'image/heif',
	'application/pdf',
]);

export function getChecklistUploadPublicUrl(storagePath) {
	if (!storagePath) return null;
	const supabase = getSupabase();
	const { data } = supabase.storage.from(CHECKLIST_UPLOADS_BUCKET).getPublicUrl(storagePath);
	return data?.publicUrl || null;
}

export async function uploadChecklistFile({
	base64,
	contentType,
	filename,
	submissionId,
	questionId,
	capturedAt = null,
	captureSource = null,
	facingMode = null,
	imageWidth = null,
	imageHeight = null,
}) {
	if (!base64) throw new Error('No file data provided');
	if (!ALLOWED_TYPES.has(contentType)) {
		throw new Error('Unsupported file type. Use JPEG, PNG, WebP, GIF, HEIC, or PDF.');
	}

	const bytes = base64ToUint8Array(base64);
	if (bytes.length > 12 * 1024 * 1024) {
		throw new Error('File is too large (max 12 MB).');
	}

	const ext = extensionFor(contentType, filename);
	const folder = submissionId || 'pending';
	const storagePath = `${folder}/${questionId}/${uuidv4()}.${ext}`;

	const storageMetadata = {};
	if (capturedAt) storageMetadata.captured_at = String(capturedAt);
	if (captureSource) storageMetadata.capture_source = String(captureSource);
	if (facingMode) storageMetadata.facing_mode = String(facingMode);
	if (imageWidth != null) storageMetadata.image_width = String(imageWidth);
	if (imageHeight != null) storageMetadata.image_height = String(imageHeight);

	const supabase = getSupabase();
	const { error } = await supabase.storage
		.from(CHECKLIST_UPLOADS_BUCKET)
		.upload(storagePath, bytes, {
			contentType,
			upsert: false,
			...(Object.keys(storageMetadata).length ? { metadata: storageMetadata } : {}),
		});
	if (error) throw error;

	return {
		storage_path: storagePath,
		url: getChecklistUploadPublicUrl(storagePath),
		filename: filename || null,
		content_type: contentType,
		captured_at: capturedAt || null,
		capture_source: captureSource || null,
		facing_mode: facingMode || null,
		image_width: imageWidth ?? null,
		image_height: imageHeight ?? null,
	};
}
