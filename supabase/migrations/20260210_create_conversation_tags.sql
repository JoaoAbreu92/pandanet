-- Create table for conversation tags with user/department scope
CREATE TABLE IF NOT EXISTS whatsapp_conversation_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES whatsapp_tags(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Ensure unique combination
  UNIQUE(conversation_id, tag_id, COALESCE(user_id::text, ''), COALESCE(department_id::text, ''))
);

-- Create indexes
CREATE INDEX idx_conversation_tags_conversation ON whatsapp_conversation_tags(conversation_id);
CREATE INDEX idx_conversation_tags_tag ON whatsapp_conversation_tags(tag_id);
CREATE INDEX idx_conversation_tags_user ON whatsapp_conversation_tags(user_id);
CREATE INDEX idx_conversation_tags_department ON whatsapp_conversation_tags(department_id);

-- Enable RLS
ALTER TABLE whatsapp_conversation_tags ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see tags based on scope
CREATE POLICY "Users can see tags based on scope"
  ON whatsapp_conversation_tags
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      -- Admin sees all
      (SELECT is_admin OR is_company_admin FROM profiles WHERE id = auth.uid())
      OR
      -- Personal tags (user_id set, department_id null)
      (user_id = auth.uid() AND department_id IS NULL)
      OR
      -- Department tags (department_id set, matches user's department)
      (department_id = (SELECT department_id FROM profiles WHERE id = auth.uid()) AND user_id IS NULL)
      OR
      -- Global tags (both user_id and department_id are null)
      (user_id IS NULL AND department_id IS NULL)
    )
  );

-- Policy: Users can insert tags
CREATE POLICY "Users can insert tags"
  ON whatsapp_conversation_tags
  FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND created_by = auth.uid()
    AND (
      -- Can create personal tags
      (user_id = auth.uid() AND department_id IS NULL)
      OR
      -- Can create department tags if in that department
      (department_id = (SELECT department_id FROM profiles WHERE id = auth.uid()) AND user_id IS NULL)
      OR
      -- Admins can create global tags
      ((SELECT is_admin OR is_company_admin FROM profiles WHERE id = auth.uid()) AND user_id IS NULL AND department_id IS NULL)
    )
  );

-- Policy: Users can delete their own tags
CREATE POLICY "Users can delete their own tags"
  ON whatsapp_conversation_tags
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR
    (SELECT is_admin OR is_company_admin FROM profiles WHERE id = auth.uid())
  );
