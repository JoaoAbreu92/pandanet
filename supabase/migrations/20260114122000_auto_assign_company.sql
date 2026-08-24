CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_company_id uuid;
  v_domain text;
BEGIN
  -- Extract domain from email (everything after @)
  v_domain := substring(new.email from '@(.*)$');

  -- Find company by domain (assuming domain is unique in companies table)
  SELECT id INTO v_company_id FROM public.companies WHERE domain = v_domain LIMIT 1;

  -- Insert profile with company_id and full_name
  INSERT INTO public.profiles (id, full_name, company_id)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    v_company_id
  );

  RETURN new;
END;
$function$;
