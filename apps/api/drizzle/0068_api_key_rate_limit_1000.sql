-- Raise API keys still on the old default (100 per 60 s) to the new default
-- of 1000. Keys with a custom limit or window are left alone.
UPDATE "apikey" SET "rate_limit_max" = 1000 WHERE "rate_limit_max" = 100 AND "rate_limit_time_window" = 60000;
