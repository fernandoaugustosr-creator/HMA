-- Add unit_id column to time_off_requests table to support scale-specific leaves
ALTER TABLE time_off_requests 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id);

-- Optional: Create an index for better performance when filtering by unit
CREATE INDEX IF NOT EXISTS idx_time_off_requests_unit_id ON time_off_requests(unit_id);
