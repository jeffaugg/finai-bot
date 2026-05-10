-- Phase 5: re-engagement nudge tracking
-- Records when (and if) we have already sent a nudge to a user with stale onboarding,
-- so the cron does not spam the same user every day.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_nudged_at timestamptz;
