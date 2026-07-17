-- supabase/migrations/20260625000001_push_cron_jobs.sql
-- Schedules pg_cron jobs that dispatch scheduled campaigns and send re-engagement reminders.
--
-- IMPORTANT: app.settings.app_url and app.settings.cron_secret are NOT set by this migration
-- because the app URL changes between local/ngrok/production. After applying this migration,
-- run the ALTER DATABASE commands documented in Task 2 Step 3 of this plan, once per environment.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'dispatch-push-campaigns',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/push/campaigns/dispatch',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', current_setting('app.settings.cron_secret', true)),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'reengagement-reminders',
  '0 14 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/push/jobs/reengagement',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', current_setting('app.settings.cron_secret', true)),
    body := '{}'::jsonb
  );
  $$
);
