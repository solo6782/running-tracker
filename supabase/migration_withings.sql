-- Table pour stocker les tokens Withings OAuth2
CREATE TABLE IF NOT EXISTS rt_withings_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  withings_userid TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
