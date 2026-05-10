-- Phase 2: stateful onboarding
-- Adds onboarding_step/timezone/reminders_enabled and marks pre-existing
-- users (with non-zero income) as already onboarded.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_step text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true;

UPDATE users
SET onboarding_step = 'completed'
WHERE monthly_income > 0
  AND onboarding_step = 'not_started';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_onboarding_step_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_onboarding_step_check
      CHECK (onboarding_step IN (
        'not_started',
        'awaiting_salary',
        'awaiting_fixed_expenses',
        'awaiting_saving_pct',
        'awaiting_reminder_pref',
        'completed'
      ));
  END IF;
END$$;
