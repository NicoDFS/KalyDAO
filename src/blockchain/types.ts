export type ProposalVotes = {
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
};

export type ProposalState = 
  | 'Pending'
  | 'Active'
  | 'Canceled'
  | 'Defeated'
  | 'Succeeded'
  | 'Queued'
  | 'Expired'
  | 'Executed'; 