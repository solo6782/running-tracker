-- Cache des mesures Withings
CREATE TABLE IF NOT EXISTS rt_withings_measures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  measure_date DATE NOT NULL,
  weight_kg NUMERIC(5,2),
  fat_ratio_pct NUMERIC(5,2),
  fat_mass_kg NUMERIC(5,2),
  fat_free_mass_kg NUMERIC(5,2),
  muscle_mass_kg NUMERIC(5,2),
  bone_mass_kg NUMERIC(4,2),
  hydration_kg NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(measure_date)
);

CREATE INDEX IF NOT EXISTS idx_rt_withings_measures_date ON rt_withings_measures(measure_date DESC);
