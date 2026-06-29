import { useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowLeft, ChevronDown, ImagePlus, Loader2, Settings, Trash2 } from 'lucide-react';
import Layout from '../../../components/Layout';
import { fetchJson } from '../../../lib/apiClient';
import { requireAuth, isAdmin } from '../../../lib/auth';
import {
	buildExamplePhotoRoomGroups,
	KWD_TURN_CLEAN_FORM,
	KWD_TURN_CLEAN_FORM_SLUG,
} from '../../../lib/forms/kwdTurnCleanChecklist';
import { getSectionExamplesByForm } from '../../../lib/forms/checklistSectionExamples';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

function readFileAsBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result || '');
			const base64 = result.includes(',') ? result.split(',')[1] : result;
			resolve(base64);
		};
		reader.onerror = () => reject(new Error('Could not read file'));
		reader.readAsDataURL(file);
	});
}

function SectionExampleManager({ section, photos, onUploaded, onDeleted }) {
	const inputRef = useRef(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState('');
	const [deletingId, setDeletingId] = useState(null);

	async function handleFiles(fileList) {
		const files = [...(fileList || [])].filter((file) => ACCEPTED_TYPES.includes(file.type));
		if (!files.length) {
			setError('Choose a JPEG, PNG, WebP, GIF, or HEIC image.');
			return;
		}

		setUploading(true);
		setError('');
		try {
			for (const file of files) {
				const base64 = await readFileAsBase64(file);
				const json = await fetchJson('/api/forms/kwd-turn-clean-checklist/examples', {
					method: 'POST',
					body: {
						section_id: section.id,
						base64,
						contentType: file.type,
						filename: file.name,
					},
				});
				onUploaded(section.id, json.data);
			}
		} catch (err) {
			setError(err.message || 'Upload failed');
		} finally {
			setUploading(false);
			if (inputRef.current) inputRef.current.value = '';
		}
	}

	async function handleDelete(photoId) {
		if (!window.confirm('Remove this example photo?')) return;
		setDeletingId(photoId);
		setError('');
		try {
			await fetchJson('/api/forms/kwd-turn-clean-checklist/examples', {
				method: 'DELETE',
				body: { id: photoId },
			});
			onDeleted(section.id, photoId);
		} catch (err) {
			setError(err.message || 'Delete failed');
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<div className="rounded-lg border border-border bg-gray-50/40 p-4 space-y-3">
			<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
				<div>
					<h3 className="text-sm font-medium text-dark">{section.title}</h3>
					<p className="text-xs text-muted mt-0.5">Shown on every checklist in this section.</p>
				</div>
				<div className="shrink-0">
					<input
						ref={inputRef}
						type="file"
						accept={ACCEPTED_TYPES.join(',')}
						multiple
						className="hidden"
						onChange={(e) => handleFiles(e.target.files)}
					/>
					<button
						type="button"
						className="btn-secondary text-sm inline-flex items-center gap-1.5"
						disabled={uploading}
						onClick={() => inputRef.current?.click()}
					>
						{uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
						{uploading ? 'Uploading…' : 'Add photo'}
					</button>
				</div>
			</div>

			{error && (
				<p className="text-xs text-red-600">{error}</p>
			)}

			{photos.length ? (
				<div className="flex flex-wrap gap-3">
					{photos.map((photo) => (
						<div key={photo.id} className="relative group">
							<img
								src={photo.url}
								alt={photo.filename || 'Example photo'}
								className="h-24 w-24 object-cover rounded-md border border-border bg-white"
							/>
							<button
								type="button"
								className="absolute -top-2 -right-2 rounded-full bg-white border border-border p-1 text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
								disabled={deletingId === photo.id}
								onClick={() => handleDelete(photo.id)}
								aria-label="Remove example photo"
							>
								{deletingId === photo.id ? (
									<Loader2 size={12} className="animate-spin" />
								) : (
									<Trash2 size={12} />
								)}
							</button>
						</div>
					))}
				</div>
			) : (
				<p className="text-xs text-muted">No example photos yet.</p>
			)}
		</div>
	);
}

function RoomExampleGroup({ group, index, examples, onUploaded, onDeleted, open, onToggle }) {
	const withPhotos = group.sections.filter((section) => (examples[section.id] || []).length > 0).length;

	return (
		<div className="card overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
			>
				<span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex-shrink-0">
					{index + 1}
				</span>
				<span className="flex-1 min-w-0">
					<span className="block font-medium text-sm text-dark">{group.title}</span>
					<span className="block text-xs text-muted mt-0.5">
						{withPhotos}/{group.sections.length} area{group.sections.length === 1 ? '' : 's'} with photos
					</span>
				</span>
				<ChevronDown size={16} className={clsx('text-muted transition-transform shrink-0', open && 'rotate-180')} />
			</button>
			{open && (
				<div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
					{group.sections.map((section) => (
						<SectionExampleManager
							key={section.id}
							section={section}
							photos={examples[section.id] || []}
							onUploaded={onUploaded}
							onDeleted={onDeleted}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export default function CjcChecklistExamplesPage({ initialExamples = {}, dbError = null }) {
	const roomGroups = useMemo(() => buildExamplePhotoRoomGroups(), []);
	const [examples, setExamples] = useState(initialExamples);
	const [openRoomId, setOpenRoomId] = useState(roomGroups[0]?.id || null);

	function handleUploaded(sectionId, photo) {
		setExamples((prev) => ({
			...prev,
			[sectionId]: [...(prev[sectionId] || []), photo],
		}));
	}

	function handleDeleted(sectionId, photoId) {
		setExamples((prev) => ({
			...prev,
			[sectionId]: (prev[sectionId] || []).filter((photo) => photo.id !== photoId),
		}));
	}

	return (
		<Layout title="">
			<Head>
				<title>Manage Example Photos — {KWD_TURN_CLEAN_FORM.name}</title>
			</Head>
			<div className="max-w-3xl mx-auto">
				<div className="mb-6">
					<Link
						href="/forms/kwd-turn-clean-checklist"
						className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-dark mb-3"
					>
						<ArrowLeft size={14} />
						Checklist
					</Link>
					<div className="flex items-center gap-2.5">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0">
							<Settings size={20} strokeWidth={1.75} />
						</div>
						<h1 className="text-2xl font-bold text-dark">Manage Example Photos</h1>
					</div>
					<p className="text-sm text-muted mt-2">
						Upload reference photos for required questions.
					</p>
				</div>

				{dbError && (
					<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{dbError}
					</div>
				)}

				<div className="space-y-3">
					{roomGroups.map((group, index) => (
						<RoomExampleGroup
							key={group.id}
							group={group}
							index={index}
							examples={examples}
							onUploaded={handleUploaded}
							onDeleted={handleDeleted}
							open={openRoomId === group.id}
							onToggle={() => setOpenRoomId((cur) => (cur === group.id ? null : group.id))}
						/>
					))}
				</div>
			</div>
		</Layout>
	);
}

export const getServerSideProps = requireAuth(async (_context, session) => {
	if (!isAdmin(session.user)) {
		return {
			redirect: {
				destination: '/forms/kwd-turn-clean-checklist',
				permanent: false,
			},
		};
	}

	let initialExamples = {};
	let dbError = null;
	try {
		initialExamples = await getSectionExamplesByForm(KWD_TURN_CLEAN_FORM_SLUG);
	} catch (err) {
		const message = err?.message || '';
		if (/form_checklist_section_examples/i.test(message) && /does not exist|PGRST205/i.test(message)) {
			dbError = 'Example photos table is not configured yet. Run supabase/migrations/20260630_checklist_section_examples.sql in Supabase.';
		} else {
			throw err;
		}
	}

	return {
		props: {
			initialExamples,
			dbError,
		},
	};
});
