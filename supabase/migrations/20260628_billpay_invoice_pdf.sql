-- Cleaning invoice PDF attached when a task is marked complete

ALTER TABLE billpay_invoices
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text;
