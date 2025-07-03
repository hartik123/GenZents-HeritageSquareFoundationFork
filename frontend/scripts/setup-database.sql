-- Simplified Database Setup Script
-- This script sets up only the required tables for the application
-- Run this script with superuser privileges in your Supabase SQL editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- User preferences
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  
  -- Admin and permissions
  is_admin BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'pending_invitation')),
  permissions TEXT[] DEFAULT '{}',
  invitation_token TEXT,
  invitation_expires_at TIMESTAMPTZ,
  
  -- Usage stats and constraints
  messages_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  files_uploaded INTEGER DEFAULT 0,
  max_storage INTEGER DEFAULT 1048576, -- 1GB in KB
  max_tokens INTEGER DEFAULT 50000,
  max_messages_per_day INTEGER DEFAULT 100,
  max_tasks_per_day INTEGER DEFAULT 10,
  max_api_calls_per_day INTEGER DEFAULT 1000,
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CHATS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  bookmarked BOOLEAN DEFAULT false,
  context_summary TEXT DEFAULT ''
);

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'function')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted BOOLEAN DEFAULT false,
  
  -- Status tracking
  sent BOOLEAN DEFAULT false,
  delivered BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  error_message TEXT,
  retries INTEGER DEFAULT 0,
  status TEXT DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'error')),
  
  -- AI metadata
  tokens INTEGER,
  cost DECIMAL(10,6),
  processing_time INTEGER,
  confidence DECIMAL(3,2),
  language TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral'))
);

-- =====================================================
-- ATTACHMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  content TEXT,
  checksum TEXT NOT NULL,
  
  -- Security scanning
  scanned BOOLEAN DEFAULT false,
  clean BOOLEAN DEFAULT false,
  threats TEXT[] DEFAULT '{}',
  scanned_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- COMMANDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS commands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  pattern TEXT NOT NULL,
  instruction TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('system', 'admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TASKS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  command_id UUID REFERENCES commands(id) ON DELETE SET NULL NOT NULL,
  parameters JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  result JSONB,
  error_message TEXT,
  logs TEXT[] DEFAULT '{}',
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_duration INTEGER,
  
  -- Priority and retry logic
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- VERSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'current' CHECK (status IN ('current', 'previous', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB
);

-- =====================================================
-- CHANGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID REFERENCES versions(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('added', 'modified', 'deleted')),
  original_path TEXT NOT NULL,
  new_path TEXT,
  original_value JSONB,
  new_value JSONB,
  description TEXT,
  command_id UUID REFERENCES commands(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ NOT NULL
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active);

-- Chats indexes
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);

-- Attachments indexes
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_chat_id ON attachments(chat_id);
CREATE INDEX IF NOT EXISTS idx_attachments_type ON attachments(type);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_chat_id ON tasks(chat_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_command_id ON tasks(command_id);

-- Commands indexes
CREATE INDEX IF NOT EXISTS idx_commands_type ON commands(type);
CREATE INDEX IF NOT EXISTS idx_commands_enabled ON commands(enabled);
CREATE INDEX IF NOT EXISTS idx_commands_user_id ON commands(user_id);

-- Versions indexes
CREATE INDEX IF NOT EXISTS idx_versions_user_id ON versions(user_id);
CREATE INDEX IF NOT EXISTS idx_versions_status ON versions(status);
CREATE INDEX IF NOT EXISTS idx_versions_timestamp ON versions(timestamp);

-- Changes indexes
CREATE INDEX IF NOT EXISTS idx_changes_version_id ON changes(version_id);
CREATE INDEX IF NOT EXISTS idx_changes_type ON changes(type);
CREATE INDEX IF NOT EXISTS idx_changes_user_id ON changes(user_id);
CREATE INDEX IF NOT EXISTS idx_changes_command_id ON changes(command_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE changes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Chats policies
CREATE POLICY "Users can view own chats" ON chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chats" ON chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chats" ON chats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chats" ON chats FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages in own chats" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid())
);
CREATE POLICY "Users can insert messages in own chats" ON messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid())
);
CREATE POLICY "Users can update messages in own chats" ON messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid())
);

