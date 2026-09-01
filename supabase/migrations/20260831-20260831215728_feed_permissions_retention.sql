
BEGIN;

UPDATE public.profiles
SET permissions =
    COALESCE(permissions, '{}'::jsonb)
    || jsonb_build_object(
        'retainFeedPosts',
        COALESCE((permissions ->> 'retainFeedPosts')::boolean, false)
    )
WHERE NOT COALESCE(permissions, '{}'::jsonb) ? 'retainFeedPosts';

DROP TRIGGER IF EXISTS trigger_delete_old_posts ON public.posts;

CREATE OR REPLACE FUNCTION public.delete_old_posts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    DELETE FROM public.posts p
    USING public.profiles author_profile
    WHERE author_profile.id = p.author_id
      AND p.created_at < NOW() - INTERVAL '90 days'
      AND COALESCE(
          (author_profile.permissions ->> 'retainFeedPosts')::boolean,
          false
      ) = false;

    RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_delete_old_posts
AFTER INSERT ON public.posts
FOR EACH STATEMENT
EXECUTE FUNCTION public.delete_old_posts();

CREATE OR REPLACE FUNCTION public.protect_own_privileged_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() = OLD.id
       AND NOT public.is_platform_admin()
       AND NOT public.is_company_admin_v2(OLD.company_id)
    THEN
        NEW.permissions := OLD.permissions;
        NEW.is_admin := OLD.is_admin;
        NEW.is_company_admin := OLD.is_company_admin;
        NEW.role := OLD.role;
        NEW.company_id := OLD.company_id;
        NEW.status := OLD.status;
        NEW.department_id := OLD.department_id;
        NEW.is_manager := OLD.is_manager;
        NEW.reports_to := OLD.reports_to;
        NEW.sector_manager_id := OLD.sector_manager_id;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_own_privileged_profile_fields
ON public.profiles;

CREATE TRIGGER protect_own_privileged_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_own_privileged_profile_fields();

DO $policies$
DECLARE
    item record;
BEGIN
    FOR item IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('posts', 'comments', 'post_reactions')
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.%I',
            item.policyname,
            item.tablename
        );
    END LOOP;
END;
$policies$;

/* Publicações */
CREATE POLICY posts_select_company
ON public.posts
FOR SELECT
TO authenticated
USING (
    company_id = public.get_user_company_id()
    OR public.is_platform_admin()
);

CREATE POLICY posts_insert_authorized
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (
    (
        author_id = auth.uid()
        AND company_id = public.get_user_company_id()
        AND (
            NULLIF(BTRIM(COALESCE(content, '')), '') IS NULL
            OR public.has_permission('canPostText')
        )
        AND (
            media_url IS NULL
            OR (
                media_type = 'image'
                AND public.has_permission('canPostImage')
            )
            OR (
                media_type = 'video'
                AND public.has_permission('canPostVideo')
            )
        )
    )
    OR public.is_platform_admin()
);

CREATE POLICY posts_update_authorized
ON public.posts
FOR UPDATE
TO authenticated
USING (
    (
        company_id = public.get_user_company_id()
        AND (
            author_id = auth.uid()
            OR public.is_company_admin_v2(company_id)
        )
    )
    OR public.is_platform_admin()
)
WITH CHECK (
    (
        company_id = public.get_user_company_id()
        AND (
            author_id = auth.uid()
            OR public.is_company_admin_v2(company_id)
        )
    )
    OR public.is_platform_admin()
);

CREATE POLICY posts_delete_authorized
ON public.posts
FOR DELETE
TO authenticated
USING (
    (
        company_id = public.get_user_company_id()
        AND (
            author_id = auth.uid()
            OR public.is_company_admin_v2(company_id)
        )
    )
    OR public.is_platform_admin()
);

/* Comentários */
CREATE POLICY comments_select_company
ON public.comments
FOR SELECT
TO authenticated
USING (
    company_id = public.get_user_company_id()
    OR public.is_platform_admin()
);

CREATE POLICY comments_insert_authorized
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
    (
        author_id = auth.uid()
        AND company_id = public.get_user_company_id()
        AND EXISTS (
            SELECT 1
            FROM public.posts p
            WHERE p.id = post_id
              AND p.company_id = comments.company_id
        )
    )
    OR public.is_platform_admin()
);

CREATE POLICY comments_update_authorized
ON public.comments
FOR UPDATE
TO authenticated
USING (
    (
        company_id = public.get_user_company_id()
        AND author_id = auth.uid()
    )
    OR public.is_platform_admin()
)
WITH CHECK (
    (
        company_id = public.get_user_company_id()
        AND author_id = auth.uid()
    )
    OR public.is_platform_admin()
);

CREATE POLICY comments_delete_authorized
ON public.comments
FOR DELETE
TO authenticated
USING (
    (
        company_id = public.get_user_company_id()
        AND (
            author_id = auth.uid()
            OR public.is_company_admin_v2(company_id)
        )
    )
    OR public.is_platform_admin()
);

/* Reações */
CREATE POLICY reactions_select_company
ON public.post_reactions
FOR SELECT
TO authenticated
USING (
    company_id = public.get_user_company_id()
    OR public.is_platform_admin()
);

CREATE POLICY reactions_insert_authorized
ON public.post_reactions
FOR INSERT
TO authenticated
WITH CHECK (
    (
        user_id = auth.uid()
        AND company_id = public.get_user_company_id()
        AND EXISTS (
            SELECT 1
            FROM public.posts p
            WHERE p.id = post_id
              AND p.company_id = post_reactions.company_id
        )
    )
    OR public.is_platform_admin()
);

CREATE POLICY reactions_update_authorized
ON public.post_reactions
FOR UPDATE
TO authenticated
USING (
    (
        company_id = public.get_user_company_id()
        AND user_id = auth.uid()
    )
    OR public.is_platform_admin()
)
WITH CHECK (
    (
        company_id = public.get_user_company_id()
        AND user_id = auth.uid()
    )
    OR public.is_platform_admin()
);

CREATE POLICY reactions_delete_authorized
ON public.post_reactions
FOR DELETE
TO authenticated
USING (
    (
        company_id = public.get_user_company_id()
        AND user_id = auth.uid()
    )
    OR public.is_platform_admin()
);

CREATE INDEX IF NOT EXISTS idx_posts_company_created
ON public.posts (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_author_created
ON public.posts (author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_post_created
ON public.comments (post_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_company
ON public.comments (company_id);

CREATE INDEX IF NOT EXISTS idx_reactions_post
ON public.post_reactions (post_id);

CREATE INDEX IF NOT EXISTS idx_reactions_company
ON public.post_reactions (company_id);

COMMIT;
