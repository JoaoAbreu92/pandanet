-- SCRIPT DE CORREÇÃO GERAL PARA VPS
-- Objetivo: Garantir que o usuário ti@grupopixel.com.br tenha um perfil válido vinculado a uma empresa
-- e que as permissões de Storage e RLS estejam corretas.

BEGIN;

-- 1. Garantir que a empresa "Grupo Pixel" exista
INSERT INTO public.companies (name, slug, plan, status)
VALUES ('Grupo Pixel', 'grupo-pixel', 'enterprise', 'active')
ON CONFLICT (slug) DO NOTHING;

-- 2. Garantir que o usuário tenha um Perfil (Profile)
DO $$
DECLARE
    target_user_id UUID;
    target_company_id UUID;
    target_role TEXT := 'super_admin';
BEGIN
    -- Buscar ID do usuário Auth (tente pelo email)
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'ti@grupopixel.com.br';
    
    -- Se não achar pelo email, tente achar qualquer usuário admin (fallback seguro para não quebrar)
    IF target_user_id IS NULL THEN
        RAISE NOTICE 'Usuário ti@grupopixel.com.br não encontrado. Tentando verificar se há algum usuário...';
    END IF;

    -- Buscar ID da empresa
    SELECT id INTO target_company_id FROM public.companies WHERE slug = 'grupo-pixel';

    IF target_user_id IS NOT NULL THEN
        -- Inserir ou Atualizar o Perfil
        INSERT INTO public.profiles (id, email, name, role, company_id, department)
        VALUES (
            target_user_id, 
            'ti@grupopixel.com.br', 
            'Master Admin', 
            target_role, 
            target_company_id, 
            'TI'
        )
        ON CONFLICT (id) DO UPDATE SET
            company_id = EXCLUDED.company_id,
            role = EXCLUDED.role;
            
        RAISE NOTICE 'Perfil do usuário % atualizado com sucesso.', target_user_id;
    ELSE
        RAISE WARNING 'Nenhum usuário encontrado para vincular o perfil!';
    END IF;
END $$;

-- 3. Garantir Buckets de Storage (Avatars e Covers)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (name) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT (name) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('feed-media', 'feed-media', true) ON CONFLICT (name) DO UPDATE SET public = true;

-- 4. Resetar Políticas de Storage (Para garantir que funcionem)
-- Avatars
DROP POLICY IF EXISTS "Avatar Upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Select" ON storage.objects;
CREATE POLICY "Avatar Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Avatar Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Avatar Select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

-- Covers
DROP POLICY IF EXISTS "Cover Upload" ON storage.objects;
DROP POLICY IF EXISTS "Cover Update" ON storage.objects;
DROP POLICY IF EXISTS "Cover Select" ON storage.objects;
CREATE POLICY "Cover Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'covers');
CREATE POLICY "Cover Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'covers');
CREATE POLICY "Cover Select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'covers');

COMMIT;
