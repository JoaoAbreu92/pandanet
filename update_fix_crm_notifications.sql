-- PandaNet - Correções CRM e Notificações SaaS
-- Execute este script no Console SQL do seu Supabase para aplicar as correções.

-- 1. SISTEMA DE NOTIFICAÇÃO PARA O SUPERADMIN (Validação de Usuários)
-- Função para notificar o superadmin quando um novo usuário com status 'pending' é criado
CREATE OR REPLACE FUNCTION notify_superadmin_new_user()
RETURNS TRIGGER AS $$
DECLARE
    superadmin_id UUID;
BEGIN
    -- Busca o ID do SuperAdmin (ti@grupopixel.com.br)
    SELECT id INTO superadmin_id FROM public.profiles WHERE email = 'ti@grupopixel.com.br' LIMIT 1;
    
    IF superadmin_id IS NOT NULL AND NEW.status = 'pending' THEN
        INSERT INTO public.notifications (
            user_id,
            company_id,
            type,
            title,
            description,
            link,
            is_read,
            created_at
        ) VALUES (
            superadmin_id,
            'root', -- Identificador de sistema/admin
            'system',
            'Nova Solicitação de Acesso',
            'O usuário ' || COALESCE(NEW.full_name, 'S/ Nome') || ' (' || NEW.email || ') solicitou acesso.',
            'saas-dashboard',
            false,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger na tabela profiles
DROP TRIGGER IF EXISTS tr_notify_superadmin_new_user ON public.profiles;
CREATE TRIGGER tr_notify_superadmin_new_user
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION notify_superadmin_new_user();


-- 2. CORREÇÕES NO MÓDULO CRM (Itens e Contratos)

-- Criar tabela de Itens do CRM (se não existir)
CREATE TABLE IF NOT EXISTS public.crm_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    rate DECIMAL(12,2) DEFAULT 0,
    tax_1 DECIMAL(12,2) DEFAULT 0,
    tax_2 DECIMAL(12,2) DEFAULT 0,
    unit TEXT DEFAULT 'unidade',
    item_group TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS para crm_items
ALTER TABLE public.crm_items ENABLE ROW LEVEL SECURITY;

-- Política de Acesso para crm_items (Isolamento por empresa)
DROP POLICY IF EXISTS "CRM_Access_Items" ON public.crm_items;
CREATE POLICY "CRM_Access_Items" ON public.crm_items 
FOR ALL TO authenticated 
USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Adicionar colunas faltantes na tabela de Contratos
ALTER TABLE public.crm_contracts ADD COLUMN IF NOT EXISTS contract_type TEXT;
ALTER TABLE public.crm_contracts ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. REMOÇÃO DE REGISTROS DE DEMONSTRAÇÃO (Opcional, se desejar limpar)
-- DELETE FROM public.notifications WHERE description LIKE '%demonstração%';
