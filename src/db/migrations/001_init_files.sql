-- Create files table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  s3_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title TEXT,
  thumbnail_s3_key TEXT,
  expires_at TIMESTAMPTZ
);

-- Create index on created_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);

-- Create index on expires_at for cleanup tasks
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at) WHERE expires_at IS NOT NULL;
