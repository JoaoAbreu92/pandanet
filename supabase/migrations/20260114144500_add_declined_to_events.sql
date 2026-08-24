alter table public.events
add column if not exists declined jsonb default '[]'::jsonb;
