import { useState } from 'react';
import clsx from 'clsx';
import { Pencil } from 'lucide-react';
import { useAuth } from './AuthContext';

export function usePropertySectionEdit() {
	const [editing, setEditing] = useState(false);
	return {
		editing,
		startEditing: () => setEditing(true),
		finishEditing: () => setEditing(false),
	};
}

export function PropertySectionEditButton({ onClick, className }) {
	const { isAdmin } = useAuth();
	if (!isAdmin) return null;

	return (
		<button
			type="button"
			onClick={onClick}
			className={clsx(
				'p-1.5 rounded-lg text-muted hover:text-dark hover:bg-gray-100 transition-colors',
				className,
			)}
			aria-label="Edit"
		>
			<Pencil size={16} />
		</button>
	);
}

export function PropertyFieldRow({ label, value, multiline = false, className }) {
	const display = value != null && value !== '' ? value : '—';
	return (
		<div className={className}>
			<p className="label">{label}</p>
			{multiline ? (
				<p className="text-sm text-dark whitespace-pre-wrap break-words">{display}</p>
			) : (
				<p className="text-sm text-dark break-words">{display}</p>
			)}
		</div>
	);
}

export function PropertyFieldGroup({ title, children, className }) {
	return (
		<div className={clsx('space-y-3', className)}>
			{title ? (
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
			) : null}
			{children}
		</div>
	);
}

export function PropertySectionViewHeader({ onEdit }) {
	const { isAdmin } = useAuth();
	if (!isAdmin) return null;

	return (
		<div className="flex justify-end -mt-0.5 mb-2">
			<PropertySectionEditButton onClick={onEdit} />
		</div>
	);
}

export function PropertySectionEditActions({ saving, dirty, onCancel }) {
	return (
		<div className="flex flex-wrap gap-2">
			<button
				type="submit"
				disabled={saving || !dirty}
				className="btn-primary text-sm w-full sm:w-auto justify-center"
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
			<button
				type="button"
				onClick={onCancel}
				disabled={saving}
				className="btn-secondary text-sm w-full sm:w-auto justify-center"
			>
				Cancel
			</button>
		</div>
	);
}
