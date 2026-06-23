import { useEffect, useState } from 'react';
import { fetchJson } from '../lib/apiClient';
import { detailsToExtrasForm } from '../lib/propertyDetailsForm';

const EMPTY_FORM = detailsToExtrasForm(null);

export default function PropertyDetailsExtrasSection({ propertyId }) {
	const [form, setForm] = useState(EMPTY_FORM);
	const [savedForm, setSavedForm] = useState(EMPTY_FORM);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!propertyId) return;
		setLoading(true);
		setError('');
		fetchJson(`/api/properties/${propertyId}/details`)
			.then((json) => {
				const next = detailsToExtrasForm(json?.data);
				setForm(next);
				setSavedForm(next);
			})
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [propertyId]);

	const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

	async function handleSave(e) {
		e.preventDefault();
		setSaving(true);
		setError('');
		try {
			const json = await fetchJson(`/api/properties/${propertyId}/details`, {
				method: 'PUT',
				body: form,
			});
			const next = detailsToExtrasForm(json?.data);
			setForm(next);
			setSavedForm(next);
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return <p className="text-sm text-muted pt-4 border-t border-border/60">Loading property details…</p>;
	}

	return (
		<form onSubmit={handleSave} noValidate className="space-y-4 pt-4 border-t border-border/60">
			<div className="space-y-3">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Square Feet</h3>
				<input
					id="property-square-feet"
					type="number"
					min="0"
					step="1"
					className="input"
					value={form.square_feet}
					onChange={(e) => setForm((f) => ({ ...f, square_feet: e.target.value }))}
				/>
			</div>

			<div className="space-y-3 pt-2 border-t border-border/40">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Year Built</h3>
				<input
					id="property-year-built"
					type="number"
					min="0"
					step="1"
					className="input"
					value={form.year_built}
					onChange={(e) => setForm((f) => ({ ...f, year_built: e.target.value }))}
				/>
			</div>

			<div className="space-y-3 pt-2 border-t border-border/40">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Mailbox &amp; Parking</h3>
				<div>
					<label className="label" htmlFor="property-mailbox">Mailbox</label>
					<input
						id="property-mailbox"
						type="text"
						className="input"
						value={form.mailbox}
						onChange={(e) => setForm((f) => ({ ...f, mailbox: e.target.value }))}
					/>
				</div>
				<div>
					<label className="label" htmlFor="property-parking-number">Parking #</label>
					<input
						id="property-parking-number"
						type="text"
						className="input"
						value={form.parking_number}
						onChange={(e) => setForm((f) => ({ ...f, parking_number: e.target.value }))}
					/>
				</div>
				<div>
					<label className="label" htmlFor="property-parking-code">Parking Code</label>
					<input
						id="property-parking-code"
						type="text"
						className="input"
						value={form.parking_code}
						onChange={(e) => setForm((f) => ({ ...f, parking_code: e.target.value }))}
					/>
				</div>
			</div>

			{error && <p className="text-sm text-red-600">{error}</p>}

			<button
				type="submit"
				disabled={saving || !dirty}
				className="btn-primary text-sm w-full sm:w-auto justify-center"
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</form>
	);
}
