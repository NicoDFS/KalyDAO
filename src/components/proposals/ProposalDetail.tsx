import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Users,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
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
  useBlockNumber,
  useWaitForTransactionReceipt,
  usePublicClient
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
import { useDao } from '@/blockchain/hooks/useDao';
import { ethers } from 'ethers';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTransactionGasConfig } from '@/blockchain/config/transaction';
import { kalyChainMainnet, kalyChainTestnet } from '@/blockchain/config/chains';
import { CountdownTimer } from './CountdownTimer';
import { toast } from "@/components/ui/use-toast";
import { type Abi, type AbiEvent, decodeEventLog, parseGwei } from 'viem';
import { type Hash } from 'viem';

// ProposalDetail component with simplified execution and queue mechanisms
// Uses a direct approach with single transactions and enhanced logging
// Removed retry mechanisms and multiple transaction attempts

interface DecodedProposalCreatedArgs {
  proposalId?: bigint;
  proposer?: `0x${string}`;
  targets?: readonly `0x${string}`[]; // Use readonly based on viem types
  values?: readonly bigint[];
  signatures?: readonly string[];
  calldatas?: readonly `0x${string}`[];
  voteStart?: bigint;
  voteEnd?: bigint;
  description?: string;
}

function hasProposalCreatedArgs(log: any): log is { args: DecodedProposalCreatedArgs } {
  return log && typeof log === 'object' && log.args && typeof log.args === 'object';
}

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
  },
  {
    name: 'queue',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address[]', name: 'targets' },
      { type: 'uint256[]', name: 'values' },
      { type: 'bytes[]', name: 'calldatas' },
      { type: 'bytes32', name: 'descriptionHash' },
    ],
    outputs: [],
  },
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address[]', name: 'targets' },
      { type: 'uint256[]', name: 'values' },
      { type: 'bytes[]', name: 'calldatas' },
      { type: 'bytes32', name: 'descriptionHash' },
    ],
    outputs: [],
  },
  {
    name: 'timelock',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'proposalEta',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'hashProposal',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { type: 'address[]', name: 'targets' },
      { type: 'uint256[]', name: 'values' },
      { type: 'bytes[]', name: 'calldatas' },
      { type: 'bytes32', name: 'descriptionHash' },
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

const timelockAbi = [
  {
    inputs: [],
    name: 'getMinDelay',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
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
  const [userVote, setUserVote] = useState<"for" | "against" | "abstain" | null>(null);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [voteDirection, setVoteDirection] = useState<"for" | "against" | "abstain">("for");
  const [voteReason, setVoteReason] = useState<string>("");
  const [proposalData, setProposalData] = useState<ProposalMetadata & { targets?: string[], values?: string[], calldatas?: string[], full_description?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDelegated, setIsDelegated] = useState<boolean>(false);
  const [isDelegating, setIsDelegating] = useState<boolean>(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  const [isQueueing, setIsQueueing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [queueExecuteError, setQueueExecuteError] = useState<string | null>(null);
  const [queueExecuteHash, setQueueExecuteHash] = useState<Hash | undefined>();
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState<number>(0);
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { contracts, vote, delegate } = useDao();
  const { data: txHash, error: writeError, isPending: isWritePending, writeContract } = useWriteContract();
  const currentChain = chainId === 3889 ? kalyChainTestnet : kalyChainMainnet;
  const publicClient = usePublicClient();

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

  // Read timelock address from Governor
  const { data: timelockAddress } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'timelock',
    chainId,
    account: address
  });

  // Read minDelay from Timelock
  const { data: minDelay } = useReadContract({
    address: timelockAddress as `0x${string}` | undefined, // Only run if timelockAddress is fetched
    abi: timelockAbi,
    functionName: 'getMinDelay',
    chainId,
    account: address,
    query: {
      enabled: !!timelockAddress,
    }
  });

  // Read proposal state for execution verification
  const { data: proposalState, refetch: refetchProposalState } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'state',
    args: id ? [BigInt(id)] : undefined,
    chainId,
    account: address,
    query: { enabled: !!id }
  });

  // Read proposalEta (timestamp when it can be executed)
  const { data: proposalEta } = useReadContract({
     address: governorAddress as `0x${string}`,
     abi: governorABI,
     functionName: 'proposalEta',
     args: id ? [BigInt(id)] : undefined,
     chainId,
     account: address,
     query: {
       enabled: !!id && Number(state) === 5,
     }
  });

  // Parse the votes data
  const votes: ProposalVotes = {
    forVotes: rawVotes ? rawVotes[1] : 0n,
    againstVotes: rawVotes ? rawVotes[0] : 0n,
    abstainVotes: rawVotes ? rawVotes[2] : 0n
  };

  // Convert bigint vote values to human-readable numbers (divide by 10^18)
  const formatTokenAmount = (amount: bigint): number => {
    return Number(amount) / 10**18;
  };

  // Calculate total votes with proper formatting
  const formattedForVotes = formatTokenAmount(votes.forVotes);
  const formattedAgainstVotes = formatTokenAmount(votes.againstVotes);
  const formattedAbstainVotes = formatTokenAmount(votes.abstainVotes);
  const totalVotes = formattedForVotes + formattedAgainstVotes + formattedAbstainVotes;

  // Calculate voting percentages
  const forPercentage = totalVotes > 0 ? (formattedForVotes / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (formattedAgainstVotes / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (formattedAbstainVotes / totalVotes) * 100 : 0;

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
            .select('*, targets, values, calldatas, full_description')
            .eq('proposal_id', proposalId)
            .eq('chain_id', chainId)
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
            proposal_id_param: proposal.proposal_id 
          });
        } catch (viewErr) {
          console.warn('Failed to increment views:', viewErr);
        }

        // Update on-chain data in Supabase if needed
        if (proposal && rawVotes && snapshot && deadline && state !== undefined) {
          // Format votes for database (convert from wei)
          const dbVotesFor = formatTokenAmount(votes.forVotes);
          const dbVotesAgainst = formatTokenAmount(votes.againstVotes);
          const dbVotesAbstain = formatTokenAmount(votes.abstainVotes);
          
          console.log('Updating proposal with on-chain data:', {
            votes_for: dbVotesFor,
            votes_against: dbVotesAgainst,
            votes_abstain: dbVotesAbstain,
            state: Number(state),
            snapshot: Number(snapshot),
            deadline: Number(deadline)
          });
          
          // Compare with existing data before updating
          const needsUpdate = 
            Math.abs(proposal.votes_for - dbVotesFor) > 0.001 ||
            Math.abs(proposal.votes_against - dbVotesAgainst) > 0.001 ||
            Math.abs(proposal.votes_abstain - dbVotesAbstain) > 0.001 ||
            proposal.state !== state.toString() ||
            proposal.snapshot_timestamp !== Number(snapshot) ||
            proposal.deadline_timestamp !== Number(deadline);
            
          if (needsUpdate) {
            console.log('Updating proposal in database with latest blockchain data');
            await supabase
              .from('proposals')
              .update({
                votes_for: dbVotesFor,
                votes_against: dbVotesAgainst,
                votes_abstain: dbVotesAbstain,
                state: getProposalState(Number(state)),
                snapshot_timestamp: Number(snapshot),
                deadline_timestamp: Number(deadline),
                updated_at: new Date().toISOString(),
              })
              .eq('proposal_id', proposal.proposal_id);
          } else {
            console.log('No updates needed - database matches blockchain data');
          }
        } else {
          console.log('Skipping database update - missing on-chain data', {
            hasVotes: !!rawVotes,
            proposalLoaded: !!proposal,
            hasSnapshot: !!snapshot, 
            hasDeadline: !!deadline,
            hasState: state !== undefined
          });
        }
      } catch (err) {
        console.error('Error fetching proposal data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load proposal data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProposalData();
  }, [id, rawVotes, state, snapshot, deadline, chainId]);

  // Update getProposalState to handle numeric states
  const getProposalState = (state: number | string): string => {
    const states = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'];
    if (typeof state === 'string') {
      return state;
    }
    return states[state] || 'Unknown';
  };

  const userVotingPower = Number(balance?.formatted || 0);

  // Rename local function to avoid import conflict
  const formatVoteNumber = (num: number): string => {
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
  const handleVote = (direction: "for" | "against" | "abstain") => {
    console.log(`handleVote called with direction: ${direction}`);
    console.log(`Current isDelegated state: ${isDelegated}`);
    if (!isDelegated) {
      console.log('Vote stopped: User is not delegated.');
      setDelegateError('You need to delegate your voting power first');
      return;
    }
    
    console.log('User is delegated. Showing vote dialog.');
    setVoteDirection(direction);
    setShowVoteDialog(true);
  };

  const confirmVote = async () => {
    console.log('confirmVote started.');
    if (!writeContract || !id || !address) {
      console.log('confirmVote stopped: Missing writeContract, id, or address');
      return;
    }
    
    setIsSubmitting(true);
    setVoteStatus('Preparing transaction...');
    try {
      // Convert direction to support value (0=against, 1=for, 2=abstain)
      const supportValue = voteDirection === 'for' ? 1 : voteDirection === 'against' ? 0 : 2;
      
      console.log(`Calling vote function with: proposalId=${id}, supportValue=${supportValue}, reason=${voteReason.trim() || 'Voted via KalyDAO dApp'}`);
      
      // Call vote without await - the transaction will be tracked via useWriteContract and useWaitForTransactionReceipt
      vote(
        BigInt(id),
        supportValue,
        voteReason.trim() || 'Voted via KalyDAO dApp',
        writeContract
      );
      console.log('vote function call initiated.');
      
      // Do NOT set userVote here yet - wait for confirmation
      setShowVoteDialog(false);
    } catch (err) {
      console.error('Failed to vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to vote on proposal');
      setVoteStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      // Keep isSubmitting true until transaction is confirmed or errors
      if (!txHash) {
        setIsSubmitting(false);
      }
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

  // Keep checkProposalState function 
  const checkProposalState = async (proposalId: string): Promise<number | null> => {
    // Implementation simplified to avoid multi-RPC calls
    try {
      if (!governorAddress) return null;
      
      console.log(`Checking state for proposal ID ${proposalId} on-chain...`);
      
      // Create a provider
      const provider = new ethers.providers.JsonRpcProvider(
        currentChain?.rpcUrls.default.http[0]
      );
      
      // Create contract interface
      const governor = new ethers.Contract(
        governorAddress,
        governorABI,
        provider
      );
      
      // Call state function
      const state = await governor.state(proposalId.toString());
      const stateNumber = Number(state);
      
      console.log(`Proposal state on-chain: ${stateNumber} (${getProposalState(stateNumber)})`);
      
      return stateNumber;
    } catch (err) {
      console.error("Error checking proposal state:", err);
      return null;
    }
  };

  // Keep proposalCreatedEventAbi definition
  const proposalCreatedEventAbi: AbiEvent = {
      anonymous: false,
      inputs: [
        { indexed: false, internalType: "uint256", name: "proposalId", type: "uint256" },
        { indexed: false, internalType: "address", name: "proposer", type: "address" },
        { indexed: false, internalType: "address[]", name: "targets", type: "address[]" },
        { indexed: false, internalType: "uint256[]", name: "values", type: "uint256[]" },
        { indexed: false, internalType: "string[]", name: "signatures", type: "string[]" },
        { indexed: false, internalType: "bytes[]", name: "calldatas", type: "bytes[]" },
        { indexed: false, internalType: "uint256", name: "voteStart", type: "uint256" },
        { indexed: false, internalType: "uint256", name: "voteEnd", type: "uint256" },
        { indexed: false, internalType: "string", name: "description", type: "string" }
      ],
      name: "ProposalCreated",
      type: "event"
    };

  // Track write errors
  useEffect(() => {
    if (writeError) {
      console.error('Error initiating vote transaction:', writeError);
      setVoteStatus(`Error initiating transaction: ${writeError.message || 'Unknown error'}`);
      setIsSubmitting(false);
    }
  }, [writeError]);

  // Hook to wait for queue/execute transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmationError } = useWaitForTransactionReceipt({
    hash: queueExecuteHash,
  });

  // Effect to handle transaction confirmation and update database
  useEffect(() => {
    if (isConfirmed && queueExecuteHash) {
      console.log(`Transaction ${queueExecuteHash} confirmed!`);
      toast({ title: "Transaction Confirmed", description: "Blockchain updated successfully." });

      // Determine the new state based on which action was performed
      // We need a way to know if it was queue or execute that succeeded
      // Option 1: Add state variable like `lastAction: 'queue' | 'execute' | null`
      // Option 2: Infer from current proposal state (less reliable if UI state is stale)
      // Let's assume we can infer for now, but Option 1 is better.
      const currentStateNum = Number(state);
      let newStateText: string | null = null;
      if (currentStateNum === 4) { // If current state was Succeeded, the action was queue
          newStateText = getProposalState(5); // Queued
      } else if (currentStateNum === 5) { // If current state was Queued, the action was execute
          newStateText = getProposalState(7); // Executed
      }

      if (newStateText && proposalData) {
        console.log(`Updating database state to ${newStateText} after confirmation.`);
        supabase
          .from('proposals')
          .update({ state: newStateText, updated_at: new Date().toISOString() })
          .eq('proposal_id', proposalData.proposal_id) // Use the correct ID from loaded data
          .then(({ error: dbError }) => {
            if (dbError) {
              console.error('Failed to update database state after confirmation:', dbError);
              toast({ title: "DB Sync Error", description: "Transaction confirmed, but database update failed.", variant: "destructive" });
            } else {
              console.log("Database state updated successfully after confirmation.");
              // Optionally force re-fetch proposal data to update UI state
              // fetchProposalData();
            }
          });
      } else {
          console.warn("Could not determine new state or proposalData missing, skipping DB update after confirmation.");
      }

      // Reset button states and hash
      setIsQueueing(false);
      setIsExecuting(false);
      setQueueExecuteHash(undefined);

    } else if (confirmationError && queueExecuteHash) {
      console.error(`Transaction ${queueExecuteHash} failed to confirm:`, confirmationError);
      toast({ title: "Transaction Failed", description: confirmationError.message, variant: "destructive" });
      setQueueExecuteError(`Transaction Failed: ${confirmationError.message}`);
      // Reset button states and hash
      setIsQueueing(false);
      setIsExecuting(false);
      setQueueExecuteHash(undefined);
    }
  }, [isConfirmed, confirmationError, queueExecuteHash, state, proposalData]); // Add dependencies

  // Effect to capture the transaction hash after writeContract is called
  useEffect(() => {
    if (txHash) {
      console.log("Transaction submitted, hash:", txHash);
      setQueueExecuteHash(txHash);
      // Reset isQueueing/isExecuting here as isWritePending will become false,
      // and isConfirming will take over the loading state.
      // We check which button was active to reset the correct one.
      if (isQueueing) setIsQueueing(false);
      if (isExecuting) setIsExecuting(false);
    }
  }, [txHash]); // Dependency on txHash

  // Regular functions that we're keeping
  const handleQueue = async () => {
    if (!writeContract || !id || !governorAddress || !address) {
      console.error('Missing required data for queue', { writeContract, id, governorAddress });
      return;
    }

    setIsQueueing(true);
    setQueueExecuteError(null);
    
    try {
      console.log('Queueing proposal', id);
      
      // Get parameters from proposalData and convert to the correct types
      const targets = (proposalData?.targets || []).map(t => t as `0x${string}`);
      const values = (proposalData?.values || []).map(v => BigInt(v));
      const calldatas = (proposalData?.calldatas || []).map(c => c as `0x${string}`);
      
      // Get the ORIGINAL full description text (not the hash)
      const descriptionText = proposalData?.full_description || 
        `${proposalData?.title}\n\n${proposalData?.description}`;
      
      // Calculate the keccak256 hash of the description using ethers
      // This is what the contract uses internally for hashProposal
      const descriptionHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(descriptionText)
      ) as `0x${string}`;
      
      console.log('Queue parameters:', {
        targets,
        values,
        calldatas,
        descriptionHash,
        descriptionText: descriptionText.substring(0, 100) + '...' // Log part of the text
      });

      // Get transaction gas config from the shared utility
      const gasConfig = getTransactionGasConfig();
      console.log('Using gas config:', gasConfig);

      // Use the standard wagmi pattern that works in other components
      writeContract({
        address: governorAddress as `0x${string}`,
        abi: governorABI,
        functionName: 'queue',
        args: [targets, values, calldatas, descriptionHash],
        chain: currentChain,
        account: address,
        ...gasConfig
      });

      console.log('Queue transaction initiated');
      
      toast({
        title: 'Proposal Queued',
        description: 'The transaction has been submitted.',
      });
      
      // Note: txHash will be set by the useEffect that watches for txHash changes
      setRefetchKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error queueing proposal:', error);
      setQueueExecuteError(error?.message || 'An error occurred while queueing the proposal');
      
      toast({
        title: 'Queue Failed',
        description: error?.message || 'An error occurred while queueing the proposal',
        variant: 'destructive',
      });
      setIsQueueing(false);
    }
  };

  const handleExecute = async () => {
    if (!writeContract || !id || !governorAddress || !address) {
      console.error('Missing required data for execution', { writeContract, id, governorAddress });
      return;
    }

    setIsExecuting(true);
    setQueueExecuteError(null);
    
    try {
      // Refresh the state to make sure we have the latest data
      await refetchProposalState?.();
      
      // Check proposal state using the data from the hook
      if (proposalState !== undefined && Number(proposalState) !== 5) { // 5 = Queued
        const stateMessage = `Current state: ${getProposalState(Number(proposalState))} (${proposalState})`;
        console.error(`Proposal not in Queued state. ${stateMessage}`);
        throw new Error(`Invalid proposal state: ${stateMessage}. Must be Queued (5).`);
      }

      // Check timelock delay using the data from the hook
      if (proposalEta && Date.now() / 1000 < Number(proposalEta)) {
        throw new Error('Timelock delay has not passed yet');
      }

      console.log('Executing proposal', id);
      
      // Get parameters from proposalData and convert to the correct types
      const targets = (proposalData?.targets || []).map(t => t as `0x${string}`);
      const values = (proposalData?.values || []).map(v => BigInt(v));
      const calldatas = (proposalData?.calldatas || []).map(c => c as `0x${string}`);
      
      // Get the ORIGINAL full description text (not the hash)
      const descriptionText = proposalData?.full_description || 
        `${proposalData?.title}\n\n${proposalData?.description}`;
      
      // Calculate the keccak256 hash of the description using ethers
      // This is what the contract uses internally for hashProposal
      const descriptionHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(descriptionText)
      ) as `0x${string}`;
      
      console.log('Execute parameters:', {
        targets,
        values,
        calldatas,
        descriptionHash: descriptionHash,
        descriptionText: descriptionText.substring(0, 100) + '...' // Log part of the text
      });

      // Get transaction gas config from the shared utility
      const gasConfig = getTransactionGasConfig();
      console.log('Using gas config:', gasConfig);

      // Use the standard wagmi pattern that works in other components
      writeContract({
        address: governorAddress as `0x${string}`,
        abi: governorABI,
        functionName: 'execute',
        args: [targets, values, calldatas, descriptionHash],
        chain: currentChain,
        account: address,
        ...gasConfig
      });

      console.log('Execute transaction initiated');
      
      toast({
        title: 'Proposal Execution',
        description: 'The transaction has been submitted.',
      });
      
      // Note: txHash will be set by the useEffect that watches for txHash changes
      setRefetchKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error executing proposal:', error);
      setQueueExecuteError(error?.message || 'An error occurred while executing the proposal');
      
      toast({
        title: 'Execution Failed',
        description: error?.message || 'An error occurred while executing the proposal',
        variant: 'destructive',
      });
      setIsExecuting(false);
    }
  };

  // Add a manual execution fallback function that uses ethers.js directly
  const executeManually = async (
    targets: `0x${string}`[],
    values: bigint[],
    calldatas: `0x${string}`[],
    descriptionHash: string
  ) => {
    try {
      if (!governorAddress || !address) return;
      
      console.log("=== MANUAL EXECUTION DEBUG MODE ===");
      console.log("Using ethers.js to directly call the contract...");
      
      // Create provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner(address);
      
      // Create contract instance
      const governorContract = new ethers.Contract(
        governorAddress,
        governorABI,
        signer
      );
      
      // Convert parameters to proper format for ethers.js
      const targetAddresses = targets.map(t => t.toString());
      const valuesBigNumber = values.map(v => ethers.BigNumber.from(v.toString()));
      const calldata = calldatas.map(c => c.toString());
      
      console.log("Calling execute function directly with parameters:");
      console.log("- targets:", targetAddresses);
      console.log("- values:", valuesBigNumber.map(v => v.toString()));
      console.log("- calldatas:", calldata);
      console.log("- descriptionHash:", descriptionHash);
      
      // Specify higher gas limit
      const tx = await governorContract.execute(
        targetAddresses,
        valuesBigNumber,
        calldata,
        descriptionHash,
        {
          gasLimit: 3000000,
          gasPrice: ethers.utils.parseUnits('2', 'gwei')
        }
      );
      
      console.log("Manual transaction submitted:", tx.hash);
      return tx.hash;
    } catch (err) {
      console.error("Error in manual execution:", err);
      const errorMessage = err.message || String(err);
      
      // Special handling for specific errors
      if (errorMessage.includes("unknown proposal id")) {
        console.error("FOUND 'unknown proposal id' ERROR IN MANUAL EXECUTION");
        toast({ 
          title: "ERROR: Unknown Proposal ID", 
          description: "The contract could not find this proposal ID on-chain.",
          variant: "destructive"
        });
      } else if (errorMessage.includes("TimelockController")) {
        console.error("FOUND TIMELOCK CONTROLLER ERROR IN MANUAL EXECUTION");
        toast({ 
          title: "ERROR: Timelock Issue", 
          description: errorMessage,
          variant: "destructive"
        });
      }
      
      throw err;
    }
  };
  
  // Add a helper function to check if a proposal exists directly
  const checkProposalExistsDirectly = async (proposalId: string) => {
    if (!governorAddress) {
      toast({ 
        title: "Error", 
        description: "Governor contract address not found", 
        variant: "destructive" 
      });
      return;
    }
    
    setQueueExecuteError("Checking proposal existence on-chain...");
    
    try {
      // Use ethers.js to call directly
      const provider = new ethers.providers.JsonRpcProvider(
        currentChain?.rpcUrls.default.http[0]
      );
      
      const governor = new ethers.Contract(
        governorAddress,
        governorABI,
        provider
      );
      
      try {
        console.log(`Checking if proposal ${proposalId} exists by calling state()...`);
        
        // Try to get the state - will fail if proposal doesn't exist
        const state = await governor.state(proposalId);
        const stateNum = Number(state);
        const stateName = getProposalState(stateNum);
        
        console.log(`Proposal EXISTS! State: ${stateNum} (${stateName})`);
        
        // Try to get additional info
        try {
          const snapshot = await governor.proposalSnapshot(proposalId);
          console.log(`Snapshot: ${snapshot}`);
        } catch (err) {
          console.log("Could not get snapshot");
        }
        
        try {
          const deadline = await governor.proposalDeadline(proposalId);
          console.log(`Deadline: ${deadline}`);
        } catch (err) {
          console.log("Could not get deadline");
        }
        
        // Success!
        setQueueExecuteError(`Proposal FOUND on-chain! State: ${stateName} (${stateNum})`);
        toast({ 
          title: "Proposal Exists", 
          description: `State: ${stateName}`, 
          variant: "default"
        });
        
        return true;
      } catch (err) {
        console.error("Error checking proposal:", err);
        
        if (err.message?.includes("unknown proposal id")) {
          console.error(`Proposal ${proposalId} does NOT exist on-chain!`);
          setQueueExecuteError(`Proposal ID ${proposalId} NOT FOUND on-chain! Error: unknown proposal id`);
          toast({ 
            title: "Proposal Not Found", 
            description: "This proposal ID does not exist on-chain", 
            variant: "destructive" 
          });
        } else {
          setQueueExecuteError(`Error checking proposal: ${err.message || String(err)}`);
          toast({ 
            title: "Error", 
            description: err.message || "Unknown error checking proposal", 
            variant: "destructive" 
          });
        }
        
        return false;
      }
    } catch (err) {
      console.error("Provider or contract error:", err);
      setQueueExecuteError(`Provider error: ${err.message || String(err)}`);
      toast({ 
        title: "Network Error", 
        description: "Could not connect to blockchain", 
        variant: "destructive" 
      });
      return false;
    }
  };

  // Add function to directly calculate proposal ID using contract
  const calculateProposalIdFromContract = async () => {
    if (!governorAddress || !proposalData?.targets || !proposalData?.values || !proposalData?.calldatas) {
      toast({ 
        title: "Missing Data", 
        description: "Proposal data is incomplete", 
        variant: "destructive" 
      });
      return;
    }
    
    setQueueExecuteError("Calculating proposal ID from contract...");
    
    try {
      // Use ethers.js to call directly
      const provider = new ethers.providers.JsonRpcProvider(
        currentChain?.rpcUrls.default.http[0]
      );
      
      const governor = new ethers.Contract(
        governorAddress,
        governorABI,
        provider
      );
      
      // Convert parameters
      const targets = proposalData.targets.map(t => t);
      const values = proposalData.values.map(v => ethers.BigNumber.from(v));
      const calldatas = proposalData.calldatas.map(c => c);
      
      // Try different description hash calculations
      const descriptionOptions = [];
      
      // Option 1: Full description
      if (proposalData.full_description) {
        descriptionOptions.push({
          name: "Full Description",
          text: proposalData.full_description,
          hash: ethers.utils.id(proposalData.full_description)
        });
      }
      
      // Option 2: Title + Description
      const titleAndDesc = `${proposalData.title}\n\n${proposalData.description}`;
      descriptionOptions.push({
        name: "Title + Description",
        text: titleAndDesc,
        hash: ethers.utils.id(titleAndDesc)
      });
      
      // Option 3: Description only
      descriptionOptions.push({
        name: "Description Only",
        text: proposalData.description,
        hash: ethers.utils.id(proposalData.description)
      });
      
      // For testing - set different values
      const hashResults = [];
      const knownWorkingId = "12408497541758715116290134275497952213534845109460495001490387279328663224184";
      
      // Try each description hash
      for (const option of descriptionOptions) {
        try {
          console.log(`\nTrying with ${option.name}:`);
          console.log(`Description text: "${option.text.substring(0, 50)}..."`);
          console.log(`Description hash: ${option.hash}`);
          
          const calculatedId = await governor.hashProposal(
            targets,
            values,
            calldatas,
            option.hash
          );
          
          const idMatch = calculatedId.toString() === knownWorkingId;
          
          console.log(`Contract calculated ID: ${calculatedId.toString()}`);
          console.log(`Matches known ID? ${idMatch ? "YES ✓" : "NO ✗"}`);
          
          hashResults.push({
            name: option.name,
            hash: option.hash,
            id: calculatedId.toString(),
            matches: idMatch
          });
        } catch (err) {
          console.error(`Error with ${option.name}:`, err);
          hashResults.push({
            name: option.name,
            hash: option.hash,
            id: "ERROR",
            matches: false,
            error: err.message
          });
        }
      }
      
      // Log summary
      console.log("\n=== HASH CALCULATION SUMMARY ===");
      hashResults.forEach(result => {
        console.log(`${result.name}: ${result.id} - ${result.matches ? "MATCH ✓" : "NO MATCH ✗"}`);
      });
      
      // Show results
      setQueueExecuteError(
        `Proposal ID Calculation Results:\n` +
        hashResults.map(r => `${r.name}: ${r.id} - ${r.matches ? "MATCH" : "NO MATCH"}`).join("\n")
      );
      
      // Show toast with best result
      const bestMatch = hashResults.find(r => r.matches);
      if (bestMatch) {
        toast({ 
          title: "Found Matching ID!", 
          description: `${bestMatch.name} creates the correct ID`, 
          variant: "default" 
        });
      } else {
        toast({ 
          title: "No Match Found", 
          description: "None of the calculated IDs match the expected ID", 
          variant: "destructive" 
        });
      }
      
    } catch (err) {
      console.error("Error calculating proposal ID:", err);
      setQueueExecuteError(`Error calculating ID: ${err.message || String(err)}`);
      toast({ 
        title: "Calculation Error", 
        description: err.message || "Unknown error", 
        variant: "destructive" 
      });
    }
  };

  // Direct raw execution with no transforms whatsoever
  const executeRawWithUrlId = async () => {
    if (!governorAddress || !id || !address) {
      toast({ 
        title: "Error", 
        description: "Missing required data (governor, ID, or account)", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsExecuting(true);
    setQueueExecuteError("Executing with raw ID from URL...");
    
    try {
      // The ID directly from the URL with NO processing/transformation
      const rawId = id;
      console.log(`Executing with RAW ID directly from URL: ${rawId}`);
      
      // Get proposal data from Supabase
      if (!proposalData?.targets || !proposalData?.values || !proposalData?.calldatas) {
        throw new Error("Missing proposal parameter data");
      }
      
      // Convert to correct types with minimal processing
      const targets = proposalData.targets.map(t => t as `0x${string}`);
      const values = proposalData.values.map(v => BigInt(v));
      const calldatas = proposalData.calldatas.map(c => c as `0x${string}`);
      const descriptionHash = proposalData.full_description 
        ? ethers.utils.id(proposalData.full_description) as `0x${string}`
        : ethers.utils.id(`${proposalData.title}\n\n${proposalData.description}`) as `0x${string}`;
      
      console.log("=== DIRECT RAW EXECUTION ===");
      console.log("Using RAW ID from URL with no transformations");
      console.log("Targets:", targets);
      console.log("Values:", values.map(v => v.toString()));
      console.log("Calldatas:", calldatas.map(c => `${c.slice(0, 10)}...${c.slice(-8)}`));
      console.log("DescriptionHash:", descriptionHash);
      
      toast({ 
        title: "Direct Execution", 
        description: "Executing with raw ID from URL...", 
      });
      
      // Try BOTH ethers.js and wagmi/viem approaches
      
      // 1. First try ethers.js direct call
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner(address);
        const governor = new ethers.Contract(governorAddress, governorABI, signer);
        
        // Convert to ethers.js format
        const targetAddrs = targets.map(t => t.toString());
        const valuesBN = values.map(v => ethers.BigNumber.from(v.toString()));
        const calldata = calldatas.map(c => c.toString());
        
        // First check if the proposal exists (read-only call)
        try {
          const state = await governor.state(rawId);
          console.log(`Proposal exists! State: ${state} (${getProposalState(Number(state))})`);
        } catch (stateErr) {
          console.error("State check failed:", stateErr.message);
          if (stateErr.message.includes("unknown proposal id")) {
            throw new Error("Proposal doesn't exist on this network with this ID");
          }
        }
        
        // Execute directly
        const tx = await governor.execute(
          targetAddrs,
          valuesBN,
          calldata,
          descriptionHash,
          {
            gasLimit: 3000000,
            gasPrice: ethers.utils.parseUnits('2', 'gwei')
          }
        );
        
        console.log("Raw execution transaction submitted:", tx.hash);
        toast({ 
          title: "Transaction Submitted", 
          description: `Tx: ${tx.hash.slice(0, 10)}...${tx.hash.slice(-6)}`,
        });
        return; // Success!
      } catch (ethersErr) {
        console.error("Ethers.js execution failed:", ethersErr);
        console.log("Falling back to wagmi/viem...");
      }
      
      // 2. Fallback to wagmi/viem if ethers.js fails
      writeContract({
        address: governorAddress as `0x${string}`,
        gas: 3000000n,
        gasPrice: BigInt(Math.floor(2 * 1e9)),
        abi: governorABI,
        functionName: 'execute',
        args: [targets, values, calldatas, descriptionHash],
        chain: currentChain,
        account: address,
      });
      
    } catch (err) {
      console.error("Raw execution error:", err);
      setQueueExecuteError(`Raw execution error: ${err.message || String(err)}`);
      toast({ 
        title: "Execution Error", 
        description: err.message || "Unknown error", 
        variant: "destructive" 
      });
      setIsExecuting(false);
    }
  };

  // Verify network settings and contracts
  const verifyNetworkAndContracts = async () => {
    setQueueExecuteError("Verifying network settings and contracts...");
    
    try {
      // Check current network
      const currentChainId = chainId || 0;
      console.log(`Current chain ID: ${currentChainId}`);
      
      if (currentChainId === 0) {
        throw new Error("Not connected to any network");
      }
      
      if (!governorAddress) {
        throw new Error("Governor contract address not found for this network");
      }
      
      console.log(`Governor contract address: ${governorAddress}`);
      
      // Check if the contract exists on this network
      const provider = new ethers.providers.JsonRpcProvider(
        currentChain?.rpcUrls.default.http[0]
      );
      
      // Check contract code
      const code = await provider.getCode(governorAddress);
      if (code === '0x') {
        throw new Error(`No contract exists at address ${governorAddress} on this network!`);
      }
      
      console.log("✅ Governor contract exists on this network");
      
      // Try to get the name
      try {
        const governor = new ethers.Contract(
          governorAddress,
          governorABI,
          provider
        );
        
        // Try some basic read calls
        try {
          const name = await governor.name();
          console.log(`Governor name: ${name}`);
        } catch (nameErr) {
          console.log("Could not get governor name");
        }
        
        try {
          const proposalCount = await governor.proposalCount();
          console.log(`Proposal count: ${proposalCount}`);
        } catch (countErr) {
          console.log("Could not get proposal count");
        }
        
        // Try to get the timelock address
        try {
          const timelock = await governor.timelock();
          console.log(`Timelock address: ${timelock}`);
          
          // Check if timelock contract exists
          const timelockCode = await provider.getCode(timelock);
          if (timelockCode === '0x') {
            console.log(`⚠️ WARNING: No timelock contract exists at ${timelock}`);
          } else {
            console.log("✅ Timelock contract exists");
          }
        } catch (timelockErr) {
          console.log("Could not get timelock address");
        }
        
        // Check the proposal state if we have an ID
        if (id) {
          try {
            const state = await governor.state(id);
            console.log(`✅ PROPOSAL FOUND! State: ${state} (${getProposalState(Number(state))})`);
            
            // Try to get proposal snapshot and deadline
            try {
              const snapshot = await governor.proposalSnapshot(id);
              const deadline = await governor.proposalDeadline(id);
              console.log(`Snapshot: ${snapshot}, Deadline: ${deadline}`);
            } catch (detailsErr) {
              console.log("Could not get proposal details");
            }
            
            setQueueExecuteError(
              `Proposal VERIFIED on-chain! State: ${getProposalState(Number(state))} (${state})`
            );
            
            toast({ 
              title: "Proposal Verified", 
              description: `Found on network ${currentChainId} with state: ${getProposalState(Number(state))}`,
            });
            
            return true;
          } catch (stateErr) {
            console.error("Error getting proposal state:", stateErr);
            if (stateErr.message?.includes("unknown proposal id")) {
              throw new Error(`Proposal ID ${id} does NOT exist on this network!`);
            }
            throw stateErr;
          }
        }
        
        setQueueExecuteError(
          `Network and contracts verified. Chain: ${currentChainId}, Governor: ${governorAddress}`
        );
        
        toast({ 
          title: "Verification Complete", 
          description: "All contracts exist and are accessible",
        });
        
        return true;
      } catch (contractErr) {
        console.error("Contract interaction error:", contractErr);
        throw new Error(`Contract error: ${contractErr.message || String(contractErr)}`);
      }
    } catch (err) {
      console.error("Verification error:", err);
      setQueueExecuteError(`Verification error: ${err.message || String(err)}`);
      toast({ 
        title: "Verification Failed", 
        description: err.message || "Unknown error", 
        variant: "destructive" 
      });
      return false;
    }
  };
  
  // Add a completely bare-bones execution attempt
  const executeBareBones = async () => {
    try {
      if (!window.ethereum || !governorAddress || !id || !proposalData) {
        toast({ 
          title: "Missing Data", 
          description: "Required data is missing", 
          variant: "destructive" 
        });
        return;
      }
      
      console.log("Starting BARE BONES execution attempt...");
      setQueueExecuteError("Attempting bare-bones execution with minimal code...");
      
      // Use the raw ID directly from the URL
      const rawId = id;
      console.log(`Raw proposal ID: ${rawId}`);
      
      // Create minimal contract interface - only the needed function
      const minimalABI = [
        {
          "inputs": [
            { "internalType": "address[]", "name": "targets", "type": "address[]" },
            { "internalType": "uint256[]", "name": "values", "type": "uint256[]" },
            { "internalType": "bytes[]", "name": "calldatas", "type": "bytes[]" },
            { "internalType": "bytes32", "name": "descriptionHash", "type": "bytes32" }
          ],
          "name": "execute",
          "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ];
      
      // Get the raw parameters directly from the proposalData
      const rawTargets = proposalData.targets;
      const rawValues = proposalData.values.map(v => ethers.BigNumber.from(v));
      const rawCalldatas = proposalData.calldatas;
      
      // Get description hash - try multiple options if needed
      let descriptionHash;
      
      if (proposalData.full_description) {
        // Option 1: Full description
        descriptionHash = ethers.utils.id(proposalData.full_description);
      } else {
        // Option 2: Title + Description
        descriptionHash = ethers.utils.id(`${proposalData.title}\n\n${proposalData.description}`);
      }
      
      console.log("BARE BONES parameters:");
      console.log("- targets:", rawTargets);
      console.log("- values:", rawValues.map(v => v.toString()));
      console.log("- calldatas:", rawCalldatas.map(c => `${c.slice(0, 10)}...${c.slice(-8)}`));
      console.log("- descriptionHash:", descriptionHash);
      
      // Connect with minimal code
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(governorAddress, minimalABI, signer);
      
      // Call the function directly
      const tx = await contract.execute(
        rawTargets, 
        rawValues, 
        rawCalldatas, 
        descriptionHash,
        {
          gasLimit: 3000000, 
          gasPrice: ethers.utils.parseUnits('2', 'gwei')
        }
      );
      
      console.log("BARE BONES transaction submitted:", tx.hash);
      setQueueExecuteError(`Transaction submitted: ${tx.hash}`);
      
      toast({ 
        title: "Transaction Submitted", 
        description: `TX: ${tx.hash.slice(0, 10)}...${tx.hash.slice(-6)}`, 
      });
      
    } catch (err) {
      console.error("BARE BONES execution error:", err);
      setQueueExecuteError(`Bare bones error: ${err.message || String(err)}`);
      toast({ 
        title: "Execution Failed", 
        description: err.message || "Unknown error", 
        variant: "destructive" 
      });
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
                    {formatVoteNumber(formattedForVotes)} ({forPercentage.toFixed(2)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <ThumbsDown className="h-4 w-4 text-red-600" />
                  <span>
                    {formatVoteNumber(formattedAgainstVotes)} ({againstPercentage.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <Progress value={forPercentage} className="h-2" />
            </div>

            <div className="flex justify-between text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{formatVoteNumber(totalVotes)} total votes</span>
              </div>
              {userVotingPower > 0 && (
                <div>
                  Your voting power: {formatVoteNumber(userVotingPower)}
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
                        You voted {userVote.toUpperCase()} this proposal with {formatVoteNumber(userVotingPower)} voting power.
                      </p>
                    </div>
                  ) : isSubmitting ? (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <p className="text-sm text-gray-600">
                        {voteStatus || "Processing vote..."}
                      </p>
                      {/* Show transaction status if available */}
                      {queueExecuteHash && (
                        <p className="text-xs text-blue-600 mt-2">
                          Transaction: {queueExecuteHash.slice(0, 10)}...{queueExecuteHash.slice(-8)}
                        </p>
                      )}
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
                        onClick={() => handleVote("abstain")}
                        className="flex-1 bg-gray-500 hover:bg-gray-600 text-white"
                        variant="secondary"
                      >
                        <MinusCircle className="h-4 w-4 mr-2" />
                        Abstain
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
                      `You voted ${userVote === 'abstain' ? 'ABSTAIN on' : userVote.toUpperCase()} this proposal with ${formatVoteNumber(userVotingPower)} voting power.` :
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
                  {formatVoteNumber(formattedForVotes)} voting power
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
                  {formatVoteNumber(formattedAgainstVotes)} voting power
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
              <div>
                You are about to vote {voteDirection === 'abstain' ? 'ABSTAIN on' : ` ${voteDirection.toUpperCase()} `} this proposal
                with {formatVoteNumber(userVotingPower)} voting power.
              </div>
              <div className="space-y-2">
                <Label htmlFor="vote-reason">Reason (optional)</Label>
                <Input
                  id="vote-reason"
                  placeholder="Enter your reason for voting..."
                  value={voteReason}
                  onChange={(e) => setVoteReason(e.target.value)}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                This action cannot be undone.
              </div>
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

      {/* Add Queue/Execute buttons */}
      {isConnected && Number(state) === 4 && ( // Succeeded state
        <div className="pt-4">
          <Button 
            onClick={handleQueue}
            disabled={isQueueing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isQueueing ? 'Queueing...' : 'Queue Proposal'}
          </Button>
        </div>
      )}
      {isConnected && Number(state) === 5 && proposalEta && minDelay && (
         <div className="pt-4 space-y-2">
           <p className="text-sm text-gray-600">
             Proposal is queued. Execution available after timelock.
           </p>
           <CountdownTimer 
             targetTimestamp={Number(proposalEta)}
             currentBlock={Number(currentBlock)}
             label="Execution available in:"
             type="detail"
           />
           {Date.now() / 1000 >= Number(proposalEta) ? (
              <Button 
                onClick={handleExecute}
                disabled={isExecuting}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isExecuting ? 'Executing...' : 'Execute Proposal'}
              </Button>
           ) : (
             <Button disabled className="w-full">Execute Proposal (Waiting for Timelock)</Button>
           )}
           
           {/* Remove all debug UI elements */}
         </div>
       )}

      {/* Display View Count */}
      {proposalData?.views_count !== undefined && (
        <div className="text-sm text-gray-500 mt-2 text-right">
          Views: {proposalData.views_count}
        </div>
      )}
    </div>
  );
};
export default ProposalDetail;

