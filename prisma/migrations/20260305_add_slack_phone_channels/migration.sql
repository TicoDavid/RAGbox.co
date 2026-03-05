-- Add 'slack' and 'phone' to mercury_channel enum
ALTER TYPE mercury_channel ADD VALUE IF NOT EXISTS 'slack';
ALTER TYPE mercury_channel ADD VALUE IF NOT EXISTS 'phone';
