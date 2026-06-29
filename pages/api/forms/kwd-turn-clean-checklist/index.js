import * as kwdForm from '../../../../lib/forms/kwdTurnCleanChecklist';
import { createChecklistApiHandler, CHECKLIST_API_BODY_PARSER } from '../../../../lib/forms/createChecklistApiHandler';

export const config = CHECKLIST_API_BODY_PARSER;

export default createChecklistApiHandler(kwdForm);
