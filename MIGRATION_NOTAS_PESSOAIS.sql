-- =========================================================================
-- SCRIPT DE BANCO DE DADOS: CRIAÇÃO DA TABELA DE NOTAS PESSOAIS
-- EXECUTE ESTE SCRIPT NO EDITOR SQL DO SEU SUPABASE (BANCO SELF-HOSTED)
-- =========================================================================

-- 1. Criação da tabela personal_notes
CREATE TABLE IF NOT EXISTS public.personal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Nova Nota',
    content TEXT NOT NULL DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT 'Geral',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Adicionar comentários para documentação do banco
COMMENT ON TABLE public.personal_notes IS 'Tabela que armazena notas pessoais, senhas e anotações dos colaboradores do PandaNet.';

-- 3. Habilitar o Row Level Security (RLS) na tabela
ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;

-- 4. Criar as políticas de segurança (RLS)
-- Permite que o usuário comum acesse e modifique suas próprias notas
-- E permite que o Master Admin ou Super Admins auditem as notas (utilizado no Ghost Mode)
DROP POLICY IF EXISTS "Users can manage their own personal notes" ON public.personal_notes;

CREATE POLICY "Users can manage their own personal notes" 
ON public.personal_notes 
FOR ALL 
USING (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE public.profiles.id = auth.uid() 
        AND (public.profiles.role = 'Super Admin' OR public.profiles.email = 'ti@grupopixel.com.br')
    )
)
WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE public.profiles.id = auth.uid() 
        AND (public.profiles.role = 'Super Admin' OR public.profiles.email = 'ti@grupopixel.com.br')
    )
);

-- 5. Criar um índice para otimização de consultas por ID do usuário
CREATE INDEX IF NOT EXISTS personal_notes_user_id_idx ON public.personal_notes(user_id);
