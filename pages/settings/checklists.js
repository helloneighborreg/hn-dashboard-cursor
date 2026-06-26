import Head from 'next/head';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { CHECKLIST_ITEMS } from '../../lib/formsNav';

export default function ChecklistsSettingsPage() {
	return (
		<>
			<Head><title>Checklists — Hello Neighbor</title></Head>
			<Layout title="">
				<div className="mb-8">
					<h1 className="text-2xl font-bold text-dark">Checklists</h1>
					<p className="text-sm text-muted mt-1">Open and manage property turnover checklists.</p>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
					{CHECKLIST_ITEMS.map((checklist) => (
						<Link
							key={checklist.href}
							href={checklist.href}
							className="card p-6 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150 group"
						>
							<div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
								<ClipboardList size={28} className="text-brand-500" strokeWidth={1.5} />
							</div>
							<h2 className="font-semibold text-dark text-lg mb-1">{checklist.label}</h2>
							<p className="text-sm text-muted">{checklist.description}</p>
						</Link>
					))}
				</div>
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
