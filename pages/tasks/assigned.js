import { requireAuth } from '../../lib/auth';

/** Legacy route — redirects to the combined Tasks page. */
export default function AssignedTasksRedirect() {
	return null;
}

export const getServerSideProps = requireAuth(async () => ({
	redirect: { destination: '/tasks?tab=assigned', permanent: false },
}));
