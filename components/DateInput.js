import { toIsoDate } from '../lib/dates';

export default function DateInput({
	value = '',
	onChange,
	className = 'input',
	...props
}) {
	return (
		<input
			type="date"
			className={className}
			value={toIsoDate(value)}
			onChange={onChange}
			{...props}
		/>
	);
}
