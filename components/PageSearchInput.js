import { Search } from 'lucide-react';
import clsx from 'clsx';

/** Compact page header search — sized to match action buttons like "New Transaction". */
export default function PageSearchInput({ value, onChange, placeholder, className }) {
	return (
		<div className={clsx('relative w-44 sm:w-52 flex-shrink-0', className)}>
			<Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
			<input
				type="search"
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				className="input-compact pl-8 w-full"
			/>
		</div>
	);
}
