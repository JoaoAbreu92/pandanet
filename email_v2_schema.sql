-- Add signature column to email_settings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_settings' AND column_name = 'signature') THEN
        ALTER TABLE email_settings ADD COLUMN signature TEXT;
    END IF;
END $$;

-- Create email_metadata table for local tags/notes on IMAP messages
CREATE TABLE IF NOT EXISTS email_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL, -- The Message-ID header from the email
    tags JSONB DEFAULT '[]'::jsonb, -- Array of objects: { label: string, color: string }
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, message_id)
);

-- RLS Policies for email_metadata
ALTER TABLE email_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email metadata"
    ON email_metadata FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email metadata"
    ON email_metadata FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email metadata"
    ON email_metadata FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email metadata"
    ON email_metadata FOR DELETE
    USING (auth.uid() = user_id);
