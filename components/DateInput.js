import { useEffect, useState } from 'react';
import { formatDate, parseToIsoDate } from '../lib/dates';

export default function DateInput({
	value = '',
	onChange,
	className = 'input',
	placeholder = 'MM-DD-YYYY',
	...props
}) {
	const [text, setText] = useState(() => formatDate(value));

	useEffect(() => {
		setText(formatDate(value));
	}, [value]);

	function commit(nextText) {
		const trimmed = nextText.trim();
		if (!trimmed) {
			onChange?.({ target: { value: '' } });
			setText('');
			return;
		}

		const iso = parseToIsoDate(trimmed);
		if (iso) {
			onChange?.({ target: { value: iso } });
			setText(formatDate(iso));
			return;
		}

		setText(formatDate(value));
	}

	return (
		<input
			type="text"
			inputMode="numeric"
			autoComplete="off"
			placeholder={placeholder}
			className={className}
			value={text}
			onChange={(e) => setText(e.target.value)}
			onBlur={() => commit(text)}
			onKeyDown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					commit(text);
				}
			}}
			{...props}
		/>
	);
}
