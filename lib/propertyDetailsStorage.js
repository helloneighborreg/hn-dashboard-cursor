import { getSupabase } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';

export const PROPERTY_BACKUP_IMAGES_BUCKET = 'property-backup-images';

function extensionFor(contentType, filename) {
	if (contentType === 'image/png') return 'png';
	if (contentType === 'image/webp') return 'webp';
	if (contentType === 'image/gif') return 'gif';
	const fromName = filename?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
	if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromName)) {
		return fromName === 'jpeg' ? 'jpg' : fromName;
	}
	return 'jpg';
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

export function getPropertyBackupImagePublicUrl(storagePath) {
	if (!storagePath) return null;
	const supabase = getSupabase();
	const { data } = supabase.storage.from(PROPERTY_BACKUP_IMAGES_BUCKET).getPublicUrl(storagePath);
	return data?.publicUrl || null;
}

export async function uploadPropertyBackupImage({ base64, contentType, filename, propertyId }) {
	if (!base64) throw new Error('No image data provided');
	const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
	if (!allowed.includes(contentType)) {
		throw new Error('Unsupported image type. Use JPEG, PNG, WebP, or GIF.');
	}

	const bytes = base64ToUint8Array(base64);
	if (bytes.length > 6 * 1024 * 1024) {
		throw new Error('Image is too large after processing (max 6 MB).');
	}

	const ext = extensionFor(contentType, filename);
	const folder = propertyId || 'pending';
	const storagePath = `${folder}/${uuidv4()}.${ext}`;

	const supabase = getSupabase();
	const { error } = await supabase.storage
		.from(PROPERTY_BACKUP_IMAGES_BUCKET)
		.upload(storagePath, bytes, { contentType, upsert: false });
	if (error) throw error;

	return {
		storage_path: storagePath,
		url: getPropertyBackupImagePublicUrl(storagePath),
	};
}