-- Attachments policies
CREATE POLICY "Users can view attachments in own chats" ON attachments FOR SELECT USING (
  chat_id IS NULL OR EXISTS (SELECT 1 FROM chats WHERE chats.id = attachments.chat_id AND chats.user_id = auth.uid())
);
CREATE POLICY "Users can insert attachments in own chats" ON attachments FOR INSERT WITH CHECK (
  chat_id IS NULL OR EXISTS (SELECT 1 FROM chats WHERE chats.id = attachments.chat_id AND chats.user_id = auth.uid())
);

-- Analytics policies
CREATE POLICY "Users can view own analytics" ON analytics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analytics" ON analytics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tasks policies
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);

-- Commands policies (system and admin commands viewable by all, user commands only by owner)
CREATE POLICY "All can view system/admin commands" ON commands FOR SELECT USING (type IN ('system', 'admin'));
CREATE POLICY "Users can view own user commands" ON commands FOR SELECT USING (type = 'user' AND auth.uid() = user_id);
CREATE POLICY "Users can insert own user commands" ON commands FOR INSERT WITH CHECK (type = 'user' AND auth.uid() = user_id);
CREATE POLICY "Users can update own user commands" ON commands FOR UPDATE USING (type = 'user' AND auth.uid() = user_id);

-- Versions policies
CREATE POLICY "Users can view own versions" ON versions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own versions" ON versions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own versions" ON versions FOR UPDATE USING (auth.uid() = user_id);

-- Changes policies
CREATE POLICY "Users can view changes in own versions" ON changes FOR SELECT USING (
  EXISTS (SELECT 1 FROM versions WHERE versions.id = changes.version_id AND versions.user_id = auth.uid())
);
CREATE POLICY "Users can insert changes in own versions" ON changes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM versions WHERE versions.id = changes.version_id AND versions.user_id = auth.uid())
);

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Insert default system commands
INSERT INTO commands (id, name, description, pattern, instruction, enabled, type) VALUES
  ('00000000-0000-0000-0000-000000000001', 'organize', 'Organize files and folders in the current directory', '^/organize(?:\s+(.+))?$', 'organize', true, 'system'),
  ('00000000-0000-0000-0000-000000000002', 'folder', 'Create or navigate to a specific folder', '^/folder:(\S+)(?:\s+(.+))?$', 'folder', true, 'system'),
  ('00000000-0000-0000-0000-000000000003', 'search', 'Search for files, folders, or content', '^/search(?:\s+(.+))?$', 'search', true, 'system'),
  ('00000000-0000-0000-0000-000000000004', 'cleanup', 'Clean up temporary files and optimize storage', '^/cleanup$', 'cleanup', true, 'system')
ON CONFLICT (id) DO NOTHING;
  bookmarked BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  shared BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  
  -- Chat settings
  model TEXT DEFAULT 'gpt-4',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,
  system_prompt TEXT DEFAULT '',
  context_window INTEGER DEFAULT 4096,
  streaming BOOLEAN DEFAULT true,
  auto_save BOOLEAN DEFAULT true,
  encryption BOOLEAN DEFAULT false,
  retention_days INTEGER DEFAULT 30,
  
  -- Metadata
  total_messages INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  average_response_time DECIMAL(10,3) DEFAULT 0,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  language TEXT DEFAULT 'en',
  domain TEXT DEFAULT 'general',
  context_summary TEXT DEFAULT '',
  
  -- Enhanced context tracking
  last_context_update TIMESTAMPTZ DEFAULT NOW(),
  context_version INTEGER DEFAULT 1,
  
  -- Version control
  version INTEGER DEFAULT 1,
  parent_version UUID REFERENCES chats(id) ON DELETE SET NULL,
  branch TEXT DEFAULT 'main',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table (enhanced)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'function')),
  content TEXT NOT NULL,
  edited BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,
  
  -- Threading
  thread_id UUID,
  parent_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  
  -- Status tracking
  sent BOOLEAN DEFAULT true,
  delivered BOOLEAN DEFAULT true,
  read BOOLEAN DEFAULT false,
  error_message TEXT,
  retries INTEGER DEFAULT 0,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'error')),
  
  -- Encryption
  encrypted BOOLEAN DEFAULT false,
  algorithm TEXT,
  key_id TEXT,
  
  -- Metadata
  model TEXT,
  tokens INTEGER,
  cost DECIMAL(10,6),
  processing_time DECIMAL(10,3),
  confidence DECIMAL(3,2),
  language TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  topics TEXT[] DEFAULT '{}',
  
  -- Enhanced metadata for context processing
  has_commands BOOLEAN DEFAULT false,
  is_command_result BOOLEAN DEFAULT false,
  is_task_notification BOOLEAN DEFAULT false,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  enhanced_context BOOLEAN DEFAULT false,
  context_summary_updated BOOLEAN DEFAULT false,
  command_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FILE AND ATTACHMENT TABLES
