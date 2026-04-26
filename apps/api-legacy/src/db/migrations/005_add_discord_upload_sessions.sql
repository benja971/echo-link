-- Create discord_upload_sessions table for browser-based uploads initiated from Discord
CREATE TABLE IF NOT EXISTS discord_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  upload_identity_id UUID NOT NULL REFERENCES upload_identities(id) ON DELETE CASCADE,
  
  -- Discord context
  discord_user_id TEXT NOT NULL,
  discord_user_name TEXT,
  discord_channel_id TEXT NOT NULL,
  discord_guild_id TEXT,
  
  -- For sending followup messages
  discord_interaction_token TEXT,
  discord_application_id TEXT,
  
  -- Session state
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'expired'
  file_id UUID REFERENCES files(id) ON DELETE SET NULL, -- linked after upload
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_discord_upload_sessions_token ON discord_upload_sessions(token);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_discord_upload_sessions_expires_at ON discord_upload_sessions(expires_at);

-- Index for finding sessions by identity
CREATE INDEX IF NOT EXISTS idx_discord_upload_sessions_identity ON discord_upload_sessions(upload_identity_id);
