-- Profil athlète
CREATE TABLE IF NOT EXISTS rt_athlete_profile (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_of_birth DATE,
  weight_kg NUMERIC(5,1),
  height_cm INTEGER,
  resting_hr INTEGER,
  max_hr INTEGER,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add plan column to programmes availability
-- The availability JSONB now supports:
-- { "2026-03-15": { "run": true, "ride": false, "plan": { "sport": "run", "type": "easy", "title": "...", "duration_min": 40, "description": "..." } } }
