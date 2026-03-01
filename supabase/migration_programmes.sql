-- Table pour stocker les programmes de course
CREATE TABLE IF NOT EXISTS rt_programmes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  race_name TEXT NOT NULL,
  race_date DATE NOT NULL,
  race_distance_km NUMERIC(6,3) NOT NULL,
  race_location TEXT,
  race_elevation_gain INTEGER,
  race_profile TEXT,
  race_url TEXT,
  race_description TEXT,
  objective_type TEXT NOT NULL DEFAULT 'finish', -- 'finish' or 'time'
  objective_time TEXT, -- e.g. '1:45:00'
  availability JSONB DEFAULT '{}'::jsonb, -- { "2026-03-15": { "run": true, "ride": false }, ... }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour retrouver le programme actif rapidement
CREATE INDEX idx_rt_programmes_active ON rt_programmes (is_active) WHERE is_active = true;
