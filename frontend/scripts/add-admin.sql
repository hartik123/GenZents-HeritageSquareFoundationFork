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
    jsonb_build_object(
      'full_name', 'System Administrator',
      'is_admin', true,
      'status', 'active',
      'permissions', jsonb_build_array('admin_access', 'ai_chat', 'file_organization', 'version_history', 'context_management', 'tools_access')
    )
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();  
  -- Insert into auth.identities (check if it already exists first)
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    created_at,
    updated_at
  ) 
  SELECT 
    admin_user_id::text,
    admin_user_id,
    jsonb_build_object('sub', admin_user_id::text, 'email', 'admin@example.com'),
    'email',
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities 
    WHERE user_id = admin_user_id AND provider = 'email'
  );
  
  -- Update existing identity if it exists
  UPDATE auth.identities SET
    identity_data = jsonb_build_object('sub', admin_user_id::text, 'email', 'admin@example.com'),
    updated_at = NOW()
  WHERE user_id = admin_user_id AND provider = 'email';
  
  -- Insert or update the profile (handle case where trigger might not fire)
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    is_admin, 
    status, 
    permissions,
    subscription_plan,
    subscription_features,
    billing_currency,
    messages_per_day,
    tokens_per_month,
    file_uploads,
    custom_models,
    last_active
  ) VALUES (
    admin_user_id,
    'admin@example.com',
    'System Administrator',
    TRUE,
    'active',
    ARRAY['admin_access', 'ai_chat', 'file_organization', 'version_history', 'context_management', 'tools_access']::TEXT[],
    'enterprise',
    ARRAY['basic_chat', 'file_upload', 'advanced_models', 'custom_models', 'priority_support']::TEXT[],
    'USD',
    10000,
    10000000,
    1000,
    50,
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_admin = EXCLUDED.is_admin,
    status = EXCLUDED.status,
    permissions = EXCLUDED.permissions,
    subscription_plan = EXCLUDED.subscription_plan,
    subscription_features = EXCLUDED.subscription_features,
    billing_currency = EXCLUDED.billing_currency,
    messages_per_day = EXCLUDED.messages_per_day,
    tokens_per_month = EXCLUDED.tokens_per_month,
    file_uploads = EXCLUDED.file_uploads,
    custom_models = EXCLUDED.custom_models,
    last_active = NOW(),
    updated_at = NOW();  
  -- Insert or update user settings (handle case where trigger might not fire)
  INSERT INTO user_settings (
    user_id,
    default_model,
    communication_style,
    response_length,
    expertise_level
  ) VALUES (
    admin_user_id,
    'gpt-4',
    'professional',
    'detailed',
    'expert'
  ) ON CONFLICT (user_id) DO UPDATE SET
    default_model = EXCLUDED.default_model,
    communication_style = EXCLUDED.communication_style,
    response_length = EXCLUDED.response_length,
    expertise_level = EXCLUDED.expertise_level,
    updated_at = NOW();
  
  RAISE NOTICE 'Admin user created/updated successfully with ID: %', admin_user_id;
  RAISE NOTICE 'Admin credentials: admin@example.com / admin_example_password';
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
  p.subscription_plan,
  p.created_at
FROM profiles p
WHERE p.email = 'admin@example.com';

-- Check user settings were created
SELECT 
  us.user_id,
  us.default_model,
  us.communication_style,
  us.response_length,
  us.expertise_level
FROM user_settings us
JOIN profiles p ON p.id = us.user_id
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
3. Create user settings optimized for admin use

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

SUBSCRIPTION: Enterprise plan with maximum limits
- Messages per day: 10,000
- Tokens per month: 10,000,000
- File uploads: 1,000
- Custom models: 50

SECURITY NOTE: 
Please change the default password after first login for security.
The admin user has full access to the system including user management.

The script is idempotent - you can run it multiple times safely.
*/
