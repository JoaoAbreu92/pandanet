-- RESTORE EMAIL SCHEMA
-- This script recreates the email_settings table and email_metadata table
-- Run with: cat restore_email_schema.sql | docker exec -i supabase-db psql -U postgres

BEGIN;

-- 1. Create email_settings table
CREATE TABLE IF NOT EXISTS public.email_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    imap_host TEXT,
    imap_port INTEGER,
    imap_user TEXT,
    imap_pass TEXT, -- Note: Encrypted in app logic? Frontend sends it raw? 
                    -- App seems to send it as 'imap_pass'
    imap_ssl BOOLEAN DEFAULT true,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_pass TEXT,
    smtp_ssl BOOLEAN DEFAULT true,
    signature TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create email_metadata table (for tags/notes)
CREATE TABLE IF NOT EXISTS public.email_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, message_id)
);

-- 3. Enable RLS
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_metadata ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies

-- Settings: Users can only see/edit their own
DROP POLICY IF EXISTS "Users can view own settings" ON public.email_settings;
CREATE POLICY "Users can view own settings" ON public.email_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.email_settings;
CREATE POLICY "Users can insert own settings" ON public.email_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.email_settings;
CREATE POLICY "Users can update own settings" ON public.email_settings FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own settings" ON public.email_settings;
CREATE POLICY "Users can delete own settings" ON public.email_settings FOR DELETE USING (auth.uid() = user_id);

-- Metadata: Users can only see/edit their own
DROP POLICY IF EXISTS "Users can view own metadata" ON public.email_metadata;
CREATE POLICY "Users can view own metadata" ON public.email_metadata FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own metadata" ON public.email_metadata;
CREATE POLICY "Users can insert own metadata" ON public.email_metadata FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own metadata" ON public.email_metadata;
CREATE POLICY "Users can update own metadata" ON public.email_metadata FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own metadata" ON public.email_metadata;
CREATE POLICY "Users can delete own metadata" ON public.email_metadata FOR DELETE USING (auth.uid() = user_id);

COMMIT;
