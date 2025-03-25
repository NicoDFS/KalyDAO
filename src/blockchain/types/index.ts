export type ProposalState = 
  | "Pending"
  | "Active" 
  | "Canceled"
  | "Defeated"
  | "Succeeded"
  | "Queued"
  | "Expired"
  | "Executed";

export interface ProposalVotes {
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  data: {
    hasVoted: boolean;
    support: number;
    weight: bigint;
  };
}

export interface ProposalMetadata {
  id: string;
  title: string;
  description: string;
  fullDescription: string;
  quorum: number;
  discussions: {
    id: string;
    content: string;
    author: string;
    timestamp: string;
  }[];
  created_at: string;
  updated_at: string;
  views: number;
  author: string;
} 