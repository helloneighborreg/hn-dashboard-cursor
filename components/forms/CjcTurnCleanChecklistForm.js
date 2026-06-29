import TurnCleanChecklistForm from './TurnCleanChecklistForm';
import * as cjcFormBinding from '../../lib/forms/cjcTurnCleanChecklist';

export default function CjcTurnCleanChecklistForm(props) {
	return <TurnCleanChecklistForm formBinding={cjcFormBinding} {...props} />;
}
