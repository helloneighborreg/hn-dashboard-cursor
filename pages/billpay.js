import Head from 'next/head';
import Layout from '../components/Layout';
import BillpayPage from '../components/billpay/BillpayPage';
import { requireAuth } from '../lib/auth';

export default function BillpayRoute() {
	return (
		<>
			<Head><title>Billpay — Hello Neighbor</title></Head>
			<Layout title="">
				<BillpayPage />
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
