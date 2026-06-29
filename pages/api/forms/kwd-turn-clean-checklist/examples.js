import * as kwdForm from '../../../../lib/forms/kwdTurnCleanChecklist';
import { createChecklistExamplesApiHandler, CHECKLIST_API_BODY_PARSER } from '../../../../lib/forms/createChecklistApiHandler';

export const config = CHECKLIST_API_BODY_PARSER;

export default createChecklistExamplesApiHandler(kwdForm);
