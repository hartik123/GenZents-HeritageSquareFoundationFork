-- Migration to add metadata columns to chats and messages tables
-- Run this in your Supabase SQL editor to add the missing columns

-- Add metadata column to chats table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chats' AND column_name = 'metadata') THEN
        ALTER TABLE chats ADD COLUMN metadata JSONB DEFAULT '{"totalMessages": 0, "totalTokens": 0, "averageResponseTime": 0, "lastActivity": ""}';
    END IF;
END $$;

-- Add shared_users column to chats table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chats' AND column_name = 'shared_users') THEN
        ALTER TABLE chats ADD COLUMN shared_users TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Add updated_at column to chats table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chats' AND column_name = 'updated_at') THEN
        ALTER TABLE chats ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Add metadata column to messages table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'metadata') THEN
        ALTER TABLE messages ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Update existing chats to have proper metadata structure
UPDATE chats 
SET metadata = jsonb_build_object(
    'totalMessages', 0,
    'totalTokens', 0,
    'averageResponseTime', 0,
    'lastActivity', created_at::text
)
WHERE metadata IS NULL OR metadata = '{}';

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_chats_metadata ON chats USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING GIN (metadata);

-- Add a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;

-- Create triggers
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
