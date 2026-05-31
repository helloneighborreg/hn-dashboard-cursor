import { requireAuth } from '../lib/auth';
import { hasLimitedTasksView } from '../lib/roles';
import { TASK_TAB_PATHS } from '../lib/taskRoutes';

/** Legacy route — redirects to the default tasks view for the user's role. */
export default function TasksRedirect() {
	return null;
}

export const getServerSideProps = requireAuth(async (ctx, session) => ({
	redirect: {
		destination: hasLimitedTasksView(session.user)
			? TASK_TAB_PATHS.assigned
			: TASK_TAB_PATHS.unassigned,
		permanent: false,
	},
}));
