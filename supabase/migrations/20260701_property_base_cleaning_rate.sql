-- Base cleaning rate per property (used by CJC turn clean checklist invoice).
alter table property_details
	add column if not exists base_cleaning_rate numeric(10, 2);
