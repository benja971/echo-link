-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  -- Quotas (defaults: 100 files, 10 GB)
  quota_max_files INTEGER NOT NULL DEFAULT 100,
  quota_max_bytes BIGINT NOT NULL DEFAULT 10737418240
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create magic_links table for email authentication
CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
-- Create index on expires_at for cleanup tasks
CREATE INDEX IF NOT EXISTS idx_magic_links_expires_at ON magic_links(expires_at);

-- Create upload_tokens table for persistent authentication
CREATE TABLE IF NOT EXISTS upload_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  device_info TEXT
);

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_upload_tokens_token ON upload_tokens(token);
-- Create index on user_id for user's tokens queries
CREATE INDEX IF NOT EXISTS idx_upload_tokens_user_id ON upload_tokens(user_id);

-- Alter files table to add user_id relationship
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index on user_id for statistics queries
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