-- =====================================================

-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size BIGINT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  content TEXT,
  preview TEXT,
  
  -- File metadata
  width INTEGER,
  height INTEGER,
  duration DECIMAL(10,3),
  pages INTEGER,
  encoding TEXT,
  checksum TEXT NOT NULL,
  
  -- Virus scan results
  scanned BOOLEAN DEFAULT false,
  clean BOOLEAN DEFAULT true,
  threats TEXT[] DEFAULT '{}',
  scanned_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create context_files table
CREATE TABLE IF NOT EXISTS context_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size BIGINT NOT NULL,
  path TEXT NOT NULL,
  content TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INTERACTION TABLES
-- =====================================================

-- Create reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, type)
);

-- Create mentions table
CREATE TABLE IF NOT EXISTS mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_pos INTEGER NOT NULL,
  end_pos INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('user', 'channel', 'file', 'url')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- VERSION CONTROL AND SHARING
-- =====================================================

-- Create chat_versions table
CREATE TABLE IF NOT EXISTS chat_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  changes JSONB DEFAULT '[]',
  parent_version UUID REFERENCES chat_versions(id) ON DELETE SET NULL,
  branch TEXT DEFAULT 'main',
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, version)
);

-- Create share_settings table
CREATE TABLE IF NOT EXISTS share_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_public BOOLEAN DEFAULT false,
  allow_comments BOOLEAN DEFAULT false,
  allow_editing BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  password_hash TEXT,
  domain_restriction TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS TABLE
-- =====================================================

-- Create analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TASK MANAGEMENT TABLE
-- =====================================================

-- Create tasks table for managing long-running background tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  
  -- Task details
  type TEXT NOT NULL CHECK (type IN ('organize', 'search', 'cleanup', 'folder_operation', 'backup', 'analysis')),
  command TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Results and logs
  result JSONB,
  error_message TEXT,
  logs TEXT[] DEFAULT '{}',
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_duration INTEGER, -- seconds
  
  -- Metadata
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check if current user is admin (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin policies for profiles (using security definer function)
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT 
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE 
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete all profiles" ON profiles
  FOR DELETE 
  TO authenticated
  USING (is_admin());

-- User settings policies
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Drop existing chat policies to avoid conflicts (in case of re-running script)
DROP POLICY IF EXISTS "Users can view own chats" ON chats;
DROP POLICY IF EXISTS "Users can create own chats" ON chats;
DROP POLICY IF EXISTS "Users can update own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete own chats" ON chats;
DROP POLICY IF EXISTS "Admins can manage all chats" ON chats;

-- Chats policies (recreated with proper permissions)
CREATE POLICY "Users can view own chats" ON chats
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chats" ON chats
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats" ON chats
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats" ON chats
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin policies for chats
CREATE POLICY "Admins can manage all chats" ON chats
  FOR ALL 
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Messages policies
CREATE POLICY "Users can view messages in accessible chats" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id 
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in accessible chats" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id 
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id 
      AND chats.user_id = auth.uid()
    )
  );

-- Attachments policies
CREATE POLICY "Users can view attachments in accessible chats/messages" ON attachments
  FOR SELECT USING (
    (message_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM messages m
      JOIN chats c ON c.id = m.chat_id
      WHERE m.id = attachments.message_id 
      AND c.user_id = auth.uid()
    )) OR
    (chat_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = attachments.chat_id 
      AND chats.user_id = auth.uid()
    ))
  );

