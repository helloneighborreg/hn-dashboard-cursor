import Head from 'next/head';
import Link from 'next/link';
import { Shield, ClipboardList } from 'lucide-react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';

const ACTIONS = [
	{
		href: '/settings/permissions',
		label: 'Permissions',
		description: 'Control which pages admins and non-admins can see.',
		icon: Shield,
	},
	{
		href: '/settings/checklists',
		label: 'Checklists',
		description: 'Open property turnover checklists.',
		icon: ClipboardList,
	},
];

export default function SettingsPage() {
	return (
		<>
			<Head><title>Settings — Hello Neighbor</title></Head>
			<Layout title="">
				<div className="mb-8">
					<h1 className="text-2xl font-bold text-dark">Settings</h1>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
					{ACTIONS.map((action) => {
						const Icon = action.icon;
						return (
							<Link
								key={action.href}
								href={action.href}
								className="card p-6 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150 group"
							>
								<div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
									<Icon size={28} className="text-brand-500" strokeWidth={1.5} />
								</div>
								<h2 className="font-semibold text-dark text-lg mb-1">{action.label}</h2>
								<p className="text-sm text-muted">{action.description}</p>
							</Link>
						);
					})}
				</div>
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
