create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) not null,
  title text not null,
  description text,
  status text not null check (status in ('pending', 'in_progress', 'completed')),
  priority text check (priority in ('low', 'medium', 'high')),
  due_date timestamp with time zone,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id)
);

alter table public.tasks enable row level security;

create policy "Users can view tasks of their company"
on public.tasks for select
using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can insert tasks for their company"
on public.tasks for insert
with check (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can update tasks of their company"
on public.tasks for update
using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can delete tasks of their company"
on public.tasks for delete
using (company_id = (select company_id from public.profiles where id = auth.uid()));
