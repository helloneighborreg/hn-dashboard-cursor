import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { fetchJson } from '../../lib/apiClient';
import {
	getLocationLeafName,
	getLocationParentPath,
	isLocationDescendant,
	joinLocationPath,
	LOCATION_PATH_SEPARATOR,
} from '../../lib/supplies';

export default function SupplyLocationModal({
	location,
	parentLocation = null,
	existingLocations = [],
	itemCount = 0,
	subLocationCount = 0,
	onClose,
	onSaved,
	onDeleted,
}) {
	const isEdit = Boolean(location);
	const isSubLocation = Boolean(parentLocation) && !isEdit;
	const [name, setName] = useState(isEdit ? getLocationLeafName(location) : '');
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [err, setErr] = useState('');
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();

	const parentPath = isEdit ? getLocationParentPath(location) : parentLocation;
	const fullPath = isEdit
		? joinLocationPath(parentPath, name.trim())
		: joinLocationPath(parentLocation, name.trim());

	async function submit(e) {
		e.preventDefault();
		setErr('');
		const trimmed = name.trim();
		if (!trimmed) {
			setErr('Location name is required');
			return;
		}
		if (trimmed.includes(LOCATION_PATH_SEPARATOR)) {
			setErr(`Location names cannot contain "${LOCATION_PATH_SEPARATOR.trim()}"`);
			return;
		}
		const nextPath = joinLocationPath(parentPath, trimmed);
		const duplicate = existingLocations.some(
			(loc) => loc.toLowerCase() === nextPath.toLowerCase() && loc !== location,
		);
		if (duplicate) {
			setErr('A location with this name already exists at this level');
			return;
		}
		setSaving(true);
		try {
			if (isEdit) {
				if (nextPath !== location) {
					await fetchJson('/api/supplies/inventory/locations', {
						method: 'PATCH',
						body: { from: location, to: nextPath },
					});
				}
				onSaved?.({ from: location, to: nextPath });
			} else {
				onSaved?.({ name: nextPath });
			}
			onClose();
		} catch (saveErr) {
			setErr(saveErr.message);
		} finally {
			setSaving(false);
		}
	}

	async function remove() {
		if (!isEdit || (itemCount === 0 && subLocationCount === 0)) {
			onDeleted?.(location);
			onClose();
			return;
		}
		setErr('');
		setDeleting(true);
		try {
			await fetchJson('/api/supplies/inventory/locations', {
				method: 'DELETE',
				body: { location },
			});
			onDeleted?.(location);
			onClose();
		} catch (deleteErr) {
			setErr(deleteErr.message);
		} finally {
			setDeleting(false);
			setConfirmDelete(false);
		}
	}

	const title = isEdit
		? 'Edit Location'
		: isSubLocation
			? 'Add Sub-location'
			: 'Add Location';

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className="bg-white rounded-2xl shadow-2xl w-full max-w-md focus:outline-none"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between p-5 border-b border-border">
					<h2 className="font-semibold text-dark">{title}</h2>
					<button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-dark">
						<X size={18} />
					</button>
				</div>
				<form onSubmit={submit} className="p-5 space-y-4">
					{parentPath && (
						<div className="rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-sm text-brand-900">
							<span className="text-brand-600">Inside </span>
							<span className="font-medium">{parentPath}</span>
						</div>
					)}
					<div>
						<label className="label" htmlFor="location-name">
							{isSubLocation || (isEdit && parentPath) ? 'Sub-location name *' : 'Location name *'}
						</label>
						<input
							id="location-name"
							className="input"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={parentPath ? 'e.g. Tote A, Bin 3' : 'e.g. Garage Unit, Warehouse'}
							required
							autoFocus
						/>
						{!isEdit && (
							<p className="text-xs text-muted mt-1.5">
								{parentPath
									? 'Creates a nested spot inside the parent location.'
									: 'Top-level locations can contain sub-locations like totes or bins.'}
							</p>
						)}
					</div>
					{!isEdit && fullPath && name.trim() && (
						<p className="text-xs text-muted">
							Full path: <span className="font-medium text-dark">{fullPath}</span>
						</p>
					)}
					{err && <p className="text-sm text-red-600">{err}</p>}
					<div className="flex gap-2 pt-1">
						<button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
						<button type="submit" disabled={saving} className="btn-primary flex-1">
							{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Location'}
						</button>
					</div>
					{isEdit && (
						<div className="pt-2 border-t border-border">
							{confirmDelete ? (
								<div className="space-y-2">
									<p className="text-sm text-amber-800">
										{itemCount > 0 || subLocationCount > 0
											? `Delete "${getLocationLeafName(location)}"${subLocationCount > 0 ? ` and ${subLocationCount} nested location${subLocationCount === 1 ? '' : 's'}` : ''}${itemCount > 0 ? ` with ${itemCount} inventory item${itemCount === 1 ? '' : 's'}` : ''}? This cannot be undone.`
											: `Remove empty location "${getLocationLeafName(location)}"?`}
									</p>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={() => setConfirmDelete(false)}
											disabled={deleting}
											className="btn-secondary flex-1"
										>
											Cancel
										</button>
										<button
											type="button"
											onClick={remove}
											disabled={deleting}
											className={clsx('btn-danger flex-1', deleting && 'opacity-60')}
										>
											{deleting ? 'Deleting…' : 'Delete'}
										</button>
									</div>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setConfirmDelete(true)}
									className="btn-secondary w-full text-sm gap-2 inline-flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50"
								>
									<Trash2 size={16} />
									Delete location
								</button>
							)}
						</div>
					)}
				</form>
			</div>
		</div>
	);
}

export function countNestedLocations(location, existingLocations = []) {
	return existingLocations.filter(
		(loc) => loc !== location && isLocationDescendant(loc, location),
	).length;
}
