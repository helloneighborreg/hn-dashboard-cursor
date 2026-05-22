import TasksPageView from '../components/TasksPageView';
import { requireAuth } from '../lib/auth';

export default function TasksPage() {
	return <TasksPageView />;
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
