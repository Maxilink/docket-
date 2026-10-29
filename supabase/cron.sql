-- C-Diary: run the reminder check every 5 minutes.
-- Run this AFTER the app is live on Vercel.
-- 1. Replace YOUR-APP-URL with your Vercel address (for example https://docket-abc.vercel.app).
-- 2. Replace YOUR_CRON_SECRET with the same CRON_SECRET you set in Vercel.
-- 3. Paste into Supabase SQL Editor and Run.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('docket-reminders')
where exists (select 1 from cron.job where jobname = 'docket-reminders');

select cron.schedule(
  'docket-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'YOUR-APP-URL/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check it is running:  select * from cron.job_run_details order by start_time desc limit 5;
-- To stop it:              select cron.unschedule('docket-reminders');
