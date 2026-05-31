import TasksPageView from '../../components/TasksPageView';
import { requireAuth } from '../../lib/auth';
import { hasLimitedTasksView } from '../../lib/roles';
import { TASK_TAB_PATHS } from '../../lib/taskRoutes';

export default function UnassignedTasksPage() {
	return <TasksPageView />;
}

export const getServerSideProps = requireAuth(async (ctx, session) => {
	if (hasLimitedTasksView(session.user)) {
		return { redirect: { destination: TASK_TAB_PATHS.assigned, permanent: false } };
	}
	return { props: {} };
});
