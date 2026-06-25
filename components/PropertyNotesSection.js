import { useEffect, useState } from 'react';
import { fetchJson } from '../lib/apiClient';
import { detailsToNotesForm } from '../lib/propertyDetailsForm';
import {
	usePropertySectionEdit,
	PropertySectionEditButton,
	PropertySectionViewHeader,
	PropertyFieldRow,
	PropertySectionEditActions,
} from './PropertySectionEdit';

const EMPTY_FORM = detailsToNotesForm(null);

export default function PropertyNotesSection({ propertyId, embedded = false }) {
	const [form, setForm] = useState(EMPTY_FORM);
	const [savedForm, setSavedForm] = useState(EMPTY_FORM);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const { editing, startEditing, finishEditing } = usePropertySectionEdit();

	useEffect(() => {
		if (!propertyId) return;
		setLoading(true);
		setError('');
		fetchJson(`/api/properties/${propertyId}/details`)
			.then((json) => {
				const next = detailsToNotesForm(json?.data);
				setForm(next);
				setSavedForm(next);
			})
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [propertyId]);

	const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

	function handleCancel() {
		setForm(savedForm);
		setError('');
		finishEditing();
	}

	async function handleSave(e) {
		e.preventDefault();
		setSaving(true);
		setError('');
		try {
			const json = await fetchJson(`/api/properties/${propertyId}/details`, {
				method: 'PUT',
				body: { ...form, section: 'notes' },
			});
			const next = detailsToNotesForm(json?.data);
			setForm(next);
			setSavedForm(next);
			finishEditing();
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	}

	const formContent = loading ? (
		<p className="text-sm text-muted">Loading notes…</p>
	) : editing ? (
		<form onSubmit={handleSave} noValidate className="space-y-3">
			<div>
				<label className="label" htmlFor="property-notes">Notes</label>
				<textarea
					id="property-notes"
					className="input min-h-[120px] resize-y"
					placeholder="Add any notes that pertain to this property…"
					value={form.notes}
					onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
				/>
			</div>

			{error && <p className="text-sm text-red-600">{error}</p>}

			<PropertySectionEditActions saving={saving} dirty={dirty} onCancel={handleCancel} />
		</form>
	) : (
		<>
			<PropertySectionViewHeader onEdit={startEditing} />
			<PropertyFieldRow label="Notes" value={savedForm.notes} multiline />
		</>
	);

	if (embedded) return formContent;

	return (
		<div className="card p-6 mb-4">
			<div className="flex items-start justify-between gap-3 mb-4">
				<h2 className="font-semibold text-dark text-sm uppercase tracking-wide text-muted">Notes</h2>
				{!editing && !loading && (
					<PropertySectionEditButton onClick={startEditing} />
				)}
			</div>
			{formContent}
		</div>
	);
}
