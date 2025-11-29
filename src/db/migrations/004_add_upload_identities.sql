-- Create upload_identities table to track upload sources (web users, discord users, etc.)
CREATE TABLE IF NOT EXISTS upload_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL, -- 'web_user', 'discord_user', etc.
  external_id TEXT NOT NULL, -- user_id for web, discord_user_id for discord
  display_name TEXT,
  extra_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on kind + external_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS upload_identities_kind_external_id_idx
  ON upload_identities(kind, external_id);

-- Index on kind for filtering by identity type
CREATE INDEX IF NOT EXISTS idx_upload_identities_kind ON upload_identities(kind);

-- Add upload_identity_id to files table
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS upload_identity_id UUID REFERENCES upload_identities(id) ON DELETE SET NULL;

-- Create index for querying files by upload_identity
CREATE INDEX IF NOT EXISTS idx_files_upload_identity_id ON files(upload_identity_id);
