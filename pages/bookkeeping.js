import { requireAuth } from '../lib/auth';

export default function BookkeepingRedirect() {
	return null;
}

export const getServerSideProps = requireAuth(async () => ({
	redirect: { destination: '/transactions?tab=bank', permanent: true },
}));
