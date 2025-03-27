-- Setup delegation history table
create table if not exists public.delegation_history (
    id uuid default gen_random_uuid() primary key,
    delegator_address text not null,
    from_delegate text not null,
    to_delegate text not null,
    transaction_hash text not null unique,
    block_number bigint not null,
    timestamp timestamptz not null default now(),
    network_id integer not null,
    voting_power numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Constraints
    constraint delegation_history_network_check check (network_id in (3889, 3888))
);

-- Create indexes for better query performance
create index if not exists idx_delegation_history_delegator on public.delegation_history(delegator_address);
create index if not exists idx_delegation_history_from_delegate on public.delegation_history(from_delegate);
create index if not exists idx_delegation_history_to_delegate on public.delegation_history(to_delegate);
create index if not exists idx_delegation_history_network on public.delegation_history(network_id);
create index if not exists idx_delegation_history_timestamp on public.delegation_history(timestamp desc);

-- Enable Row Level Security
alter table public.delegation_history enable row level security;

-- Create RLS policies
create policy "Enable read access for all users"
    on public.delegation_history
    for select
    using (true);

create policy "Enable insert for all users"
    on public.delegation_history
    for insert
    with check (true);

create policy "Enable update for all users"
    on public.delegation_history
    for update
    using (true)
    with check (true);

-- Create updated_at trigger
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger handle_delegation_history_updated_at
    before update on public.delegation_history
    for each row
    execute procedure public.handle_updated_at();

-- Grant permissions to both anon and authenticated roles
grant usage on schema public to anon, authenticated;
grant all on public.delegation_history to anon, authenticated;

-- Add table comment
comment on table public.delegation_history is 'Stores delegation history for the DAO governance token';