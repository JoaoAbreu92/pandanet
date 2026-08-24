-- Drop existing policies on whatsapp_conversations
DROP POLICY IF EXISTS "Users can view conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Users can update conversations" ON whatsapp_conversations;

-- New comprehensive SELECT policy with department isolation
CREATE POLICY "Users see conversations from their department or assigned to them"
  ON whatsapp_conversations
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      -- Admins see everything
      (SELECT is_admin OR is_company_admin FROM profiles WHERE id = auth.uid())
      OR
      -- Conversations assigned to the user
      assigned_to = auth.uid()
      OR
      -- Conversations assigned to user's department (and user is in that department)
      (
        department_id IS NOT NULL 
        AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
      )
      OR
      -- Unassigned conversations (available for anyone to pick up)
      (assigned_to IS NULL AND department_id IS NULL)
    )
  );

-- Policy: Users can insert conversations
CREATE POLICY "Users can insert conversations"
  ON whatsapp_conversations
  FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Policy: Users can update conversations they have access to
CREATE POLICY "Users can update conversations"
  ON whatsapp_conversations
  FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      -- Admins can update everything
      (SELECT is_admin OR is_company_admin FROM profiles WHERE id = auth.uid())
      OR
      -- Users can update conversations assigned to them
      assigned_to = auth.uid()
      OR
      -- Users can update conversations in their department
      (
        department_id IS NOT NULL 
        AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
      )
      OR
      -- Users can update unassigned conversations (to claim them)
      (assigned_to IS NULL AND department_id IS NULL)
    )
  );

-- Add index for better performance on department queries
CREATE INDEX IF NOT EXISTS idx_conversations_department ON whatsapp_conversations(department_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON whatsapp_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_company_status ON whatsapp_conversations(company_id, status);
