import TasksPageView from '../../components/TasksPageView';
import { requireAuth } from '../../lib/auth';

export default function CompletedTasksPage() {
	return <TasksPageView />;
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