-- Reactions policies
CREATE POLICY "Users can view reactions in accessible messages" ON reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chats c ON c.id = m.chat_id
      WHERE m.id = reactions.message_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own reactions" ON reactions
  FOR ALL USING (auth.uid() = user_id);

-- Analytics policies (users can only see their own data)
CREATE POLICY "Users can view own analytics" ON analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert analytics" ON analytics
  FOR INSERT WITH CHECK (true);

-- Additional policies for other tables following similar patterns
CREATE POLICY "Users can view mentions in accessible messages" ON mentions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chats c ON c.id = m.chat_id
      WHERE m.id = mentions.message_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view versions of accessible chats" ON chat_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = chat_versions.chat_id 
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view comments in accessible messages" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chats c ON c.id = m.chat_id
      WHERE m.id = comments.message_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view context files in accessible chats" ON context_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = context_files.chat_id 
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view share settings of own chats" ON share_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = share_settings.chat_id 
      AND chats.user_id = auth.uid()
    )
  );

-- Tasks policies
CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks" ON tasks
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin policies for tasks
CREATE POLICY "Admins can view all tasks" ON tasks
  FOR SELECT 
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all tasks" ON tasks
  FOR UPDATE 
  TO authenticated
  USING (is_admin());

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles with auth management fields
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    is_admin, 
    status, 
    permissions
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false),
    COALESCE(NEW.raw_user_meta_data->>'status', 'active'),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'permissions')),
      '{}'::text[]
    )
  );
  
  -- Insert default user settings
  INSERT INTO user_settings (user_id) VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to promote a user to admin status
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Find the user by email
    SELECT id INTO user_id FROM profiles WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RAISE NOTICE 'User with email % not found', user_email;
        RETURN FALSE;
    END IF;
    
    -- Update user to admin status
    UPDATE profiles SET
        is_admin = true,
        status = 'active',
        permissions = '{"admin_access", "ai_chat", "file_organization", "version_history", "context_management", "tools_access"}',
        updated_at = NOW()
    WHERE id = user_id;
    
    RAISE NOTICE 'User % promoted to admin', user_email;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate user permissions
CREATE OR REPLACE FUNCTION validate_user_permissions(user_id UUID, required_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_permissions TEXT[];
    is_admin BOOLEAN;
BEGIN
    SELECT permissions, is_admin INTO user_permissions, is_admin
    FROM profiles 
    WHERE id = user_id;
    
    -- Admins have all permissions
    IF is_admin THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has the required permission
    RETURN required_permission = ANY(user_permissions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update chat metadata when messages are added
CREATE OR REPLACE FUNCTION update_chat_metadata()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE chats SET 
      total_messages = total_messages + 1,
      total_tokens = total_tokens + COALESCE(NEW.tokens, 0),
      last_activity = NOW(),
      updated_at = NOW()
    WHERE id = NEW.chat_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE chats SET 
      total_messages = GREATEST(total_messages - 1, 0),
      total_tokens = GREATEST(total_tokens - COALESCE(OLD.tokens, 0), 0),
      updated_at = NOW()
    WHERE id = OLD.chat_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update user usage stats
CREATE OR REPLACE FUNCTION update_user_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update message count and tokens used
    UPDATE profiles SET 
      messages_count = messages_count + 1,
      tokens_used = tokens_used + COALESCE(NEW.tokens, 0),
      last_active = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CREATE TRIGGERS
-- =====================================================

-- Triggers for updated_at timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_share_settings_updated_at
  BEFORE UPDATE ON share_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for tasks
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for chat metadata updates
CREATE TRIGGER update_chat_metadata_on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_metadata();

CREATE TRIGGER update_chat_metadata_on_message_delete
  AFTER DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_metadata();

-- Trigger for user usage stats
CREATE TRIGGER update_user_usage_stats_on_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_user_usage_stats();

-- =====================================================
-- CREATE INDEXES
-- =====================================================

-- Auth management indexes
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Chat system indexes
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);
CREATE INDEX IF NOT EXISTS idx_chats_tags ON chats USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);

CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_chat_id ON attachments(chat_id);
CREATE INDEX IF NOT EXISTS idx_attachments_type ON attachments(type);

CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);

