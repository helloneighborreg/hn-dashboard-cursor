import { requireAuth } from '../lib/auth';

export default function TransactionsRedirect() {
	return null;
}

export const getServerSideProps = requireAuth(async () => ({
	redirect: {
		destination: '/income',
		permanent: true,
	},
}));
