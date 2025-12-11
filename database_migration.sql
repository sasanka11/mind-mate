-- ============================================
-- MindMate Database Migration - Chat & Dashboard Enhancements
-- Run this AFTER the initial schema (supabase_schema.sql)
-- ============================================

-- 1. Create conversation_sessions table
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create mood_journal table
CREATE TABLE IF NOT EXISTS mood_journal (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    mood_emoji TEXT NOT NULL,
    mood_name TEXT,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add session_id to messages table (if column doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE messages ADD COLUMN session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_created_at ON conversation_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_mood_journal_user_id ON mood_journal(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_journal_created_at ON mood_journal(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- 5. Enable Row Level Security
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_journal ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for conversation_sessions
CREATE POLICY "Users can view own sessions"
    ON conversation_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON conversation_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON conversation_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON conversation_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- 7. RLS Policies for mood_journal
CREATE POLICY "Users can view own mood journal"
    ON mood_journal FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mood entries"
    ON mood_journal FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 8. Create trigger to update updated_at on conversation_sessions
CREATE TRIGGER update_conversation_sessions_updated_at
    BEFORE UPDATE ON conversation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Create a default session for existing messages (one-time migration)
-- This groups all existing messages into a default session per user
INSERT INTO conversation_sessions (user_id, title, created_at)
SELECT DISTINCT user_id, 'Previous Conversations', MIN(created_at)
FROM messages
WHERE session_id IS NULL
GROUP BY user_id
ON CONFLICT DO NOTHING;

-- 10. Update existing messages to link to the default session
UPDATE messages m
SET session_id = (
    SELECT id FROM conversation_sessions cs
    WHERE cs.user_id = m.user_id
    AND cs.title = 'Previous Conversations'
    LIMIT 1
)
WHERE session_id IS NULL;

-- Migration complete!
-- You can now use conversation sessions and mood journal features
