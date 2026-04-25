-- Add interaction token columns to discord_upload_sessions
-- These are used to send ephemeral followup messages after upload

ALTER TABLE discord_upload_sessions 
ADD COLUMN IF NOT EXISTS discord_interaction_token TEXT;

ALTER TABLE discord_upload_sessions 
ADD COLUMN IF NOT EXISTS discord_application_id TEXT;
