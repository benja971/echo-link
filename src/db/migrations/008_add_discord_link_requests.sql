-- Migration: Add discord_link_requests table for Discord account linking flow
-- This table stores temporary codes that users generate on the web to link their Discord account

CREATE TABLE IF NOT EXISTS discord_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- Index for code lookups (primary use case)
CREATE INDEX IF NOT EXISTS idx_discord_link_requests_code ON discord_link_requests(code);

-- Index for cleanup of expired requests
CREATE INDEX IF NOT EXISTS idx_discord_link_requests_expires_at ON discord_link_requests(expires_at);

-- Index for finding requests by account
CREATE INDEX IF NOT EXISTS idx_discord_link_requests_account_id ON discord_link_requests(account_id);
