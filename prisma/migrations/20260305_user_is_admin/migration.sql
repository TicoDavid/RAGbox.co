-- Add isAdmin boolean to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Set David's accounts as admin
UPDATE users SET is_admin = true WHERE email IN ('d05279090@gmail.com', 'theconnexusai@gmail.com');
