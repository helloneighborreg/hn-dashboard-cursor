import { useEffect, useState } from 'react';
import DateInput from './DateInput';
import { fetchJson } from '../lib/apiClient';
import { toIsoDate } from '../lib/dates';

const EMPTY_FORM = {
	name: '',
	address: '',
	email: '',
	phone: '',
	agreement_expiration: '',
	management_fee_percent: '20',
	notes: '',
};

function ownerToForm(owner) {
	if (!owner) return { ...EMPTY_FORM };
	return {
		name: owner.name || '',
		address: owner.address || '',
		email: owner.email || '',
		phone: owner.phone || '',
		agreement_expiration: toIsoDate(owner.agreement_expiration) || '',
		management_fee_percent: owner.management_fee_percent != null
			? String(owner.management_fee_percent)
			: '20',
		notes: owner.notes || '',
	};
}

export default function PropertyOwnerSection({ propertyId, embedded = false }) {
	const [form, setForm] = useState(EMPTY_FORM);
	const [savedForm, setSavedForm] = useState(EMPTY_FORM);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		if (!propertyId) return;
		setLoading(true);
		setError('');
		fetchJson(`/api/properties/${propertyId}/owner`)
			.then((json) => {
				const next = ownerToForm(json?.data);
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
		setSaved(false);
		const formEl = e.currentTarget;
		const fd = new FormData(formEl);
		const payload = {
			...form,
			// Read the date input directly so a picker selection is saved even if
			// React state hasn't flushed yet (same class of bug as the old DateInput blur).
			agreement_expiration: String(fd.get('agreement_expiration') ?? form.agreement_expiration ?? ''),
		};
		try {
			const json = await fetchJson(`/api/properties/${propertyId}/owner`, {
				method: 'PUT',
				body: payload,
			});
			if (!json?.data) {
				throw new Error('Save failed — no response from server.');
			}
			const next = ownerToForm(json.data);
			setForm(next);
			setSavedForm(next);
			setSaved(true);
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	}

	const formContent = loading ? (
		<p className="text-sm text-muted">Loading owner info…</p>
	) : (
		<form onSubmit={handleSave} noValidate className="space-y-3">
			<div>
				<label className="label" htmlFor="owner-name">Name</label>
				<input
					id="owner-name"
					type="text"
					className="input"
					value={form.name}
					onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="owner-address">Address</label>
				<textarea
					id="owner-address"
					className="input min-h-[72px] resize-y"
					value={form.address}
					onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="owner-email">Email</label>
				<input
					id="owner-email"
					type="email"
					className="input"
					value={form.email}
					onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="owner-phone">Phone</label>
				<input
					id="owner-phone"
					type="tel"
					className="input"
					value={form.phone}
					onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="owner-management-fee-percent">Management Fee %</label>
				<input
					id="owner-management-fee-percent"
					type="number"
					min="0"
					max="100"
					step="0.01"
					className="input"
					value={form.management_fee_percent}
					onChange={(e) => setForm((f) => ({ ...f, management_fee_percent: e.target.value }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="owner-agreement-expiration">Management Agreement Expiration</label>
				<DateInput
					id="owner-agreement-expiration"
					name="agreement_expiration"
					value={form.agreement_expiration}
					onChange={(e) => setForm((f) => ({ ...f, agreement_expiration: e.target.value }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="owner-notes">Notes</label>
				<textarea
					id="owner-notes"
					className="input min-h-[72px] resize-y"
					value={form.notes}
					onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
				/>
			</div>

			{error && (
				<p className="text-sm text-red-600">{error}</p>
			)}

			<button
				type="submit"
				disabled={saving || !dirty}
				className="btn-primary text-sm w-full sm:w-auto justify-center"
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</form>
	);

	if (embedded) return formContent;

	return (
		<div className="card p-6 mb-4">
			<div className="flex items-start justify-between gap-3 mb-4">
				<h2 className="font-semibold text-dark text-sm uppercase tracking-wide text-muted">Owner Info</h2>
				{saved && !dirty && (
					<span className="text-xs text-green-600 font-medium">Saved</span>
				)}
			</div>
			{formContent}
		</div>
	);
}
