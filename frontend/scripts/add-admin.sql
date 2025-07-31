-- Admin User Creation Script
-- This script creates an admin user with specified credentials
-- Email: admin@example.com
-- Password: admin_example_password

-- =====================================================
-- CREATE ADMIN USER (AUTH + PROFILE)
-- =====================================================

DO $$
DECLARE
  admin_user_id UUID;
  hashed_password TEXT;
BEGIN
  -- Generate a consistent UUID for the admin user
  admin_user_id := '00000000-0000-0000-0000-000000000001'::UUID;
  
  -- Hash the password using crypt (bcrypt)
  hashed_password := crypt('admin_example_password', gen_salt('bf'));
  
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    raw_user_meta_data
  ) VALUES (
    admin_user_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'authenticated',
    'authenticated',
    'admin@example.com',
    hashed_password,
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '{}'::JSONB
  ) ON CONFLICT (id) DO NOTHING;

  -- Insert into profiles table
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    created_at,
    updated_at,
    theme,
    language,
    timezone,
    notifications,
    communication_style,
    response_length,
    temperature,
    system_prompt,
    is_admin,
    status,
    permissions,
    messages_count,
    tokens_used,
    files_uploaded,
    max_storage,
    max_tokens,
    max_messages_per_day,
    max_tasks_per_day,
    max_api_calls_per_day,
    last_active
  ) VALUES (
    admin_user_id,
    'admin@example.com',
    'System Administrator',
    NOW(),
    NOW(),
    'system',
    'en',
    'UTC',
    '{"email":true,"push":true,"desktop":true,"sound":true}',
    'professional',
    'comprehensive',
    0.7,
    'You are the system administrator.',
    TRUE,
    'active',
    ARRAY['ai_chat', 'file_organization', 'version_history', 'context_management', 'tools_access', 'admin_access'],
    0,
    0,
    0,
    10485760, -- 10GB in KB
    500000,
    10000,
    1000,
    100000,
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    theme = EXCLUDED.theme,
    language = EXCLUDED.language,
    timezone = EXCLUDED.timezone,
    notifications = EXCLUDED.notifications,
    communication_style = EXCLUDED.communication_style,
    response_length = EXCLUDED.response_length,
    temperature = EXCLUDED.temperature,
    system_prompt = EXCLUDED.system_prompt,
    is_admin = TRUE,
    status = 'active',
    permissions = ARRAY['ai_chat', 'file_organization', 'version_history', 'context_management', 'tools_access', 'admin_access'],
    max_storage = 10485760,
    max_tokens = 500000,
    max_messages_per_day = 10000,
    max_tasks_per_day = 1000,
    max_api_calls_per_day = 100000,
    updated_at = NOW();

  RAISE NOTICE 'Admin user created successfully with ID: %', admin_user_id;
  RAISE NOTICE 'Email: admin@example.com';
  RAISE NOTICE 'Password: admin_example_password';
  RAISE NOTICE 'Please change the password after first login!';

END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify the admin user was created successfully
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.is_admin,
  p.status,
  p.permissions,
  p.created_at
FROM profiles p
WHERE p.email = 'admin@example.com';

-- =====================================================
-- SIMPLIFIED SETUP INSTRUCTIONS
-- =====================================================

/*
SETUP IS NOW AUTOMATED:

Just run this SQL script in your Supabase SQL Editor - no manual steps needed!

This script will:
1. Create the auth user directly in the database
2. Set up the admin profile with full permissions

ADMIN USER CREDENTIALS:
Email: admin@example.com
Password: admin_example_password

ADMIN PERMISSIONS:
- admin_access: Full administrative access
- ai_chat: Can use AI chat functionality
- file_organization: Can organize files and folders
- version_history: Can manage version history
- context_management: Can manage context
- tools_access: Can access additional tools

LIMITS:
- Max storage: 10GB
- Max tokens: 500,000
- Max messages per day: 10,000
- Max tasks per day: 1,000
- Max API calls per day: 100,000

SECURITY NOTE: 
Please change the default password after first login for security.
The admin user has full access to the system including user management.

The script is idempotent - you can run it multiple times safely.
*/
