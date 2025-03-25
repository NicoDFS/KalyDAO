import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Users,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { 
  useAccount, 
  useBalance, 
  useReadContract,
  useChainId,
  useWriteContract,
  useTransaction
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Discussion } from "./Discussion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type ProposalMetadata } from '@/lib/supabase';
import type { ProposalVotes, ProposalState } from '@/blockchain/types';
import { supabase } from '@/lib/supabase';
import { formatNumber } from '@/utils/format';
import { useDao } from '@/blockchain/hooks/useDao';
import { ethers } from 'ethers';

interface ProposalDetailProps {
  minProposalThreshold?: number;
}

const governorABI = [
  {
    name: 'proposalProposer',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'proposalSnapshot',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'proposalDeadline',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'proposalVotes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      { name: 'againstVotes', type: 'uint256' },
      { name: 'forVotes', type: 'uint256' },
      { name: 'abstainVotes', type: 'uint256' }
    ]
  },
  {
    name: 'state',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }]
  }
] as const;

const ProposalDetail = ({
  minProposalThreshold = 50000,
}: ProposalDetailProps) => {
  const { id } = useParams<{ id: string }>();
  const [userVote, setUserVote] = useState<"for" | "against" | null>(null);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [voteDirection, setVoteDirection] = useState<"for" | "against">("for");
  const [proposalData, setProposalData] = useState<ProposalMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { contracts, vote } = useDao();
  const { writeContract } = useWriteContract();

  // Get the correct contract addresses based on current network
  const governorAddress = chainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNOR_CONTRACT
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNOR_CONTRACT;

  const { data: balance } = useBalance({
    address,
    token: chainId === 3889
      ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN
      : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN,
  });

  // On-chain data queries
  const { data: proposer } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalProposer',
    args: [BigInt(id || '0')],
  });

  const { data: snapshot } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalSnapshot',
    args: [BigInt(id || '0')],
  });

  const { data: deadline } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalDeadline',
    args: [BigInt(id || '0')],
  });

  const { data: rawVotes } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalVotes',
    args: [BigInt(id || '0')],
  });

  const { data: state } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'state',
    args: [BigInt(id || '0')],
  });

  // Parse the votes data
  const votes: ProposalVotes = {
    forVotes: rawVotes ? rawVotes[1] : 0n,
    againstVotes: rawVotes ? rawVotes[0] : 0n,
    abstainVotes: rawVotes ? rawVotes[2] : 0n
  };

  // Calculate total votes
  const totalVotes = Number(votes.forVotes) + Number(votes.againstVotes) + Number(votes.abstainVotes);

  // Calculate voting percentages
  const forPercentage = totalVotes > 0 ? (Number(votes.forVotes) / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (Number(votes.againstVotes) / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (Number(votes.abstainVotes) / totalVotes) * 100 : 0;

  // Fetch both on-chain and off-chain data
  useEffect(() => {
    const fetchProposalData = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        console.log('Fetching proposal data for ID:', id);
        
        // Try to check if we have the last proposal ID stored in localStorage
        const lastProposalIdHex = localStorage.getItem('lastProposalIdHex');
        const lastProposalIdDecimal = localStorage.getItem('lastProposalIdDecimal');
        console.log('Last proposal IDs from localStorage:', { 
          hex: lastProposalIdHex, 
          decimal: lastProposalIdDecimal 
        });
        
        // Try to normalize the ID format - it could be in decimal or hex format
        let proposalIdForSupabase = id;
        
        // If id is a hex string (starts with 0x), convert to decimal
        if (id.startsWith('0x')) {
          proposalIdForSupabase = BigInt(id).toString();
          console.log('Converted hex ID to decimal:', proposalIdForSupabase);
        }
        
        // List of IDs to try in order of likelihood
        const idsToTry = [
          proposalIdForSupabase,
          lastProposalIdDecimal,
          lastProposalIdHex
        ].filter(Boolean); // Remove nulls/undefined
        
        if (id.startsWith('0x')) {
          // If original ID is hex, add the decimal version
          idsToTry.push(BigInt(id).toString());
        } else if (!id.startsWith('0x')) {
          // If original ID is decimal, add the hex version
          idsToTry.push('0x' + BigInt(id).toString(16));
        }
        
        console.log('Will try these IDs in sequence:', idsToTry);
        
        // Try various formats of the proposal ID to find the right one
        const tryFetchProposal = async (proposalId: string) => {
          if (!proposalId) return null;
          
          console.log('Trying to fetch proposal with ID:', proposalId);
          const { data, error } = await supabase
            .from('proposals')
            .select('*')
            .eq('proposal_id', proposalId)
            .single();
            
          if (error) {
            console.log('Error fetching with ID', proposalId, ':', error.message);
            return null;
          }
          
          console.log('Found proposal with ID', proposalId, ':', data);
          return data;
        };
        
        // Try each ID format until we find a match
        let proposal = null;
        for (const idToTry of idsToTry) {
          proposal = await tryFetchProposal(idToTry);
          if (proposal) {
            console.log('Successfully found proposal with ID:', idToTry);
            break;
          }
        }
        
        // If still not found, try removing leading zeros from decimal format
        if (!proposal && proposalIdForSupabase.startsWith('0')) {
          const noLeadingZeros = proposalIdForSupabase.replace(/^0+/, '');
          console.log('Trying without leading zeros:', noLeadingZeros);
          proposal = await tryFetchProposal(noLeadingZeros);
        }
        
        // If still not found, try a broader search
        if (!proposal) {
          console.log('Proposal not found with exact ID match, trying broader search');
          const { data: allProposals, error } = await supabase
            .from('proposals')
            .select('*');
          
          if (!error && allProposals && allProposals.length > 0) {
            console.log(`Found ${allProposals.length} proposals in database:`, 
              allProposals.map(p => ({ id: p.id, proposal_id: p.proposal_id, title: p.title }))
            );
            
            // Try to find a partial match on the ID
            proposal = allProposals.find(p => {
              const pid = p.proposal_id.toString();
              const matches = pid.includes(proposalIdForSupabase) || 
                proposalIdForSupabase.includes(pid) ||
                (lastProposalIdDecimal && pid.includes(lastProposalIdDecimal)) ||
                (lastProposalIdHex && pid.includes(lastProposalIdHex));
              
              if (matches) {
                console.log('Found partial match:', { 
                  proposal_id: p.proposal_id, 
                  query_id: proposalIdForSupabase
                });
              }
              
              return matches;
            });
            
            if (proposal) {
              console.log('Found proposal with partial match:', proposal);
            }
          } else {
            console.log('No proposals found in database or error occurred');
          }
        }
        
        if (!proposal) {
          throw new Error(`Proposal not found with ID ${id}`);
        }
        
        setProposalData(proposal);

        // Increment view count
        try {
          await supabase.rpc('increment_proposal_views', { 
            proposal_id: proposal.proposal_id 
          });
        } catch (viewErr) {
          console.warn('Failed to increment views:', viewErr);
        }

        // Update on-chain data in Supabase if needed
        if (rawVotes) {
          await supabase
            .from('proposals')
            .update({
              votes_for: Number(votes.forVotes),
              votes_against: Number(votes.againstVotes),
              votes_abstain: Number(votes.abstainVotes),
              state: state ? state.toString() : proposal.state,
              updated_at: new Date().toISOString(),
            })
            .eq('proposal_id', proposal.proposal_id);
        }
      } catch (err) {
        console.error('Error fetching proposal data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load proposal data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProposalData();
  }, [id, rawVotes, state]);

  const getProposalState = (state: number): string => {
    const states = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'];
    return states[state] || 'Unknown';
  };

  const userVotingPower = Number(balance?.formatted || 0);

  // Format vote numbers
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Handle vote
  const handleVote = (direction: "for" | "against") => {
    setVoteDirection(direction);
    setShowVoteDialog(true);
  };

  const confirmVote = async () => {
    if (!id) return;
    
    setIsSubmitting(true);
    try {
      // Convert direction to support value (0=against, 1=for)
      const supportValue = voteDirection === 'for' ? 1 : 0;
      
      // Use the useDao hook to cast the vote
      await vote(
        BigInt(id),
        supportValue,
        'Voted via KalyDAO dApp',
        writeContract
      );
      
      setUserVote(voteDirection);
      setShowVoteDialog(false);
    } catch (err) {
      console.error('Failed to vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to vote on proposal');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status badge color
  const getStatusColor = () => {
    switch (Number(state)) {
      case 0: return "bg-yellow-100 text-yellow-800";
      case 1: return "bg-green-100 text-green-800";
      case 2: return "bg-red-100 text-red-800";
      case 3: return "bg-red-100 text-red-800";
      case 4: return "bg-green-100 text-green-800";
      case 5: return "bg-blue-100 text-blue-800";
      case 6: return "bg-gray-100 text-gray-800";
      case 7: return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!proposalData) return <div>Proposal not found</div>;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-sm">
      {/* Back button */}
      <Link
        to="/proposals"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Proposals
      </Link>

      {/* Proposal header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <h1 className="text-2xl font-bold text-gray-900">{proposalData?.title}</h1>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}
          >
            {getProposalState(Number(state))}
          </span>
        </div>
        <p className="text-gray-600 mt-2">{proposalData?.description}</p>
      </div>

      {/* Proposal metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="h-4 w-4 mr-2" />
          <span>Proposed: {formatDate(proposalData?.created_at || "")}</span>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="h-4 w-4 mr-2" />
          <span>Voting Ends: {formatDate(proposalData?.updated_at || "")}</span>
        </div>
      </div>

      {/* Voting progress */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Voting Progress</h3>
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4 text-green-600" />
                  <span>
                    {formatNumber(Number(votes.forVotes))} ({forPercentage.toFixed(2)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <ThumbsDown className="h-4 w-4 text-red-600" />
                  <span>
                    {formatNumber(Number(votes.againstVotes))} ({againstPercentage.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <Progress value={forPercentage} className="h-2" />
            </div>

            <div className="flex justify-between text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{formatNumber(totalVotes)} total votes</span>
              </div>
            </div>

            {/* Voting buttons */}
            {Number(state) === 1 && (
              <div className="pt-4">
                {isConnected ? (
                  userVote ? (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <p className="text-sm text-gray-600">
                        You voted {voteDirection === "for" ? "FOR" : "AGAINST"} this
                        proposal with {formatNumber(userVotingPower)} voting
                        power.
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <Button
                        onClick={() => handleVote("for")}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Vote For
                      </Button>
                      <Button
                        onClick={() => handleVote("against")}
                        variant="destructive"
                        className="flex-1"
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Vote Against
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="bg-gray-50 p-4 rounded-md text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      Connect your wallet to vote on this proposal
                    </p>
                    <ConnectButton />
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Proposal details tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">Vote History</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-6">
          <div className="prose max-w-none">
            {proposalData?.description}
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{proposer as string || "Loading..."}</span>
                  <span className="ml-2 text-green-600 font-medium">
                    Voted FOR
                  </span>
                </div>
                <span className="text-sm">
                  {formatNumber(Number(votes.forVotes))} voting power
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(proposalData?.created_at || "").toLocaleString()}
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{proposer as string || "Loading..."}</span>
                  <span className="ml-2 text-red-600 font-medium">
                    Voted AGAINST
                  </span>
                </div>
                <span className="text-sm">
                  {formatNumber(Number(votes.againstVotes))} voting power
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(proposalData?.updated_at || "").toLocaleString()}
              </span>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="discussion" className="mt-6">
          <Discussion proposalId={proposalData.proposal_id} />
        </TabsContent>
      </Tabs>

      {/* Vote confirmation dialog */}
      <AlertDialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Your Vote</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to vote {voteDirection.toUpperCase()} this proposal
              with {formatNumber(userVotingPower)} voting power. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVote}>
              Confirm Vote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProposalDetail;
