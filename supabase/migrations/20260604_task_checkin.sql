-- =============================================================================
-- Run this ONCE in Supabase (files here are NOT applied automatically):
--   1. https://supabase.com/dashboard → your project
--   2. SQL Editor → New query
--   3. Paste this entire file → Run
--   4. Locally: npm run db:check   (should show check-in columns OK)
-- =============================================================================

alter table tasks add column if not exists checkin_date date;
alter table tasks add column if not exists checkin_time text not null default '16:00';

-- Optional: confirm columns exist (should return checkin_date, checkin_time)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'tasks'
  and column_name in ('checkin_date', 'checkin_time')
order by column_name;
