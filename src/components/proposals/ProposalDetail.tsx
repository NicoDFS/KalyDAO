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
  useTransaction,
  useBlockNumber
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTransactionGasConfig } from '@/blockchain/config/transaction';
import { kalyChainMainnet, kalyChainTestnet } from '@/blockchain/config/chains';
import { CountdownTimer } from './CountdownTimer';

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

const governanceTokenABI = [
  {
    name: 'delegates',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'delegate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'delegatee', type: 'address' }],
    outputs: []
  }
] as const;

const ProposalDetail = ({
  minProposalThreshold = 100000,
}: ProposalDetailProps) => {
  const { id } = useParams<{ id: string }>();
  const [userVote, setUserVote] = useState<"for" | "against" | null>(null);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [voteDirection, setVoteDirection] = useState<"for" | "against">("for");
  const [voteReason, setVoteReason] = useState<string>("");
  const [proposalData, setProposalData] = useState<ProposalMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDelegated, setIsDelegated] = useState<boolean>(false);
  const [isDelegating, setIsDelegating] = useState<boolean>(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { contracts, vote, delegate } = useDao();
  const { writeContract } = useWriteContract();
  const currentChain = chainId === 3889 ? kalyChainTestnet : kalyChainMainnet;

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

  // Get current block number
  const { data: currentBlock } = useBlockNumber({
    watch: true,
  });

  const { data: deadline } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalDeadline',
    args: [BigInt(id || '0')],
    chainId,
    account: address
  });

  // Add effect to log deadline data
  useEffect(() => {
    if (deadline && currentBlock) {
      console.log('Deadline from contract:', {
        rawValue: deadline,
        asNumber: Number(deadline),
        currentBlock: Number(currentBlock || 0)
      });
    }
  }, [deadline, currentBlock]);

  const { data: proposer } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalProposer',
    args: [BigInt(id || '0')],
    chainId,
    account: address
  });

  const { data: snapshot } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalSnapshot',
    args: [BigInt(id || '0')],
    chainId,
    account: address
  });

  const { data: rawVotes } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalVotes',
    args: [BigInt(id || '0')],
    chainId,
    account: address
  });

  const { data: state } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'state',
    args: [BigInt(id || '0')],
    chainId,
    account: address
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

  // Get the governance token contract
  const governanceTokenAddress = chainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN;

  // Check delegation status
  const { data: currentDelegate } = useReadContract({
    address: governanceTokenAddress as `0x${string}`,
    abi: governanceTokenABI,
    functionName: 'delegates',
    args: [address || '0x0000000000000000000000000000000000000000'],
    chainId,
    account: address
  });

  // Update delegation status when currentDelegate changes
  useEffect(() => {
    if (currentDelegate && address) {
      setIsDelegated(currentDelegate.toLowerCase() === address.toLowerCase());
    }
  }, [currentDelegate, address]);

  // Handle delegation
  const handleDelegate = async () => {
    if (!address || !chainId || !writeContract) return;
    
    setIsDelegating(true);
    setDelegateError(null);
    
    try {
      await delegate(address as `0x${string}`, writeContract);
      setIsDelegated(true);
    } catch (err) {
      console.error('Failed to delegate:', err);
      setDelegateError(err instanceof Error ? err.message : 'Failed to delegate voting power');
    } finally {
      setIsDelegating(false);
    }
  };

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
        if (rawVotes && snapshot && deadline) {
          await supabase
            .from('proposals')
            .update({
              votes_for: Number(votes.forVotes),
              votes_against: Number(votes.againstVotes),
              votes_abstain: Number(votes.abstainVotes),
              state: state ? state.toString() : proposal.state,
              snapshot_timestamp: Number(snapshot),
              deadline_timestamp: Number(deadline),
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

  // Update getProposalState to handle numeric states
  const getProposalState = (state: number | string): string => {
    const states = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'];
    if (typeof state === 'string') {
      return state;
    }
    return states[state] || 'Unknown';
  };

  const userVotingPower = Number(balance?.formatted || 0);

  // Format vote numbers
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  // Format date
  const formatDate = (dateString: string | number | bigint) => {
    if (typeof dateString === 'string') {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    
    // If it's a block number, calculate estimated date
    // Average block time is 2 seconds for KalyChain
    const AVERAGE_BLOCK_TIME = 2; // seconds
    const blockDifference = Number(dateString) - Number(currentBlock || 0);
    
    console.log('Date calculation debug:', {
      targetBlock: Number(dateString),
      currentBlock: Number(currentBlock || 0),
      blockDifference,
      secondsUntil: blockDifference * AVERAGE_BLOCK_TIME,
      daysUntil: (blockDifference * AVERAGE_BLOCK_TIME) / (60 * 60 * 24),
      estimatedDate: new Date(Date.now() + (blockDifference * AVERAGE_BLOCK_TIME * 1000)).toLocaleString()
    });
    
    const secondsUntil = blockDifference * AVERAGE_BLOCK_TIME;
    const estimatedDate = new Date(Date.now() + (secondsUntil * 1000));
    return estimatedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Handle vote
  const handleVote = (direction: "for" | "against") => {
    if (!isDelegated) {
      setDelegateError('You need to delegate your voting power first');
      return;
    }
    
    setVoteDirection(direction);
    setShowVoteDialog(true);
  };

  const confirmVote = async () => {
    if (!writeContract || !id) return;
    
    setIsSubmitting(true);
    try {
      // Convert direction to support value (0=against, 1=for)
      const supportValue = voteDirection === 'for' ? 1 : 0;
      
      // Cast the vote using the useDao hook's vote function
      await vote(
        BigInt(id),
        supportValue,
        voteReason.trim() || 'Voted via KalyDAO dApp',
        writeContract
      );
      
      // Update local state
      setUserVote(voteDirection);
      setShowVoteDialog(false);
      
      // Update database after successful on-chain vote
      await supabase
        .from('proposals')
        .update({
          [`votes_${voteDirection}`]: Number(votes[`${voteDirection}Votes`]) + Number(userVotingPower),
          updated_at: new Date().toISOString(),
        })
        .eq('proposal_id', id);
        
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

  // Check if voting is allowed
  const canVote = () => {
    if (!isConnected) return false;
    if (userVote) return false;
    if (userVotingPower <= 0) return false;
    
    // Get current block number
    const currentBlock = snapshot ? Number(snapshot) : 0;
    const proposalDeadline = deadline ? Number(deadline) : 0;
    
    // Check if we're within the voting period
    const isVotingPeriod = currentBlock <= proposalDeadline;
    
    // Convert state to number if it's a string
    const numericState = typeof state === 'string' ? 
      ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed']
        .indexOf(state) : Number(state);
    
    // Only allow voting if state is Active (1)
    // Note: Pending (0) means we're in the delay period and voting hasn't started yet
    return numericState === 1 && isVotingPeriod;
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
          <div className="flex flex-col items-end gap-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}
            >
              {getProposalState(state || proposalData?.state || 0)}
            </span>
            {Number(state) === 0 && snapshot && currentBlock && (
              <div className="text-xs text-gray-600">
                <CountdownTimer
                  targetBlock={Number(snapshot)}
                  currentBlock={Number(currentBlock)}
                  type="badge"
                />
              </div>
            )}
            {Number(state) === 1 && deadline && currentBlock && (
              <div className="text-xs text-gray-600">
                <CountdownTimer
                  targetBlock={Number(deadline)}
                  currentBlock={Number(currentBlock)}
                  type="badge"
                />
              </div>
            )}
          </div>
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
          <span>Voting Ends: {deadline ? `~${formatDate(Number(deadline))}` : 'Not set'}</span>
        </div>
      </div>

      {/* Voting progress */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Voting Progress</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
                {getProposalState(state || proposalData?.state || 0)}
              </span>
            </div>
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
              {userVotingPower > 0 && (
                <div>
                  Your voting power: {formatNumber(userVotingPower)}
                </div>
              )}
            </div>

            {/* Voting buttons */}
            {canVote() ? (
              <div className="pt-4">
                {isConnected ? (
                  userVote ? (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <p className="text-sm text-gray-600">
                        You voted {userVote.toUpperCase()} this proposal with {formatNumber(userVotingPower)} voting power.
                      </p>
                    </div>
                  ) : isDelegated ? (
                    <div className="flex gap-4">
                      <Button
                        onClick={() => handleVote("for")}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Vote For
                      </Button>
                      <Button
                        onClick={() => handleVote("against")}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Vote Against
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <p className="text-sm text-gray-600 mb-4">
                        You need to delegate your voting power before you can vote.
                        {delegateError && (
                          <span className="text-red-600 block mt-2">{delegateError}</span>
                        )}
                      </p>
                      <Button
                        onClick={handleDelegate}
                        disabled={isDelegating}
                        className="w-full"
                      >
                        {isDelegating ? 'Delegating...' : 'Delegate Voting Power'}
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
            ) : (
              <div className="pt-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600">
                    {userVote ? 
                      `You voted ${userVote.toUpperCase()} this proposal with ${formatNumber(userVotingPower)} voting power.` :
                      userVotingPower <= 0 ?
                        'You need governance tokens to vote on this proposal.' :
                        Number(state) === 0 ?
                          'This proposal is in the delay period. Voting will start soon.' :
                          Number(state) === 1 ?
                            'Voting is active for this proposal.' :
                            `Voting is ${getProposalState(state || proposalData?.state || 0).toLowerCase()} for this proposal.`
                    }
                  </p>
                  {Number(state) === 0 && snapshot && currentBlock && (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Current block:</span>
                        <span>{Number(currentBlock)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Voting starts at block:</span>
                        <span>{Number(snapshot)}</span>
                      </div>
                      <CountdownTimer
                        targetBlock={Number(snapshot)}
                        currentBlock={Number(currentBlock)}
                      />
                    </div>
                  )}
                  {Number(state) === 1 && deadline && currentBlock && (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Current block:</span>
                        <span>{Number(currentBlock)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Voting ends at block:</span>
                        <span>{Number(deadline)}</span>
                      </div>
                      <CountdownTimer
                        targetBlock={Number(deadline)}
                        currentBlock={Number(currentBlock)}
                      />
                    </div>
                  )}
                </div>
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
            <AlertDialogDescription className="space-y-4">
              <p>
                You are about to vote {voteDirection.toUpperCase()} this proposal
                with {formatNumber(userVotingPower)} voting power.
              </p>
              <div className="space-y-2">
                <Label htmlFor="vote-reason">Reason (optional)</Label>
                <Input
                  id="vote-reason"
                  placeholder="Enter your reason for voting..."
                  value={voteReason}
                  onChange={(e) => setVoteReason(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmVote}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Confirming...' : 'Confirm Vote'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProposalDetail;
