-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the expire-trials function to run every hour at minute 0
SELECT cron.schedule(
  'expire-trials-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xxdswrvqdzqtxbiamkqw.supabase.co/functions/v1/expire-trials',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4ZHN3cnZxZHpxdHhiaWFta3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NjE1MzgsImV4cCI6MjA4MDEzNzUzOH0.YVBILQUJF9dE4_-E8qPcd9PCpOVj5zJ7NYjpBxHGTYg"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);