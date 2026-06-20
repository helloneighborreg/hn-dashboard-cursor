import { requireAuth } from '../lib/auth';

export default function ExpensesRedirect() {
	return null;
}

export const getServerSideProps = requireAuth(async () => ({
	redirect: { destination: '/transactions?tab=manual', permanent: true },
}));
