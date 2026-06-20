import Head from 'next/head';
import Layout from '../components/Layout';
import ReportsPage from '../components/reports/ReportsPage';
import { requireAuth } from '../lib/auth';

export default function ReportsRoute() {
	return (
		<>
			<Head><title>Reports — Hello Neighbor</title></Head>
			<Layout title="">
				<ReportsPage />
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
