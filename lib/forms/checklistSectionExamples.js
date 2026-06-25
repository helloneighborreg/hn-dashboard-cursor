import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../supabase.js';
import {
	CHECKLIST_UPLOADS_BUCKET,
	getChecklistUploadPublicUrl,
} from './checklistFormStorage.js';

const ALLOWED_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/heic',
	'image/heif',
]);

function extensionFor(contentType, filename) {
	const map = {
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp',
		'image/gif': 'gif',
		'image/heic': 'heic',
		'image/heif': 'heif',
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

function mapRow(row) {
	return {
		id: row.id,
		section_id: row.section_id,
		url: getChecklistUploadPublicUrl(row.storage_path),
		filename: row.filename || null,
		content_type: row.content_type || null,
		sort_order: row.sort_order ?? 0,
	};
}

/** @returns {Promise<Record<string, Array<{ id, section_id, url, filename, content_type }>>>} */
export async function getSectionExamplesByForm(formSlug) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('form_checklist_section_examples')
		.select('id, section_id, storage_path, filename, content_type, sort_order')
		.eq('form_slug', formSlug)
		.order('section_id')
		.order('sort_order')
		.order('created_at');
	if (error) throw error;

	const grouped = {};
	for (const row of data || []) {
		const mapped = mapRow(row);
		if (!grouped[row.section_id]) grouped[row.section_id] = [];
		grouped[row.section_id].push(mapped);
	}
	return grouped;
}

export async function uploadSectionExample({
	formSlug,
	sectionId,
	base64,
	contentType,
	filename,
}) {
	if (!formSlug || !sectionId) throw new Error('formSlug and sectionId are required');
	if (!base64) throw new Error('No file data provided');
	if (!ALLOWED_TYPES.has(contentType)) {
		throw new Error('Unsupported file type. Use JPEG, PNG, WebP, GIF, or HEIC.');
	}

	const bytes = base64ToUint8Array(base64);
	if (bytes.length > 12 * 1024 * 1024) {
		throw new Error('File is too large (max 12 MB).');
	}

	const ext = extensionFor(contentType, filename);
	const storagePath = `_examples/${formSlug}/${sectionId}/${uuidv4()}.${ext}`;

	const supabase = getSupabase();
	const { error: uploadError } = await supabase.storage
		.from(CHECKLIST_UPLOADS_BUCKET)
		.upload(storagePath, bytes, { contentType, upsert: false });
	if (uploadError) throw uploadError;

	const { data: existing } = await supabase
		.from('form_checklist_section_examples')
		.select('sort_order')
		.eq('form_slug', formSlug)
		.eq('section_id', sectionId)
		.order('sort_order', { ascending: false })
		.limit(1)
		.maybeSingle();

	const sortOrder = (existing?.sort_order ?? -1) + 1;

	const { data, error } = await supabase
		.from('form_checklist_section_examples')
		.insert({
			form_slug: formSlug,
			section_id: sectionId,
			storage_path: storagePath,
			filename: filename || null,
			content_type: contentType,
			sort_order: sortOrder,
		})
		.select('id, section_id, storage_path, filename, content_type, sort_order')
		.single();
	if (error) throw error;

	return mapRow(data);
}

export async function deleteSectionExample({ id, formSlug }) {
	if (!id) throw new Error('Example id is required');

	const supabase = getSupabase();
	let query = supabase
		.from('form_checklist_section_examples')
		.select('id, storage_path')
		.eq('id', id);
	if (formSlug) query = query.eq('form_slug', formSlug);

	const { data: row, error: fetchError } = await query.maybeSingle();
	if (fetchError) throw fetchError;
	if (!row) {
		const err = new Error('Example photo not found');
		err.status = 404;
		throw err;
	}

	const { error: storageError } = await supabase.storage
		.from(CHECKLIST_UPLOADS_BUCKET)
		.remove([row.storage_path]);
	if (storageError) throw storageError;

	const { error: deleteError } = await supabase
		.from('form_checklist_section_examples')
		.delete()
		.eq('id', id);
	if (deleteError) throw deleteError;
}
