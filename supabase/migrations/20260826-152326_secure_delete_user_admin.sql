CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    caller_id uuid;
    caller_company_id uuid;
    target_company_id uuid;
    caller_is_platform_admin boolean;
    caller_is_company_admin boolean;
BEGIN
    caller_id := auth.uid();

    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Nao autenticado';
    END IF;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario invalido';
    END IF;

    IF target_user_id = caller_id THEN
        RAISE EXCEPTION 'Nao e permitido excluir o proprio usuario';
    END IF;

    SELECT
        p.company_id,
        public.is_platform_admin()
    INTO
        caller_company_id,
        caller_is_platform_admin
    FROM public.profiles p
    WHERE p.id = caller_id;

    IF caller_company_id IS NULL AND NOT COALESCE(caller_is_platform_admin, false) THEN
        RAISE EXCEPTION 'Perfil do solicitante nao encontrado';
    END IF;

    SELECT company_id
    INTO target_company_id
    FROM public.profiles
    WHERE id = target_user_id;

    IF target_company_id IS NULL THEN
        RAISE EXCEPTION 'Usuario alvo nao encontrado';
    END IF;

    caller_is_company_admin :=
        public.is_company_admin_v2(target_company_id);

    IF NOT COALESCE(caller_is_platform_admin, false)
       AND NOT COALESCE(caller_is_company_admin, false) THEN
        RAISE EXCEPTION 'Sem permissao para excluir este usuario';
    END IF;

    IF NOT COALESCE(caller_is_platform_admin, false)
       AND caller_company_id IS DISTINCT FROM target_company_id THEN
        RAISE EXCEPTION 'Operacao entre empresas nao permitida';
    END IF;

    DELETE FROM public.messages
    WHERE sender_id = target_user_id
       OR receiver_id = target_user_id;

    DELETE FROM public.nudges
    WHERE sender_id = target_user_id
       OR receiver_id = target_user_id;

    DELETE FROM public.conversation_participants
    WHERE user_id = target_user_id;

    DELETE FROM public.conversations c
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.conversation_participants cp
        WHERE cp.conversation_id = c.id
    );

    DELETE FROM public.post_reactions
    WHERE user_id = target_user_id;

    DELETE FROM public.comments
    WHERE author_id = target_user_id;

    DELETE FROM public.posts
    WHERE author_id = target_user_id;

    DELETE FROM public.user_badges
    WHERE user_id = target_user_id
       OR awarded_by = target_user_id;

    DELETE FROM public.department_users
    WHERE user_id = target_user_id;

    UPDATE public.tickets
    SET requester_id = NULL
    WHERE requester_id = target_user_id;

    UPDATE public.tickets
    SET assigned_user_id = NULL
    WHERE assigned_user_id = target_user_id;

    DELETE FROM public.whatsapp_channel_users
    WHERE user_id = target_user_id
       OR created_by = target_user_id;

    UPDATE public.whatsapp_conversations
    SET assigned_to = NULL
    WHERE assigned_to = target_user_id;

    UPDATE public.whatsapp_messages
    SET sent_by = NULL
    WHERE sent_by = target_user_id;

    UPDATE public.tasks
    SET assigned_to = NULL
    WHERE assigned_to = target_user_id;

    UPDATE public.tasks
    SET created_by = NULL
    WHERE created_by = target_user_id;

    DELETE FROM public.email_settings
    WHERE user_id = target_user_id;

    DELETE FROM public.emails
    WHERE user_id = target_user_id;

    DELETE FROM auth.identities
    WHERE user_id = target_user_id;

    DELETE FROM auth.users
    WHERE id = target_user_id;

    DELETE FROM public.profiles
    WHERE id = target_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_user_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_user_admin(uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.delete_user_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_admin(uuid) TO service_role;
