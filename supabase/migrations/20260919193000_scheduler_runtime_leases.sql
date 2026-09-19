create table if not exists public.scheduler_runtime_leases (
  job_key text primary key,
  holder text not null,
  lease_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.scheduler_runtime_leases enable row level security;

create or replace function public.acquire_scheduler_lease(
  p_job_key text,
  p_holder text,
  p_lease_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  acquired boolean := false;
begin
  if p_job_key is null or btrim(p_job_key) = '' then
    raise exception 'job key is required';
  end if;
  if p_holder is null or btrim(p_holder) = '' then
    raise exception 'holder is required';
  end if;
  if p_lease_seconds < 5 or p_lease_seconds > 900 then
    raise exception 'lease seconds must be between 5 and 900';
  end if;

  insert into public.scheduler_runtime_leases(job_key, holder, lease_until, updated_at)
  values (p_job_key, p_holder, now() + make_interval(secs => p_lease_seconds), now())
  on conflict (job_key) do update
    set holder = excluded.holder,
        lease_until = excluded.lease_until,
        updated_at = now()
    where public.scheduler_runtime_leases.lease_until <= now()
       or public.scheduler_runtime_leases.holder = excluded.holder;

  get diagnostics acquired = row_count;
  return acquired;
end;
$$;

create or replace function public.release_scheduler_lease(
  p_job_key text,
  p_holder text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  released boolean := false;
begin
  delete from public.scheduler_runtime_leases
  where job_key = p_job_key and holder = p_holder;
  get diagnostics released = row_count;
  return released;
end;
$$;

revoke all on public.scheduler_runtime_leases from anon, authenticated;
revoke all on function public.acquire_scheduler_lease(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_scheduler_lease(text, text) from public, anon, authenticated;
grant execute on function public.acquire_scheduler_lease(text, text, integer) to service_role;
grant execute on function public.release_scheduler_lease(text, text) to service_role;
