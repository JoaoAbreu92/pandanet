-- MIGRATION: Módulo de Agendamentos (Cal.com clone)

-- 1. Tabela de Tipos de Eventos (Eventos Agendáveis)
CREATE TABLE IF NOT EXISTS public.scheduling_event_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL, -- em minutos (ex: 15, 30, 60, 90)
    is_paid BOOLEAN DEFAULT FALSE,
    price NUMERIC(10, 2) DEFAULT 0.00,
    requirements JSONB DEFAULT '{"phone": true, "cnpj": false, "company_name": false}'::jsonb,
    availability JSONB DEFAULT '{"days": [1, 2, 3, 4, 5], "startTime": "09:00", "endTime": "18:00"}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    has_capacity_limit BOOLEAN DEFAULT FALSE,
    capacity_limit INTEGER DEFAULT 0,
    show_capacity_to_guest BOOLEAN DEFAULT TRUE,
    has_lunch_break BOOLEAN DEFAULT FALSE,
    lunch_start_time TEXT DEFAULT '12:00',
    lunch_end_time TEXT DEFAULT '13:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_owner_slug UNIQUE (owner_id, slug)
);

-- 2. Tabela de Reservas (Agendamentos efetuados)
CREATE TABLE IF NOT EXISTS public.scheduling_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    event_type_id UUID NOT NULL REFERENCES public.scheduling_event_types(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_phone TEXT NOT NULL,
    guest_company_name TEXT,
    guest_cnpj TEXT,
    booking_date DATE NOT NULL,
    booking_time TEXT NOT NULL, -- ex: "14:30"
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'free' CHECK (payment_status IN ('pending', 'paid', 'free')),
    price NUMERIC(10, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Modelos de Mensagem (Confirmação/Sucesso)
CREATE TABLE IF NOT EXISTS public.scheduling_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.scheduling_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_templates ENABLE ROW LEVEL SECURITY;

-- Políticas para scheduling_event_types
DROP POLICY IF EXISTS "Leitura pública de tipos de evento" ON public.scheduling_event_types;
CREATE POLICY "Leitura pública de tipos de evento" ON public.scheduling_event_types
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Gerenciamento completo pelo dono" ON public.scheduling_event_types;
CREATE POLICY "Gerenciamento completo pelo dono" ON public.scheduling_event_types
    FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Admin vê todos os tipos de evento" ON public.scheduling_event_types;
CREATE POLICY "Admin vê todos os tipos de evento" ON public.scheduling_event_types
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.is_admin = true OR profiles.is_company_admin = true)
        )
    );

-- Políticas para scheduling_bookings
DROP POLICY IF EXISTS "Criar reservas públicas" ON public.scheduling_bookings;
CREATE POLICY "Criar reservas públicas" ON public.scheduling_bookings
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anfitrião vê suas reservas" ON public.scheduling_bookings;
CREATE POLICY "Anfitrião vê suas reservas" ON public.scheduling_bookings
    FOR SELECT USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Admin vê todas as reservas" ON public.scheduling_bookings;
CREATE POLICY "Admin vê todas as reservas" ON public.scheduling_bookings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.is_admin = true OR profiles.is_company_admin = true)
        )
    );

DROP POLICY IF EXISTS "Anfitrião gerencia suas reservas" ON public.scheduling_bookings;
CREATE POLICY "Anfitrião gerencia suas reservas" ON public.scheduling_bookings
    FOR ALL USING (auth.uid() = host_id);

-- Políticas para scheduling_templates
DROP POLICY IF EXISTS "Gerenciamento completo de templates pelo dono" ON public.scheduling_templates;
CREATE POLICY "Gerenciamento completo de templates pelo dono" ON public.scheduling_templates
    FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Admins e anfitriões leem templates" ON public.scheduling_templates;
CREATE POLICY "Admins e anfitriões leem templates" ON public.scheduling_templates
    FOR SELECT USING (
        auth.uid() = owner_id OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.is_admin = true OR profiles.is_company_admin = true)
        )
    );
