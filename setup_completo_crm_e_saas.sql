-- =========================================================================
-- PARTE 1: SCRIPT SQL CORRETIVO (CRM)
-- Garante que as tabelas necessárias para salvar faturas, propostas, estimativas e itens existam.
-- =========================================================================

-- Tabela de Itens (Produtos/Serviços)
CREATE TABLE IF NOT EXISTS public.crm_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    rate DECIMAL(15,2) DEFAULT 0,
    unit TEXT DEFAULT 'unidade',
    tax_1 DECIMAL(5,2) DEFAULT 0,
    tax_2 DECIMAL(5,2) DEFAULT 0,
    item_group TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Faturas
CREATE TABLE IF NOT EXISTS public.crm_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    subject TEXT,
    date DATE NOT NULL,
    duedate DATE,
    currency TEXT DEFAULT 'BRL',
    status TEXT DEFAULT 'unpaid', -- unpaid, paid, partially_paid, overdue, draft
    assigned_to UUID REFERENCES public.profiles(id),
    subtotal DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    total_tax DECIMAL(15,2) DEFAULT 0,
    items JSONB, -- Linhas da fatura
    notes TEXT,
    terms TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Propostas
CREATE TABLE IF NOT EXISTS public.crm_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    subject TEXT,
    date DATE NOT NULL,
    open_till DATE,
    currency TEXT DEFAULT 'BRL',
    status TEXT DEFAULT 'draft', -- draft, sent, open, revised, declined, accepted
    assigned_to UUID REFERENCES public.profiles(id),
    subtotal DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    items JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Estimativas (Orçamentos)
CREATE TABLE IF NOT EXISTS public.crm_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    subject TEXT,
    date DATE NOT NULL,
    expiry_date DATE,
    currency TEXT DEFAULT 'BRL',
    status TEXT DEFAULT 'draft', -- draft, sent, expired, declined, accepted
    assigned_to UUID REFERENCES public.profiles(id),
    subtotal DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    items JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS public.crm_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.crm_invoices(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_mode TEXT,
    date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Contratos
CREATE TABLE IF NOT EXISTS public.crm_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT,
    contract_value DECIMAL(15,2) DEFAULT 0,
    contract_type TEXT DEFAULT 'Service',
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'active', -- active, expired, cancelled
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contracts ENABLE ROW LEVEL SECURITY;

-- Exemplo de política para crm_items (ajuste conforme necessário)
CREATE POLICY "Users can see only their company items" ON public.crm_items
    FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can see only their company invoices" ON public.crm_invoices
    FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can see only their company proposals" ON public.crm_proposals
    FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can see only their company estimates" ON public.crm_estimates
    FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can see only their company payments" ON public.crm_payments
    FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can see only their company contracts" ON public.crm_contracts
    FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));


-- =========================================================================
-- PARTE 2: MAPEAMENTO DE VALIDAÇÃO DE USUÁRIO (SaaS)
-- Implementa a notificação automática para o Super Admin ti@grupopixel.com.br
-- quando um novo usuário se cadastra com um domínio inexistente.
-- =========================================================================

-- Trigger para notificar Super Admin sobre registros que precisam de validação
CREATE OR REPLACE FUNCTION notify_superadmin_on_new_registration()
RETURNS TRIGGER AS $$
DECLARE
    super_admin_id UUID;
BEGIN
    -- Busca o ID do Super Admin pelo e-mail
    SELECT id INTO super_admin_id FROM profiles WHERE email = 'ti@grupopixel.com.br' LIMIT 1;

    -- Se o status for 'pending', cria uma notificação em tempo real
    IF NEW.status = 'pending' AND super_admin_id IS NOT NULL THEN
        INSERT INTO notifications (
            profile_id,
            title,
            message,
            type,
            read,
            link
        ) VALUES (
            super_admin_id,
            'Novo cadastro pendente',
            'O usuário ' || NEW.full_name || ' (' || NEW.email || ') registrou um novo domínio e aguarda validação.',
            'alert',
            false,
            '/saas-dashboard?tab=validations'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplica o trigger na tabela profiles (assumindo que novos usuários ganham status 'pending' via trigger anterior ou app)
DROP TRIGGER IF EXISTS tr_notify_superadmin_on_validation ON profiles;
CREATE TRIGGER tr_notify_superadmin_on_validation
AFTER INSERT OR UPDATE OF status ON profiles
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION notify_superadmin_on_new_registration();
