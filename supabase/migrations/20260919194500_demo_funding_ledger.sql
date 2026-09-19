create table if not exists public.demo_funding_events (
  id uuid primary key default gen_random_uuid(),
  trading_account_id uuid not null references public.trading_accounts(id) on delete cascade,
  user_id uuid not null,
  event_type text not null check (event_type in ('top_up')),
  amount numeric not null check (amount > 0),
  currency text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists demo_funding_events_account_created_idx
  on public.demo_funding_events(trading_account_id, created_at desc);

alter table public.demo_funding_events enable row level security;

create policy "Users can view their own demo funding events"
  on public.demo_funding_events
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.demo_funding_events from anon, authenticated;
