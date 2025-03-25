-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Create enum for proposal states
create type proposal_state as enum (
  'Pending',
  'Active',
  'Canceled',
  'Defeated',
  'Succeeded',
  'Queued',
  'Expired',
  'Executed'
);

-- Create the proposals table
create table if not exists proposals (
  id uuid default uuid_generate_v4() primary key,
  proposal_id text not null unique,
  title text not null,
  description text not null,
  summary text,
  proposer_address text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  state proposal_state not null default 'Pending',
  snapshot_timestamp bigint,
  deadline_timestamp bigint,
  votes_for numeric default 0,
  votes_against numeric default 0,
  votes_abstain numeric default 0,
  category text,
  tags text[],
  views_count integer default 0,
  metadata jsonb,
  
  constraint proposals_proposal_id_key unique (proposal_id)
);

-- Create indexes
create index proposals_proposer_address_idx on proposals(proposer_address);
create index proposals_state_idx on proposals(state);
create index proposals_created_at_idx on proposals(created_at);

-- Create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger for updated_at
create trigger proposals_updated_at
  before update on proposals
  for each row
  execute function update_updated_at_column();

-- Create function to increment view count
create or replace function increment_proposal_views(p_proposal_id text)
returns proposals as $$
declare
  updated_proposal proposals;
begin
  update proposals
  set views_count = views_count + 1
  where proposal_id = p_proposal_id
  returning * into updated_proposal;
  
  return updated_proposal;
end;
$$ language plpgsql; 