import { Check } from 'lucide-react';
import { formatDateOrDash } from '../../lib/dates';

export default function OwnerStatementInclusionBadge({ inclusion, className = '' }) {
	if (!inclusion?.included) {
		return <span className={`text-muted ${className}`.trim()}>—</span>;
	}

	const label = inclusion.statement_period || 'On statement';
	const title = inclusion.approved_at
		? `Included on owner statement approved ${formatDateOrDash(inclusion.approved_at)}`
		: 'Included on an owner statement';

	return (
		<span
			className={`inline-flex items-center gap-1 text-xs font-medium text-green-700 whitespace-nowrap ${className}`.trim()}
			title={title}
		>
			<Check size={14} className="shrink-0" aria-hidden />
			{label}
		</span>
	);
}
