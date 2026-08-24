-- Create RPC to increment poll option votes atomicity
create or replace function increment_poll_option_votes(option_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.poll_options
  set votes = votes + 1
  where id = option_id;
end;
$$;
