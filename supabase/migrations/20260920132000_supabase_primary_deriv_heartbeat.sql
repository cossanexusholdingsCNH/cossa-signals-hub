-- Primary 1-minute Deriv heartbeat scheduler.
-- The scheduler credential is generated inside Supabase Vault and never committed or exposed.
-- GitHub Actions remains a 5-minute backup using the separate CRON_SECRET path.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'cossa_signals_scheduler_token'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cossa_signals_scheduler_token',
      'Cossa Signals primary Deriv heartbeat scheduler credential'
    );
  end if;
end
$$;

create or replace function public.verify_scheduler_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_token is not null
    and exists (
      select 1
      from vault.decrypted_secrets
      where name = 'cossa_signals_scheduler_token'
        and decrypted_secret = p_token
    ),
    false
  );
$$;

revoke all on function public.verify_scheduler_token(text) from public, anon, authenticated;
grant execute on function public.verify_scheduler_token(text) to service_role;

comment on function public.verify_scheduler_token(text) is
  'Server-only validation for the Supabase Vault-backed Cossa Signals heartbeat scheduler token.';

select cron.schedule(
  'cossa-signals-deriv-heartbeat-1m',
  '* * * * *',
  $job$
    select net.http_get(
      url := 'https://cossa-signals-hub.vercel.app/api/deriv-heartbeat',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'cossa_signals_scheduler_token'
        )
      ),
      timeout_milliseconds := 55000
    ) as request_id;
  $job$
);
