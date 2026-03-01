-- ============================================
-- Running Tracker — Supabase Schema V1
-- Préfixe rt_ pour cohabiter avec d'autres apps
-- ============================================

-- Table utilisateur (mono-utilisateur mais prêt pour le multi)
CREATE TABLE rt_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strava_athlete_id BIGINT UNIQUE,
  strava_access_token TEXT,
  strava_refresh_token TEXT,
  strava_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table activités — schéma basé sur l'analyse du dump Strava réel
CREATE TABLE rt_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES rt_users(id) ON DELETE CASCADE NOT NULL,
  strava_id BIGINT UNIQUE NOT NULL,

  -- Identité
  sport_type TEXT NOT NULL,
  name TEXT,
  description TEXT,
  activity_date TIMESTAMPTZ NOT NULL,

  -- Métriques universelles
  elapsed_time_s REAL,
  moving_time_s REAL,
  distance_m REAL,
  avg_hr REAL,
  max_hr REAL,
  calories REAL,

  -- Performance
  avg_speed_ms REAL,
  max_speed_ms REAL,
  avg_watts REAL,
  weighted_avg_power REAL,
  avg_cadence REAL,
  max_cadence REAL,
  training_load REAL,
  intensity REAL,

  -- Terrain
  elevation_gain REAL,
  elevation_loss REAL,
  elevation_low REAL,
  elevation_high REAL,

  -- Running spécifique
  total_steps REAL,
  grade_adjusted_distance REAL,

  -- Carte (pour futur affichage)
  summary_polyline TEXT,

  -- Météo (colonnes dédiées pour corrélations IA)
  weather_temp REAL,
  weather_apparent_temp REAL,
  weather_condition TEXT,
  weather_humidity REAL,
  weather_pressure REAL,
  weather_wind_speed REAL,
  weather_wind_gust REAL,

  -- Ressenti (saisie manuelle)
  perceived_difficulty SMALLINT CHECK (perceived_difficulty BETWEEN 1 AND 10),
  perceived_feeling SMALLINT CHECK (perceived_feeling BETWEEN 1 AND 7),

  -- Équipement
  gear_name TEXT,

  -- Données brutes (filet de sécurité — on garde TOUT)
  raw_json JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_rt_activities_user_date ON rt_activities(user_id, activity_date DESC);
CREATE INDEX idx_rt_activities_sport_type ON rt_activities(user_id, sport_type);
CREATE INDEX idx_rt_activities_strava_id ON rt_activities(strava_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION rt_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rt_users_updated_at
  BEFORE UPDATE ON rt_users
  FOR EACH ROW EXECUTE FUNCTION rt_update_updated_at();

CREATE TRIGGER rt_activities_updated_at
  BEFORE UPDATE ON rt_activities
  FOR EACH ROW EXECUTE FUNCTION rt_update_updated_at();

-- Row Level Security
ALTER TABLE rt_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rt_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON rt_users FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON rt_activities FOR ALL USING (true);
