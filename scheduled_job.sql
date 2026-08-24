-- SCRIPT PARA AGENDAMENTO DE LIMPEZA DE POST EXPIRED (FIFO 90 DIAS)
-- Este script cria funções para:
-- 1. Excluir posts com mais de 90 dias.
-- 2. Notificar usuários sobre posts que expiram em 48 horas (88 dias de criação).

BEGIN;

-- 1. Função para Excluir Posts Antigos
CREATE OR REPLACE FUNCTION delete_expired_posts()
RETURNS void AS $$
BEGIN
    DELETE FROM public.posts
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- 2. Tabela de controle para notificações (evitar spam)
CREATE TABLE IF NOT EXISTS public.post_expiration_notifications (
    post_id BIGINT PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
    notified_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Função para Notificar (Chamar via Cron ou Edge Function)
CREATE OR REPLACE FUNCTION notify_expiring_posts()
RETURNS void AS $$
DECLARE
    post_record RECORD;
BEGIN
    FOR post_record IN 
        SELECT p.id, p.author_id, p.content, p.created_at 
        FROM public.posts p
        LEFT JOIN public.post_expiration_notifications n ON p.id = n.post_id
        WHERE p.created_at < NOW() - INTERVAL '88 days' -- 90 - 2 dias
          AND p.created_at > NOW() - INTERVAL '90 days'
          AND n.post_id IS NULL
    LOOP
        -- Inserir notificação no sistema (tabela notifications)
        INSERT INTO public.notifications (
            user_id, 
            company_id, 
            type, 
            title, 
            description, 
            link, 
            read
        ) VALUES (
            post_record.author_id,
            (SELECT company_id FROM public.posts WHERE id = post_record.id),
            'alert',
            'Sua postagem vai expirar!',
            'Uma postagem sua será excluída em 48h devido à política de 90 dias.',
            '/feed',
            false
        );

        -- Marcar como notificado
        INSERT INTO public.post_expiration_notifications (post_id) VALUES (post_record.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Tentar agendar com pg_cron (se disponível)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Agendar limpeza diária às 03:00 AM
        PERFORM cron.schedule('delete-expired-posts', '0 3 * * *', 'SELECT delete_expired_posts()');
        
        -- Agendar notificação diária às 08:00 AM
        PERFORM cron.schedule('notify-expiring-posts', '0 8 * * *', 'SELECT notify_expiring_posts()');
        
        RAISE NOTICE 'Jobs agendados com sucesso via pg_cron.';
    ELSE
        RAISE NOTICE 'Extensão pg_cron não detectada. configure um cron job externo ou Edge Function para chamar "SELECT delete_expired_posts();" e "SELECT notify_expiring_posts();" diariamente.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao tentar agendar cron: %. Execute as funções manualmente ou via Edge Functions.', SQLERRM;
END $$;

COMMIT;
