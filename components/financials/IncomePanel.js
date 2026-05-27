import { useState } from 'react';
import clsx from 'clsx';
import HospitableTransactionsTable from './HospitableTransactionsTable';
import BankFeedTransactions from './BankFeedTransactions';

const TABS = [
	{ value: 'hospitable', label: 'Hospitable Import' },
	{ value: 'bank', label: 'Bank Feed' },
];

export default function IncomePanel({ data, summary, dateFrom, dateTo }) {
	const [tab, setTab] = useState('hospitable');
	const hasHospitable = data.reservations?.length > 0;

	return (
		<div className="card p-5 mb-6">
			<div className="flex flex-wrap gap-1 border-b border-border mb-4">
				{TABS.map(({ value, label }) => (
					<button
						key={value}
						type="button"
						onClick={() => setTab(value)}
						className={clsx(
							'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
							tab === value
								? 'border-brand-500 text-brand-600'
								: 'border-transparent text-muted hover:text-dark',
						)}
					>
						{label}
					</button>
				))}
			</div>

			{tab === 'hospitable' ? (
				hasHospitable ? (
					<HospitableTransactionsTable
						reservations={data.reservations}
						summary={summary}
					/>
				) : (
					<p className="text-muted text-sm text-center py-10">
						No Hospitable reservations for the selected period.
					</p>
				)
			) : (
				<BankFeedTransactions dateFrom={dateFrom} dateTo={dateTo} />
			)}
		</div>
	);
}
