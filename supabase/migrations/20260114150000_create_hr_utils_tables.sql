-- Create training_modules table
create table public.training_modules (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) not null,
  title text not null,
  description text,
  duration text,
  thumbnail text,
  video_url text,
  category text
);

-- RLS for training_modules
alter table public.training_modules enable row level security;

create policy "Users can view training modules of their company"
on public.training_modules for select
using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can insert training modules for their company"
on public.training_modules for insert
with check (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can update training modules of their company"
on public.training_modules for update
using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can delete training modules of their company"
on public.training_modules for delete
using (company_id = (select company_id from public.profiles where id = auth.uid()));


-- Create services table
create table public.services (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) not null,
  name text not null,
  status text not null, -- 'operational', 'maintenance', 'outage'
  uptime text,
  image_url text
);

-- RLS for services
alter table public.services enable row level security;

create policy "Users can view services of their company"
on public.services for select
using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can insert services for their company"
on public.services for insert
with check (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can update services of their company"
on public.services for update
using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "Users can delete services of their company"
on public.services for delete
using (company_id = (select company_id from public.profiles where id = auth.uid()));
