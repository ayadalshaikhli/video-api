-- Add status field to user_roles table
ALTER TABLE user_roles ADD COLUMN status VARCHAR(20) DEFAULT 'active' NOT NULL;

-- Add index for status field
CREATE INDEX idx_user_roles_status ON user_roles(status);

-- Update existing records to have 'active' status
UPDATE user_roles SET status = 'active' WHERE status IS NULL; 