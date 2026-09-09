BEGIN;

-- Preserve the effective behavior of existing users before changing the
-- frontend fallback. Explicit values already stored always win.
UPDATE public.profiles
SET permissions = jsonb_build_object(
    'viewMessages', true,
    'viewCalendar', true,
    'useMarketplace', true,
    'viewEmail', true,
    'viewWhatsPanda', false,
    'viewScheduling', true,
    'viewAgenda', true,
    'viewReservations', true,
    'viewDirectory', true,
    'viewForms', true,
    'viewBenefits', true,
    'viewOnboarding', true,
    'viewRecognition', true,
    'viewDocuments', true,
    'viewTraining', true,
    'viewSurveys', true,
    'viewPolicies', true,
    'viewWellbeing', true,
    'viewMeuRH', true,
    'viewJobs', true,
    'viewOrgChart', true,
    'viewKPIDashboard', true,
    'viewProjects', true,
    'viewTiDashboard', false,
    'openTickets', true,
    'openTiRequests', true,
    'viewKnowledgeBase', true,
    'viewServiceStatus', true,
    'viewInfoSec', true,
    'viewTimeBank', true,
    'viewPerformance', true,
    'action_view_holerite', true,
    'action_register_hours', true
) || COALESCE(permissions, '{}'::jsonb);

CREATE OR REPLACE FUNCTION public.get_or_create_internal_conversation(
    p_contact_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_caller_id uuid := auth.uid();
    v_company_id uuid;
    v_conversation_id uuid;
    v_allowed boolean;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Nao autenticado';
    END IF;

    SELECT
        p.company_id,
        (
            COALESCE(p.is_admin, false)
            OR COALESCE(p.is_company_admin, false)
            OR p.role = 'Super Admin'
            OR COALESCE((p.permissions ->> 'viewMessages')::boolean, false)
        )
    INTO v_company_id, v_allowed
    FROM public.profiles p
    WHERE p.id = v_caller_id
      AND p.status = 'active';

    IF v_company_id IS NULL OR NOT COALESCE(v_allowed, false) THEN
        RAISE EXCEPTION 'Sem permissao para usar o chat interno';
    END IF;

    IF p_contact_id = v_caller_id THEN
        RAISE EXCEPTION 'Nao e possivel iniciar conversa consigo mesmo';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles target
        WHERE target.id = p_contact_id
          AND target.company_id = v_company_id
          AND target.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Contato invalido ou de outra empresa';
    END IF;

    SELECT c.id
    INTO v_conversation_id
    FROM public.conversations c
    JOIN public.conversation_participants caller_participant
      ON caller_participant.conversation_id = c.id
     AND caller_participant.user_id = v_caller_id
    JOIN public.conversation_participants contact_participant
      ON contact_participant.conversation_id = c.id
     AND contact_participant.user_id = p_contact_id
    WHERE c.company_id = v_company_id
      AND COALESCE(c.is_group, false) = false
      AND (
          SELECT COUNT(*)
          FROM public.conversation_participants participant_count
          WHERE participant_count.conversation_id = c.id
      ) = 2
    ORDER BY c.created_at
    LIMIT 1;

    IF v_conversation_id IS NOT NULL THEN
        UPDATE public.conversations
        SET is_closed = false
        WHERE id = v_conversation_id
          AND COALESCE(is_closed, false) = true;

        RETURN v_conversation_id;
    END IF;

    INSERT INTO public.conversations (
        company_id,
        is_group,
        last_message,
        last_message_at,
        created_by
    )
    VALUES (
        v_company_id,
        false,
        'Conversa iniciada',
        now(),
        v_caller_id
    )
    RETURNING id INTO v_conversation_id;

    INSERT INTO public.conversation_participants (
        conversation_id,
        user_id,
        company_id
    )
    VALUES
        (v_conversation_id, v_caller_id, v_company_id),
        (v_conversation_id, p_contact_id, v_company_id);

    RETURN v_conversation_id;
END;
$function$;

REVOKE ALL
ON FUNCTION public.get_or_create_internal_conversation(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.get_or_create_internal_conversation(uuid)
TO authenticated;

COMMIT;
