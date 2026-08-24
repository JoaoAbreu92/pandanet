-- PandaNet - SCRIPT CORRETIVO FINAL (Signup Fix)
-- Este script corrige o erro 500 no cadastro ao unificar os triggers e usar as colunas corretas.

-- 1. LIMPEZA DE TRIGGERS E FUNÇÕES ANTIGAS (EVITA CONFLITOS)
DROP TRIGGER IF EXISTS tr_notify_superadmin_on_validation ON public.profiles;
DROP TRIGGER IF EXISTS tr_notify_superadmin_new_user ON public.profiles;
DROP FUNCTION IF EXISTS notify_superadmin_on_new_registration();
DROP FUNCTION IF EXISTS notify_superadmin_new_user();

-- 2. NOVA FUNÇÃO DE NOTIFICAÇÃO (COLUNAS CORRIGIDAS)
CREATE OR REPLACE FUNCTION fn_notify_superadmin_registration_v2()
RETURNS TRIGGER AS $$
DECLARE
    superadmin_id UUID;
BEGIN
    -- Busca o ID do SuperAdmin (ti@grupopixel.com.br)
    SELECT id INTO superadmin_id FROM public.profiles WHERE email = 'ti@grupopixel.com.br' LIMIT 1;
    
    -- Só notifica se for um novo registro ou se o status mudou para 'pending'
    -- E se o superadmin existir no banco
    IF NEW.status = 'pending' AND superadmin_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id,        -- Destinatário (Super Admin)
            title,
            description,    -- Nome correto da coluna
            type,
            is_read,        -- Nome correto da coluna
            link,
            company_id      -- Necessário para o isolamento
        ) VALUES (
            superadmin_id,
            'Novo Cadastro Pendente',
            'O usuário ' || COALESCE(NEW.full_name, 'Novo Usuário') || ' (' || NEW.email || ') aguarda validação de domínio.',
            'alert',
            false,
            '/saas-dashboard?tab=validations',
            'root' -- Identificador especial para notificações de sistema
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RE-APLICAR O TRIGGER NA TABELA PROFILES
CREATE TRIGGER tr_notify_superadmin_registration_v2
AFTER INSERT OR UPDATE OF status ON public.profiles
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION fn_notify_superadmin_registration_v2();

-- 4. VERIFICAÇÃO DE ESTRUTURA (OPCIONAL - CASO AS COLUNAS NÃO EXISTAM)
-- Se o banco for muito antigo, pode precisar dessas colunas:
-- ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
-- ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS description TEXT;
-- ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id);
