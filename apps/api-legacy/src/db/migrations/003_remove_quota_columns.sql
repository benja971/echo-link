-- Remove quota columns from users table (now managed via config)
-- These columns were: quota_max_files (default 100) and quota_max_bytes (default 10GB)
-- Now configured via MAX_PER_USER and MAX_SIZE_MB_PER_USER environment variables

ALTER TABLE users DROP COLUMN IF EXISTS quota_max_files;
ALTER TABLE users DROP COLUMN IF EXISTS quota_max_bytes;
