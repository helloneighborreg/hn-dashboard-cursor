import TurnCleanChecklistForm from './TurnCleanChecklistForm';
import * as kwdFormBinding from '../../lib/forms/kwdTurnCleanChecklist';

export default function KwdTurnCleanChecklistForm(props) {
	return <TurnCleanChecklistForm formBinding={kwdFormBinding} {...props} />;
}
