-- ============================================================
-- Remove password_hash from users table
-- Password is managed by Supabase Auth, not stored in users table
-- ============================================================

-- Drop the password_hash column
ALTER TABLE users DROP COLUMN password_hash;