CREATE INDEX IF NOT EXISTS idx_mentions_message_id ON mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_mentions_user_id ON mentions(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_versions_chat_id ON chat_versions(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_versions_version ON chat_versions(version);
CREATE INDEX IF NOT EXISTS idx_chat_versions_created_by ON chat_versions(created_by);

CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Task management indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_chat_id ON tasks(chat_id);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON messages USING GIN(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_chats_title_fts ON chats USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_chats_description_fts ON chats USING GIN(to_tsvector('english', description));

-- =====================================================
-- CONSTRAINTS
-- =====================================================

-- Add check constraint for permissions
ALTER TABLE profiles ADD CONSTRAINT check_permissions 
  CHECK (permissions <@ ARRAY['ai_chat', 'file_organization', 'version_history', 'context_management', 'tools_access', 'admin_access']);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE profiles TO authenticated;
GRANT ALL ON TABLE user_settings TO authenticated;
GRANT ALL ON TABLE chats TO authenticated;
GRANT ALL ON TABLE messages TO authenticated;
GRANT ALL ON TABLE attachments TO authenticated;
GRANT ALL ON TABLE reactions TO authenticated;
GRANT ALL ON TABLE mentions TO authenticated;
GRANT ALL ON TABLE chat_versions TO authenticated;
GRANT ALL ON TABLE comments TO authenticated;
GRANT ALL ON TABLE context_files TO authenticated;
GRANT ALL ON TABLE share_settings TO authenticated;
GRANT ALL ON TABLE analytics TO authenticated;
GRANT ALL ON TABLE tasks TO authenticated;

GRANT EXECUTE ON FUNCTION validate_user_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION promote_user_to_admin TO authenticated;

-- =====================================================
-- ADMIN USER PROMOTION
-- =====================================================

-- Promote admin user if they exist
-- SELECT promote_user_to_admin('admin@example.com');

-- =====================================================
-- ENHANCED INDEXES FOR CONTEXT PROCESSING
-- =====================================================

-- Indexes for enhanced context retrieval performance
CREATE INDEX IF NOT EXISTS idx_chats_context_summary ON chats(context_summary) WHERE context_summary IS NOT NULL AND context_summary != '';
CREATE INDEX IF NOT EXISTS idx_chats_last_context_update ON chats(last_context_update);
CREATE INDEX IF NOT EXISTS idx_chats_context_version ON chats(context_version);

-- Composite index for message context retrieval (chat_id + deleted + created_at DESC for recent messages)
CREATE INDEX IF NOT EXISTS idx_messages_context_retrieval ON messages(chat_id, deleted, created_at DESC) WHERE deleted = false;

-- Indexes for enhanced metadata
CREATE INDEX IF NOT EXISTS idx_messages_enhanced_context ON messages(enhanced_context) WHERE enhanced_context = true;
CREATE INDEX IF NOT EXISTS idx_messages_has_commands ON messages(has_commands) WHERE has_commands = true;
CREATE INDEX IF NOT EXISTS idx_messages_task_id ON messages(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_context_summary_updated ON messages(context_summary_updated) WHERE context_summary_updated = true;

-- Indexes for user settings (context preferences)
CREATE INDEX IF NOT EXISTS idx_user_settings_custom_instructions ON user_settings(custom_instructions) WHERE custom_instructions IS NOT NULL AND custom_instructions != '';
CREATE INDEX IF NOT EXISTS idx_user_settings_communication_style ON user_settings(communication_style);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);

-- Partial indexes for better performance on commonly filtered data
CREATE INDEX IF NOT EXISTS idx_messages_recent_by_chat ON messages(chat_id, created_at DESC) 
  WHERE deleted = false AND created_at > (NOW() - INTERVAL '30 days');

-- Full text search index for message content (for context search)
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages USING gin(to_tsvector('english', content))
  WHERE deleted = false;

COMMENT ON INDEX idx_chats_context_summary IS 'Index for finding chats with context summaries for enhanced processing';
COMMENT ON INDEX idx_messages_context_retrieval IS 'Optimized index for retrieving recent messages for context building';
COMMENT ON INDEX idx_messages_enhanced_context IS 'Index for identifying messages processed with enhanced context';
COMMENT ON INDEX idx_messages_content_search IS 'Full text search index for semantic context retrieval';
