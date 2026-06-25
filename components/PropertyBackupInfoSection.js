import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import DateInput from './DateInput';
import { fetchJson } from '../lib/apiClient';
import { formatDateOrDash } from '../lib/dates';
import { detailsToBackupForm } from '../lib/propertyDetailsForm';
import { uploadPropertyBackupImage } from '../lib/propertyDetailsClient';
import {
	usePropertySectionEdit,
	PropertySectionEditButton,
	PropertySectionViewHeader,
	PropertyFieldRow,
	PropertySectionEditActions,
} from './PropertySectionEdit';

const EMPTY_FORM = detailsToBackupForm(null);

function BackupView({ form }) {
	return (
		<div className="space-y-3">
			<PropertyFieldRow label="Backup Lockbox Location" value={form.backup_lockbox_location} />
			<PropertyFieldRow label="Backup Lockbox Code" value={form.backup_lockbox_code} />
			<PropertyFieldRow
				label="Date Confirmed"
				value={formatDateOrDash(form.backup_date_confirmed)}
			/>
			{form.backup_image_url ? (
				<div>
					<p className="label">Confirmation Image</p>
					<img
						src={form.backup_image_url}
						alt="Backup lockbox"
						className="w-full max-h-48 object-cover rounded-lg border border-border"
					/>
				</div>
			) : (
				<PropertyFieldRow label="Confirmation Image" value="" />
			)}
		</div>
	);
}

export default function PropertyBackupInfoSection({ propertyId, embedded = false }) {
	const [form, setForm] = useState(EMPTY_FORM);
	const [savedForm, setSavedForm] = useState(EMPTY_FORM);
	const [pendingImage, setPendingImage] = useState(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const inputRef = useRef(null);
	const { editing, startEditing, finishEditing } = usePropertySectionEdit();

	useEffect(() => {
		if (!propertyId) return;
		setLoading(true);
		setError('');
		fetchJson(`/api/properties/${propertyId}/details`)
			.then((json) => {
				const next = detailsToBackupForm(json?.data);
				setForm(next);
				setSavedForm(next);
				setPendingImage(null);
			})
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [propertyId]);

	const dirty = JSON.stringify(form) !== JSON.stringify(savedForm) || Boolean(pendingImage);

	function handleCancel() {
		setForm(savedForm);
		setPendingImage(null);
		setError('');
		finishEditing();
	}

	async function handleSave(e) {
		e.preventDefault();
		setSaving(true);
		setError('');
		try {
			let backup_image_storage_path = form.backup_image_storage_path;
			if (pendingImage) {
				const uploaded = await uploadPropertyBackupImage(pendingImage, propertyId);
				backup_image_storage_path = uploaded.storage_path;
			}
			const json = await fetchJson(`/api/properties/${propertyId}/details`, {
				method: 'PUT',
				body: {
					backup_lockbox_location: form.backup_lockbox_location,
					backup_lockbox_code: form.backup_lockbox_code,
					backup_date_confirmed: form.backup_date_confirmed,
					backup_image_storage_path,
					section: 'backup-info',
				},
			});
			const next = detailsToBackupForm(json?.data);
			setForm(next);
			setSavedForm(next);
			setPendingImage(null);
			finishEditing();
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	}

	function handleImagePick(fileList) {
		const file = Array.from(fileList || [])[0];
		if (!file) return;
		setPendingImage(file);
	}

	function clearImage() {
		setPendingImage(null);
		setForm((f) => ({
			...f,
			backup_image_storage_path: '',
			backup_image_url: '',
		}));
	}

	const [previewUrl, setPreviewUrl] = useState('');

	useEffect(() => {
		if (pendingImage) {
			const url = URL.createObjectURL(pendingImage);
			setPreviewUrl(url);
			return () => URL.revokeObjectURL(url);
		}
		setPreviewUrl(form.backup_image_url || '');
		return undefined;
	}, [pendingImage, form.backup_image_url]);

	const formContent = loading ? (
		<p className="text-sm text-muted">Loading backup info…</p>
	) : editing ? (
		<form onSubmit={handleSave} noValidate className="space-y-3">
			<div>
				<label className="label" htmlFor="backup-lockbox-location">Backup Lockbox Location</label>
				<input
					id="backup-lockbox-location"
					type="text"
					className="input"
					value={form.backup_lockbox_location}
					onChange={(e) => setForm((f) => ({ ...f, backup_lockbox_location: e.target.value }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="backup-lockbox-code">Backup Lockbox Code</label>
				<input
					id="backup-lockbox-code"
					type="text"
					className="input"
					value={form.backup_lockbox_code}
					onChange={(e) => setForm((f) => ({ ...f, backup_lockbox_code: e.target.value }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="backup-date-confirmed">Date Confirmed</label>
				<DateInput
					id="backup-date-confirmed"
					value={form.backup_date_confirmed}
					onChange={(e) => setForm((f) => ({ ...f, backup_date_confirmed: e.target.value }))}
				/>
			</div>

			<div>
				<label className="label">Confirmation Image</label>
				<div className="rounded-xl border border-dashed border-border bg-gray-50/60 p-4">
					<input
						ref={inputRef}
						type="file"
						accept="image/*"
						capture="environment"
						className="sr-only"
						onChange={(e) => {
							handleImagePick(e.target.files);
							e.target.value = '';
						}}
					/>
					{previewUrl ? (
						<div className="relative">
							<img
								src={previewUrl}
								alt="Backup lockbox"
								className="w-full max-h-48 object-cover rounded-lg border border-border"
							/>
							<button
								type="button"
								onClick={clearImage}
								className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
								aria-label="Remove image"
							>
								<X size={14} />
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => inputRef.current?.click()}
							className="btn-secondary w-full justify-center"
						>
							<Camera size={16} />
							Upload image
						</button>
					)}
					{previewUrl && (
						<button
							type="button"
							onClick={() => inputRef.current?.click()}
							className="btn-secondary w-full justify-center mt-2 text-sm"
						>
							Replace image
						</button>
					)}
				</div>
			</div>

			{error && <p className="text-sm text-red-600">{error}</p>}

			<PropertySectionEditActions saving={saving} dirty={dirty} onCancel={handleCancel} />
		</form>
	) : (
		<>
			<PropertySectionViewHeader onEdit={startEditing} />
			<BackupView form={savedForm} />
		</>
	);

	if (embedded) return formContent;

	return (
		<div className="card p-6 mb-4">
			<div className="flex items-start justify-between gap-3 mb-4">
				<h2 className="font-semibold text-dark text-sm uppercase tracking-wide text-muted">Backup Info</h2>
				{!editing && !loading && (
					<PropertySectionEditButton onClick={startEditing} />
				)}
			</div>
			{formContent}
		</div>
	);
}
