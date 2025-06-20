-- Create profiles table (extended user information)
CREATE TABLE IF NOT EXISTS profiles (
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
  
  -- Subscription information
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'enterprise')),
  subscription_features TEXT[] DEFAULT '{}',
  billing_amount DECIMAL(10,2) DEFAULT 0,
  billing_currency TEXT DEFAULT 'USD',
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'yearly')),
  next_billing TIMESTAMPTZ,
    -- Usage limits
  messages_per_day INTEGER DEFAULT 50,
  tokens_per_month INTEGER DEFAULT 100000,
  file_uploads INTEGER DEFAULT 10,
  custom_models INTEGER DEFAULT 0,
  
  -- Usage stats
  messages_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  files_uploaded INTEGER DEFAULT 0,
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_settings table for detailed preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Notification settings
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  desktop_notifications BOOLEAN DEFAULT true,
  sound_notifications BOOLEAN DEFAULT true,
  mention_notifications BOOLEAN DEFAULT true,
  reply_notifications BOOLEAN DEFAULT true,
  
  -- Privacy settings
  profile_visibility TEXT DEFAULT 'private' CHECK (profile_visibility IN ('public', 'private', 'friends')),
  data_sharing BOOLEAN DEFAULT false,
  analytics BOOLEAN DEFAULT false,
  marketing BOOLEAN DEFAULT false,
  
  -- Accessibility settings
  high_contrast BOOLEAN DEFAULT false,
  reduced_motion BOOLEAN DEFAULT false,
  screen_reader BOOLEAN DEFAULT false,
  font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large', 'xl')),
  keyboard_navigation BOOLEAN DEFAULT false,
  
  -- App settings
  default_model TEXT DEFAULT 'gpt-4',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  system_prompt TEXT DEFAULT '',
  max_tokens INTEGER DEFAULT 2048,
  custom_instructions TEXT DEFAULT '',
  communication_style TEXT DEFAULT 'balanced' CHECK (communication_style IN ('professional', 'casual', 'friendly', 'balanced', 'technical')),
  response_length TEXT DEFAULT 'balanced' CHECK (response_length IN ('concise', 'balanced', 'detailed', 'comprehensive')),
  expertise_level TEXT DEFAULT 'intermediate' CHECK (expertise_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  
  -- Display preferences
  show_timestamps BOOLEAN DEFAULT false,
  show_word_count BOOLEAN DEFAULT false,
  show_model_info BOOLEAN DEFAULT false,
  show_token_count BOOLEAN DEFAULT false,
  show_avatars BOOLEAN DEFAULT true,
  compact_mode BOOLEAN DEFAULT false,
  full_screen_mode BOOLEAN DEFAULT false,
  
  -- Other settings
  auto_save BOOLEAN DEFAULT true,
  auto_save_interval INTEGER DEFAULT 30,
  encrypt_messages BOOLEAN DEFAULT false,
  retention_days INTEGER DEFAULT 30,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create AI models table
CREATE TABLE IF NOT EXISTS ai_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'audio', 'video', 'multimodal')),
  capabilities JSONB DEFAULT '[]',
  pricing JSONB DEFAULT '{}',
  limits JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'beta')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, provider)
);

-- Create chats table (enhanced)
CREATE TABLE IF NOT EXISTS chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  description TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT DEFAULT 'general',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  is_template BOOLEAN DEFAULT false,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Create analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event TEXT NOT NULL,
  properties JSONB DEFAULT '{}',  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
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

-- Create comprehensive RLS policies

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User settings policies
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AI models policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view AI models" ON ai_models
  FOR SELECT USING (auth.role() = 'authenticated');

-- Chats policies
CREATE POLICY "Users can view own chats" ON chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chats" ON chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats" ON chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats" ON chats
  FOR DELETE USING (auth.uid() = user_id);

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
    )  );

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

-- Additional policies for other tables following similar patterns...
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

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  -- Insert default user settings
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON ai_models
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

-- Create triggers for chat metadata updates
CREATE TRIGGER update_chat_metadata_on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_metadata();

CREATE TRIGGER update_chat_metadata_on_message_delete
  AFTER DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_metadata();

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

-- Create trigger for user usage stats
CREATE TRIGGER update_user_usage_stats_on_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_user_usage_stats();

-- Create indexes for better performance
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
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Create full-text search indexes for content search
CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON messages USING GIN(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_chats_title_fts ON chats USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_chats_description_fts ON chats USING GIN(to_tsvector('english', description));

-- Insert some default AI models
INSERT INTO ai_models (name, provider, type, description, capabilities, pricing, limits) VALUES
('GPT-4', 'openai', 'text', 'Advanced language model with superior reasoning capabilities', 
 '[{"name": "text_generation", "supported": true, "quality": "excellent"}, {"name": "code_generation", "supported": true, "quality": "excellent"}]',
 '{"input_cost": 0.03, "output_cost": 0.06, "currency": "USD", "unit": "1K tokens"}',
 '{"max_tokens": 4096, "max_requests_per_minute": 500, "max_requests_per_day": 10000, "context_window": 8192}'),

('GPT-3.5 Turbo', 'openai', 'text', 'Fast and efficient language model for most tasks',
 '[{"name": "text_generation", "supported": true, "quality": "high"}, {"name": "code_generation", "supported": true, "quality": "high"}]',
 '{"input_cost": 0.0015, "output_cost": 0.002, "currency": "USD", "unit": "1K tokens"}',
 '{"max_tokens": 4096, "max_requests_per_minute": 3500, "max_requests_per_day": 90000, "context_window": 4096}'),

('Claude-3 Opus', 'anthropic', 'text', 'Anthropic''s most powerful model for complex tasks',
 '[{"name": "text_generation", "supported": true, "quality": "excellent"}, {"name": "analysis", "supported": true, "quality": "excellent"}]',
 '{"input_cost": 0.015, "output_cost": 0.075, "currency": "USD", "unit": "1K tokens"}',
 '{"max_tokens": 4096, "max_requests_per_minute": 400, "max_requests_per_day": 8000, "context_window": 200000}')

ON CONFLICT (name, provider) DO NOTHING;
