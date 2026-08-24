-- 1. Function to delete old posts (FIFO / Time-based)
CREATE OR REPLACE FUNCTION public.delete_old_posts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete posts older than 90 days
  DELETE FROM public.posts
  WHERE created_at < NOW() - INTERVAL '90 days';
  RETURN NEW;
END;
$$;

-- 2. Trigger that runs after every insert to clean up old data
DROP TRIGGER IF EXISTS trigger_delete_old_posts ON public.posts;
CREATE TRIGGER trigger_delete_old_posts
AFTER INSERT ON public.posts
FOR EACH STATEMENT
EXECUTE FUNCTION public.delete_old_posts();

-- 3. Ensure RLS Policy for Deletion (Author only)
-- Drop existing policy if it conflicts or is too broad/restrictive, or just add a specific one.
-- We'll try to be safe and use a unique name.
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

CREATE POLICY "Users can delete their own posts"
ON public.posts
FOR DELETE
USING (
  auth.uid() = author_id
);
