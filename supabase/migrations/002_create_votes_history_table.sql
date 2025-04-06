-- Setup votes history table
create table if not exists public.votes_history (
    id uuid default gen_random_uuid() primary key,
    proposal_id text not null,
    voter_address text not null,
    support smallint not null, -- 0=against, 1=for, 2=abstain
    voting_power numeric not null default 0,
    reason text,
    transaction_hash text not null unique,
    block_number bigint not null,
    timestamp timestamptz not null default now(),
    network_id integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Constraints
    constraint votes_history_network_check check (network_id in (3889, 3888)),
    constraint votes_history_support_check check (support in (0, 1, 2)),
    
    -- References
    constraint votes_history_proposal_id_fkey foreign key (proposal_id) 
        references public.proposals(proposal_id) on delete cascade
);

-- Create indexes for better query performance
create index if not exists idx_votes_history_proposal on public.votes_history(proposal_id);
create index if not exists idx_votes_history_voter on public.votes_history(voter_address);
create index if not exists idx_votes_history_network on public.votes_history(network_id);
create index if not exists idx_votes_history_timestamp on public.votes_history(timestamp desc);
create index if not exists idx_votes_history_support on public.votes_history(support);

-- Enable Row Level Security
alter table public.votes_history enable row level security;

-- Create RLS policies
create policy "Enable read access for all users"
    on public.votes_history
    for select
    using (true);

create policy "Enable insert for all users"
    on public.votes_history
    for insert
    with check (true);

create policy "Enable update for all users"
    on public.votes_history
    for update
    using (true)
    with check (true);

-- Create updated_at trigger
create trigger votes_history_updated_at
  before update on public.votes_history
  for each row
  execute function update_updated_at_column(); 