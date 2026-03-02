-- Add laps (from Strava detail) and AI feedback columns
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS laps JSONB;
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS splits_metric JSONB;
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS best_efforts JSONB;
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS ai_feedback_at TIMESTAMPTZ;
