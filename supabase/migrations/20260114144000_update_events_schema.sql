-- Add missing columns to events table
alter table public.events 
add column if not exists company_id uuid references public.companies(id),
add column if not exists category text,
add column if not exists start_time text,
add column if not exists end_time text;

-- Update RLS policies for events if they don't exist or need update
-- First drop existing to avoid conflicts if they were set on creator_id only
drop policy if exists "Users can view events" on public.events;
drop policy if exists "Users can create events" on public.events;

create policy "Users can view events of their company"
on public.events for select
using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can insert events for their company"
on public.events for insert
with check (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can update events of their company"
on public.events for update
using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can delete events of their company"
on public.events for delete
using (company_id = (select company_id from public.profiles where id = auth.uid()));
