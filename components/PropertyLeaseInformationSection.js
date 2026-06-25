import { useEffect, useMemo, useState } from 'react';
import DollarInput from './forms/DollarInput';
import DateInput from './DateInput';
import { fetchJson } from '../lib/apiClient';
import { fmt$ } from './financials/format';
import { formatDateOrDash } from '../lib/dates';
import { detailsToLeaseForm, sumLeaseAmounts } from '../lib/propertyDetailsForm';
import {
	usePropertySectionEdit,
	PropertySectionEditButton,
	PropertySectionViewHeader,
	PropertyFieldRow,
	PropertySectionEditActions,
} from './PropertySectionEdit';

const EMPTY_FORM = detailsToLeaseForm(null);

function LeaseView({ form }) {
	const leaseTotal = sumLeaseAmounts(form);
	return (
		<div className="space-y-3">
			<PropertyFieldRow label="Rent" value={form.rent ? fmt$(form.rent) : ''} />
			<PropertyFieldRow label="Utilities" value={form.lease_utilities ? fmt$(form.lease_utilities) : ''} />
			<PropertyFieldRow label="Electric" value={form.lease_electric ? fmt$(form.lease_electric) : ''} />
			<PropertyFieldRow label="Internet" value={form.lease_internet ? fmt$(form.lease_internet) : ''} />
			<PropertyFieldRow label="Parking" value={form.lease_parking ? fmt$(form.lease_parking) : ''} />
			<PropertyFieldRow label="Total" value={leaseTotal ? fmt$(leaseTotal) : ''} />
			<PropertyFieldRow label="Lease Expiration" value={formatDateOrDash(form.lease_expiration)} />
			<PropertyFieldRow label="Renewal Notice Due" value={formatDateOrDash(form.renewal_notice_due)} />
		</div>
	);
}

export default function PropertyLeaseInformationSection({ propertyId, embedded = false }) {
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
				const next = detailsToLeaseForm(json?.data);
				setForm(next);
				setSavedForm(next);
			})
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [propertyId]);

	const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
	const leaseTotal = useMemo(() => sumLeaseAmounts(form), [form]);

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
				body: { ...form, section: 'lease-information' },
			});
			const next = detailsToLeaseForm(json?.data);
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
		<p className="text-sm text-muted">Loading lease information…</p>
	) : editing ? (
		<form onSubmit={handleSave} noValidate className="space-y-3">
			<div>
				<label className="label" htmlFor="lease-rent">Rent</label>
				<DollarInput
					id="lease-rent"
					value={form.rent}
					onChange={(rent) => setForm((f) => ({ ...f, rent }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="lease-utilities">Utilities</label>
				<DollarInput
					id="lease-utilities"
					value={form.lease_utilities}
					onChange={(lease_utilities) => setForm((f) => ({ ...f, lease_utilities }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="lease-electric">Electric</label>
				<DollarInput
					id="lease-electric"
					value={form.lease_electric}
					onChange={(lease_electric) => setForm((f) => ({ ...f, lease_electric }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="lease-internet">Internet</label>
				<DollarInput
					id="lease-internet"
					value={form.lease_internet}
					onChange={(lease_internet) => setForm((f) => ({ ...f, lease_internet }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="lease-parking">Parking</label>
				<DollarInput
					id="lease-parking"
					value={form.lease_parking}
					onChange={(lease_parking) => setForm((f) => ({ ...f, lease_parking }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="lease-total">Total</label>
				<input
					id="lease-total"
					type="text"
					readOnly
					tabIndex={-1}
					className="input tabular-nums bg-gray-50 text-dark cursor-default"
					value={fmt$(leaseTotal)}
					aria-readonly="true"
				/>
			</div>

			<div>
				<label className="label" htmlFor="lease-expiration">Lease Expiration</label>
				<DateInput
					id="lease-expiration"
					value={form.lease_expiration}
					onChange={(e) => setForm((f) => ({ ...f, lease_expiration: e.target.value }))}
				/>
			</div>

			<div>
				<label className="label" htmlFor="renewal-notice-due">Renewal Notice Due</label>
				<DateInput
					id="renewal-notice-due"
					value={form.renewal_notice_due}
					onChange={(e) => setForm((f) => ({ ...f, renewal_notice_due: e.target.value }))}
				/>
			</div>

			{error && <p className="text-sm text-red-600">{error}</p>}

			<PropertySectionEditActions saving={saving} dirty={dirty} onCancel={handleCancel} />
		</form>
	) : (
		<>
			<PropertySectionViewHeader onEdit={startEditing} />
			<LeaseView form={savedForm} />
		</>
	);

	if (embedded) return formContent;

	return (
		<div className="card p-6 mb-4">
			<div className="flex items-start justify-between gap-3 mb-4">
				<h2 className="font-semibold text-dark text-sm uppercase tracking-wide text-muted">Lease Information</h2>
				{!editing && !loading && (
					<PropertySectionEditButton onClick={startEditing} />
				)}
			</div>
			{formContent}
		</div>
	);
}
