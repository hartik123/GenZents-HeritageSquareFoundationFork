-- Fix RLS Policies for Chat Creation
-- This script fixes the Row Level Security policies that are preventing chat creation

-- Drop existing chat policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own chats" ON chats;
DROP POLICY IF EXISTS "Users can create own chats" ON chats;
DROP POLICY IF EXISTS "Users can update own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete own chats" ON chats;

-- Create new chat policies with proper permissions
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

-- Ensure the table has RLS enabled
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Add admin policies for chats (if not exists)
CREATE POLICY "Admins can manage all chats" ON chats
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );
