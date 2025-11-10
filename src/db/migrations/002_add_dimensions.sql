-- Add width and height columns for image/video dimensions
ALTER TABLE files
ADD COLUMN width INTEGER,
ADD COLUMN height INTEGER;

-- Add index for querying files with dimensions
CREATE INDEX idx_files_dimensions ON files(width, height) WHERE width IS NOT NULL AND height IS NOT NULL;
