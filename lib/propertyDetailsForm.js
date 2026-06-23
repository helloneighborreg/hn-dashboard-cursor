import { toIsoDate } from './dates';

export function amountToForm(value) {
	if (value == null || value === '') return '';
	const n = Number(value);
	if (!Number.isFinite(n)) return '';
	return (Math.round(n * 100) / 100).toFixed(2);
}

export function intToForm(value) {
	return value != null ? String(value) : '';
}

export function dateToForm(value) {
	return toIsoDate(value) || '';
}

export function textToForm(value) {
	return value || '';
}

export function detailsToLeaseForm(details) {
	return {
		rent: amountToForm(details?.rent),
		lease_utilities: amountToForm(details?.lease_utilities),
		lease_electric: amountToForm(details?.lease_electric),
		lease_internet: amountToForm(details?.lease_internet),
		lease_parking: amountToForm(details?.lease_parking),
		lease_expiration: dateToForm(details?.lease_expiration),
		renewal_notice_due: dateToForm(details?.renewal_notice_due),
	};
}

export function detailsToExtrasForm(details) {
	return {
		square_feet: intToForm(details?.square_feet),
		year_built: intToForm(details?.year_built),
		mailbox: textToForm(details?.mailbox),
		parking_number: textToForm(details?.parking_number),
		parking_code: textToForm(details?.parking_code),
	};
}

export function detailsToBackupForm(details) {
	return {
		backup_lockbox_location: textToForm(details?.backup_lockbox_location),
		backup_lockbox_code: textToForm(details?.backup_lockbox_code),
		backup_date_confirmed: dateToForm(details?.backup_date_confirmed),
		backup_image_storage_path: details?.backup_image_storage_path || '',
		backup_image_url: details?.backup_image_url || '',
	};
}

export function detailsToUtilityForm(details) {
	return {
		primary_cleaner: textToForm(details?.primary_cleaner),
		base_cleaning_rate: amountToForm(details?.base_cleaning_rate),
		utilities_provider: textToForm(details?.utilities_provider),
		utilities_account_number: textToForm(details?.utilities_account_number),
		internet_provider: textToForm(details?.internet_provider),
		internet_account_number: textToForm(details?.internet_account_number),
	};
}
