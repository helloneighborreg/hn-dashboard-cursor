import clsx from 'clsx';
import { useState } from 'react';
import { amountToForm } from '../../lib/propertyDetailsForm';

function sanitizeRaw(raw) {
	const cleaned = raw.replace(/[^0-9.]/g, '');
	const parts = cleaned.split('.');
	if (parts.length <= 2) return cleaned;
	return `${parts[0]}.${parts.slice(1).join('')}`;
}

export default function DollarInput({ id, value, onChange, className }) {
	const [focused, setFocused] = useState(false);
	const displayValue = focused ? value : amountToForm(value);

	return (
		<div className="relative">
			<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none select-none">$</span>
			<input
				id={id}
				type="text"
				inputMode="decimal"
				autoComplete="off"
				placeholder="0.00"
				className={clsx('input pl-7 tabular-nums', className)}
				value={displayValue}
				onFocus={() => setFocused(true)}
				onBlur={(e) => {
					setFocused(false);
					onChange(amountToForm(e.target.value));
				}}
				onChange={(e) => onChange(sanitizeRaw(e.target.value))}
			/>
		</div>
	);
}
