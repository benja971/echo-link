-- Migration: Add accounts layer above upload_identities
-- This migration introduces a unified "account" concept that groups multiple identities
-- (web email, Discord, etc.) under a single quota/stats umbrella.

-- Step 1: Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_primary_email ON accounts(primary_email) WHERE primary_email IS NOT NULL;

-- Step 2: Add account_id column to upload_identities (nullable initially for migration)
ALTER TABLE upload_identities
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- Step 3: Add account_id column to files (nullable initially for migration)
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- Step 4: Migrate existing data - create accounts for each upload_identity
-- For web_user identities, we try to get the email from the linked user
-- For discord_user identities, we create an account without email

DO $$
DECLARE
  identity_record RECORD;
  new_account_id UUID;
  identity_email TEXT;
BEGIN
  -- Process each upload_identity that doesn't have an account_id yet
  FOR identity_record IN 
    SELECT ui.id, ui.kind, ui.external_id, ui.display_name
    FROM upload_identities ui
    WHERE ui.account_id IS NULL
  LOOP
    -- Determine email for the account
    identity_email := NULL;
    
    IF identity_record.kind = 'web_user' THEN
      -- For web users, external_id is the user.id, get email from users table
      SELECT email INTO identity_email 
      FROM users 
      WHERE id::text = identity_record.external_id;
      
      -- If no user found, use display_name as email (it should be the email)
      IF identity_email IS NULL THEN
        identity_email := identity_record.display_name;
      END IF;
    END IF;
    
    -- Create new account
    INSERT INTO accounts (id, primary_email, created_at, updated_at)
    VALUES (gen_random_uuid(), identity_email, NOW(), NOW())
    RETURNING id INTO new_account_id;
    
    -- Link identity to the new account
    UPDATE upload_identities
    SET account_id = new_account_id
    WHERE id = identity_record.id;
    
    RAISE NOTICE 'Created account % for identity % (kind: %, email: %)',
      new_account_id, identity_record.id, identity_record.kind, COALESCE(identity_email, 'NULL');
  END LOOP;
END $$;

-- Step 5: Populate files.account_id from upload_identities.account_id
UPDATE files f
SET account_id = ui.account_id
FROM upload_identities ui
WHERE f.upload_identity_id = ui.id
  AND f.account_id IS NULL
  AND ui.account_id IS NOT NULL;

-- Step 6: Handle files without upload_identity_id but with user_id (legacy web uploads)
-- Create accounts for legacy users if needed and link their files
DO $$
DECLARE
  file_record RECORD;
  user_record RECORD;
  existing_account_id UUID;
  new_account_id UUID;
BEGIN
  -- Find files with user_id but no account_id
  FOR file_record IN 
    SELECT DISTINCT f.user_id
    FROM files f
    WHERE f.user_id IS NOT NULL
      AND f.account_id IS NULL
  LOOP
    -- Get user info
    SELECT id, email INTO user_record FROM users WHERE id = file_record.user_id;
    
    IF user_record.id IS NOT NULL THEN
      -- Check if there's already an account with this email
      SELECT a.id INTO existing_account_id
      FROM accounts a
      WHERE a.primary_email = user_record.email;
      
      IF existing_account_id IS NOT NULL THEN
        -- Use existing account
        new_account_id := existing_account_id;
      ELSE
        -- Create new account
        INSERT INTO accounts (id, primary_email, created_at, updated_at)
        VALUES (gen_random_uuid(), user_record.email, NOW(), NOW())
        RETURNING id INTO new_account_id;
      END IF;
      
      -- Update files with this user_id
      UPDATE files
      SET account_id = new_account_id
      WHERE user_id = file_record.user_id
        AND account_id IS NULL;
      
      RAISE NOTICE 'Linked files of user % to account %', user_record.email, new_account_id;
    END IF;
  END LOOP;
END $$;

-- Step 7: Create index on account_id for files
CREATE INDEX IF NOT EXISTS idx_files_account_id ON files(account_id);

-- Step 8: Create index on account_id for upload_identities
CREATE INDEX IF NOT EXISTS idx_upload_identities_account_id ON upload_identities(account_id);

-- Note: We keep account_id nullable to allow gradual migration and not break existing uploads
-- In the application code, we will ensure account_id is always set for new records
