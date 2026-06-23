import { useEffect, useState } from 'react';
import DollarInput from './forms/DollarInput';
import { fetchJson } from '../lib/apiClient';
import { detailsToUtilityForm } from '../lib/propertyDetailsForm';

const EMPTY_FORM = detailsToUtilityForm(null);

export default function PropertyUtilityInfoSection({ propertyId, embedded = false }) {
	const [form, setForm] = useState(EMPTY_FORM);
	const [savedForm, setSavedForm] = useState(EMPTY_FORM);
	const [cleaners, setCleaners] = useState([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!propertyId) return;
		setLoading(true);
		setError('');
		fetchJson(`/api/properties/${propertyId}/details`)
			.then((json) => {
				const next = detailsToUtilityForm(json?.data);
				setForm(next);
				setSavedForm(next);
				setCleaners(Array.isArray(json?.cleaners) ? json.cleaners : []);
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
			const next = detailsToUtilityForm(json?.data);
			setForm(next);
			setSavedForm(next);
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	}

	const formContent = loading ? (
		<p className="text-sm text-muted">Loading utility info…</p>
	) : (
		<form onSubmit={handleSave} noValidate className="space-y-4">
			<div className="space-y-3">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Cleaning</h3>
				<div>
					<label className="label" htmlFor="primary-cleaner">Primary Cleaner</label>
					<select
						id="primary-cleaner"
						className="select"
						value={form.primary_cleaner}
						onChange={(e) => setForm((f) => ({ ...f, primary_cleaner: e.target.value }))}
					>
						<option value="">None</option>
						{cleaners.map((name) => (
							<option key={name} value={name}>{name}</option>
						))}
						{form.primary_cleaner && !cleaners.includes(form.primary_cleaner) && (
							<option value={form.primary_cleaner}>{form.primary_cleaner}</option>
						)}
					</select>
				</div>
				<div>
					<label className="label" htmlFor="base-cleaning-rate">Base Cleaning Rate</label>
					<DollarInput
						id="base-cleaning-rate"
						value={form.base_cleaning_rate}
						onChange={(value) => setForm((f) => ({ ...f, base_cleaning_rate: value }))}
					/>
					<p className="text-xs text-muted mt-1">Used as the base clean fee on CJC turn clean checklists. Defaults to $0 when blank.</p>
				</div>
			</div>

			<div className="space-y-3 pt-2 border-t border-border/40">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Utilities</h3>
				<div>
					<label className="label" htmlFor="utilities-provider">Utilities Provider</label>
					<input
						id="utilities-provider"
						type="text"
						className="input"
						value={form.utilities_provider}
						onChange={(e) => setForm((f) => ({ ...f, utilities_provider: e.target.value }))}
					/>
				</div>
				<div>
					<label className="label" htmlFor="utilities-account-number">Utilities Account #</label>
					<input
						id="utilities-account-number"
						type="text"
						className="input"
						value={form.utilities_account_number}
						onChange={(e) => setForm((f) => ({ ...f, utilities_account_number: e.target.value }))}
					/>
				</div>
			</div>

			<div className="space-y-3 pt-2 border-t border-border/40">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Internet</h3>
				<div>
					<label className="label" htmlFor="internet-provider">Internet Provider</label>
					<input
						id="internet-provider"
						type="text"
						className="input"
						value={form.internet_provider}
						onChange={(e) => setForm((f) => ({ ...f, internet_provider: e.target.value }))}
					/>
				</div>
				<div>
					<label className="label" htmlFor="internet-account-number">Internet Account #</label>
					<input
						id="internet-account-number"
						type="text"
						className="input"
						value={form.internet_account_number}
						onChange={(e) => setForm((f) => ({ ...f, internet_account_number: e.target.value }))}
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

	if (embedded) return formContent;

	return (
		<div className="card p-6 mb-4">
			<h2 className="font-semibold text-dark text-sm uppercase tracking-wide text-muted mb-4">Utility Info</h2>
			{formContent}
		</div>
	);
}
