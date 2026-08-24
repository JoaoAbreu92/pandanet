-- SCRIPT DE CORREÇÃO GERAL PARA VPS (CORRIGIDO v4)
-- Objetivo: Garantir que o usuário ti@grupopixel.com.br tenha um perfil válido vinculado a uma empresa
-- e que as permissões de Storage e RLS estejam corretas.
-- v4: Tenta definir status='active' para evitar tela "Aguardando Aprovação".

BEGIN;

-- 1. Garantir que a empresa "Grupo Pixel" exista
-- A tabela companies usa 'domain' para identificação única
INSERT INTO public.companies (name, domain, status)
VALUES ('Grupo Pixel', 'grupopixel.com.br', 'active')
ON CONFLICT (domain) DO UPDATE SET status = 'active';

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
        RAISE NOTICE 'Usuário ti@grupopixel.com.br não encontrado no Auth. Verifique se o login foi feito.';
    END IF;

    -- Buscar ID da empresa usando DOMAIN
    SELECT id INTO target_company_id FROM public.companies WHERE domain = 'grupopixel.com.br';

    IF target_user_id IS NOT NULL THEN
        -- Inserir ou Atualizar o Perfil
        -- Use full_name em vez de name
        -- Use team em vez de department
        INSERT INTO public.profiles (id, email, full_name, role, company_id, team)
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
            role = EXCLUDED.role,
            team = EXCLUDED.team,
            full_name = EXCLUDED.full_name;
            
        RAISE NOTICE 'Perfil do usuário % atualizado/criado com sucesso.', target_user_id;

        -- TENTATIVA DE ATUALIZAR STATUS (Para evitar tela de "Aguardando Aprovação")
        -- Verifica se a coluna exists antes de tentar, para não quebrar o script
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='status') THEN
            EXECUTE 'UPDATE public.profiles SET status = ''active'' WHERE id = $1' USING target_user_id;
            RAISE NOTICE 'Status do perfil forçado para active.';
        END IF;

        -- TENTATIVA DE ATUALIZAR is_admin / is_company_admin se existirem
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_admin') THEN
            EXECUTE 'UPDATE public.profiles SET is_admin = true WHERE id = $1' USING target_user_id;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_company_admin') THEN
            EXECUTE 'UPDATE public.profiles SET is_company_admin = true WHERE id = $1' USING target_user_id;
        END IF;

    ELSE
        RAISE WARNING 'Nenhum usuário encontrado para vincular o perfil!';
    END IF;
END $$;

-- 3. Garantir Buckets de Storage (Avatars e Covers)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('feed-media', 'feed-media', true) ON CONFLICT (id) DO UPDATE SET public = true;

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
