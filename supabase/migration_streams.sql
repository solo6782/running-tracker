-- Migration: Add streams column for Strava activity streams data
-- Run this in Supabase SQL editor

ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS streams JSONB;
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS hr_zones JSONB;
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS user_notes TEXT;

-- Also add the activity detail columns if not already done
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS laps JSONB;
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS splits_metric JSONB;
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS best_efforts JSONB;
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
ALTER TABLE rt_activities ADD COLUMN IF NOT EXISTS ai_feedback_at TIMESTAMPTZ;

COMMENT ON COLUMN rt_activities.streams IS 'Cached Strava streams (heartrate, velocity, altitude, cadence, distance, time). Auto-purged to keep only 10 most recent.';
