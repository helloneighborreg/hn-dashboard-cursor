import clsx from 'clsx';
import { useState } from 'react';
import {
	BOOKKEEPING_CATEGORY_GROUPS,
	getCategoryType,
	categoryTypeLabel,
	normalizeCategory,
} from '../../lib/bookkeepingCategories';

export function CategoryTypeBadge({ category, className }) {
	const type = getCategoryType(category);
	if (!type) return null;
	return (
		<span
			className={clsx(
				'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
				type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700',
				className,
			)}
		>
			{categoryTypeLabel(type)}
		</span>
	);
}

/**
 * Category picker with Income / Expenses optgroups and color hints for the selected value.
 */
export default function CategorySelect({
	value,
	onChange,
	placeholder = 'Select category',
	className,
	disabled,
	id,
}) {
	const type = getCategoryType(value);

	return (
		<select
			id={id}
			disabled={disabled}
			className={clsx(
				'select-compact max-w-[11rem] truncate',
				!value && 'text-brand-600 font-medium',
				type === 'income' && 'text-green-700 font-medium',
				type === 'expense' && 'text-red-700 font-medium',
				className,
			)}
			value={normalizeCategory(value) || ''}
			onChange={(e) => onChange(e.target.value)}
		>
			<option value="">{placeholder}</option>
			{BOOKKEEPING_CATEGORY_GROUPS.map((group) => (
				<optgroup key={group.type} label={group.label}>
					{group.categories.map((category) => (
						<option key={category} value={category}>{category}</option>
					))}
				</optgroup>
			))}
		</select>
	);
}

/** Resets after each selection — for bulk-action toolbars. */
export function ResettingCategorySelect({ onChange, placeholder = 'Set category…', className }) {
	const [resetKey, setResetKey] = useState(0);
	return (
		<CategorySelect
			key={resetKey}
			value=""
			placeholder={placeholder}
			className={className}
			onChange={(v) => {
				if (!v) return;
				onChange(v);
				setResetKey((k) => k + 1);
			}}
		/>
	);
}
