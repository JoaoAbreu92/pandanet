-- Create table for private contact notes
CREATE TABLE IF NOT EXISTS whatsapp_contact_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_contact_notes_conversation ON whatsapp_contact_notes(conversation_id);
CREATE INDEX idx_contact_notes_user ON whatsapp_contact_notes(user_id);

-- Enable RLS
ALTER TABLE whatsapp_contact_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notes
CREATE POLICY "Users can only see their own notes"
  ON whatsapp_contact_notes
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can only insert their own notes
CREATE POLICY "Users can only insert their own notes"
  ON whatsapp_contact_notes
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Policy: Users can only update their own notes
CREATE POLICY "Users can only update their own notes"
  ON whatsapp_contact_notes
  FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: Users can only delete their own notes
CREATE POLICY "Users can only delete their own notes"
  ON whatsapp_contact_notes
  FOR DELETE
  USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_contact_notes_timestamp
  BEFORE UPDATE ON whatsapp_contact_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_notes_updated_at();
