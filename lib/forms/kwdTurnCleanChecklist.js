import schema from './kwdTurnCleanChecklist.schema.json';
import { createTurnCleanChecklistModule } from './turnCleanChecklistFactory';

const checklist = createTurnCleanChecklistModule(schema, {
	pagePath: '/forms/kwd-turn-clean-checklist',
	ids: {
		guest: '3UUV',
		property: 'jVpt',
		reservation: 'cdyd',
		task: 'm1cH',
		cleaner: 'caar',
		today: 'oNEm',
		taskPrefill: 'q6K9',
		reservationPrefill: '17it',
		previousGuestPhoto: '23dg',
		keyFobPhoto: 'cdgA',
		additionalCharge: 'o3tQ',
		additionalAmount: 'ub6H',
		additionalDetails: 'c2iY',
		additionalPhoto: 'c8HY',
		maintenance: 'kMt1',
		maintenanceDetails: 'kMt2',
		maintenancePhoto: 'kMt3',
		notes: '4WY4',
		baseCleanFee: '9kjH',
		additionalCalcMirror: '6xuf',
		totalAmount: '97S4',
	},
});

export const KWD_TURN_CLEAN_FORM = checklist.FORM;
export const TURN_CLEAN_FORM = checklist.FORM;
export const KWD_TURN_CLEAN_FORM_ID = checklist.FORM_ID;
export const KWD_TURN_CLEAN_FORM_SLUG = checklist.FORM_SLUG;
export const FORM_ID = checklist.FORM_ID;
export const FORM_SLUG = checklist.FORM_SLUG;
export const KWD_CHECKLIST_IDS = checklist.ids;
export const CHECKLIST_IDS = checklist.ids;
export const URL_PARAM_TO_QUESTION = checklist.URL_PARAM_TO_QUESTION;
export const HEADER_QUESTION_IDS = checklist.HEADER_QUESTION_IDS;
export const HIDDEN_QUESTION_IDS = checklist.HIDDEN_QUESTION_IDS;
export const HIDDEN_FOOTER_QUESTION_IDS = checklist.HIDDEN_FOOTER_QUESTION_IDS;
export const FOOTER_QUESTION_IDS = checklist.FOOTER_QUESTION_IDS;
export const ADDITIONAL_CHARGES_QUESTION_IDS = checklist.ADDITIONAL_CHARGES_QUESTION_IDS;
export const MAINTENANCE_QUESTION_IDS = checklist.MAINTENANCE_QUESTION_IDS;
export const getQuestion = checklist.getQuestion;
export const buildChecklistSections = checklist.buildChecklistSections;
export const buildChecklistRoomGroups = checklist.buildChecklistRoomGroups;
export const isRoomGroupComplete = checklist.isRoomGroupComplete;
export const buildExamplePhotoSections = checklist.buildExamplePhotoSections;
export const buildExamplePhotoRoomGroups = checklist.buildExamplePhotoRoomGroups;
export const createInitialFormValues = checklist.createInitialFormValues;
export const applyUrlParamsToFormValues = checklist.applyUrlParamsToFormValues;
export const applyCalculations = checklist.applyCalculations;
export const validateForm = checklist.validateForm;
export const serializeAnswers = checklist.serializeAnswers;
export const invoiceTotal = checklist.invoiceTotal;
export const deserializeAnswers = checklist.deserializeAnswers;
export const buildKwdSubmissionViewUrl = checklist.buildSubmissionViewUrl;
export const buildSubmissionViewUrl = checklist.buildSubmissionViewUrl;
export const roomFromSectionTitle = checklist.roomFromSectionTitle;
export const areaFromSectionTitle = checklist.areaFromSectionTitle;
