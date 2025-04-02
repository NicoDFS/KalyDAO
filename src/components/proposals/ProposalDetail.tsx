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
import { type Abi, type AbiEvent, decodeEventLog } from 'viem';

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
  const [voteHash, setVoteHash] = useState<`0x${string}` | undefined>();
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  
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

  // Read proposalEta (timestamp when it can be executed)
  const { data: proposalEta } = useReadContract({
     address: governorAddress as `0x${string}`,
     abi: governorABI,
     functionName: 'proposalEta',
     args: [BigInt(id || '0')],
     chainId,
     account: address,
     query: {
       enabled: Number(state) === 5,
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
            .select('*, comments(*, user:profiles(*)), targets, values, calldatas, full_description')
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
            proposal_id: proposal.proposal_id 
          });
        } catch (viewErr) {
          console.warn('Failed to increment views:', viewErr);
        }

        // Update on-chain data in Supabase if needed
        if (rawVotes && snapshot && deadline && state !== undefined) {
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
                state: state.toString(),
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

  // Add a utility function to check proposal state
  const checkProposalState = async () => {
    if (!id) return null;
    
    try {
      console.log(`Checking state for proposal ID ${id} on-chain...`);
      setQueueExecuteError("Checking proposal state...");
      
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
      
      // Call state function directly
      const state = await governor.state(id);
      const stateNumber = Number(state);
      const stateName = getProposalState(stateNumber);
      
      console.log(`Proposal state on-chain: ${stateNumber} (${stateName})`);
      setQueueExecuteError(`Proposal state: ${stateName} (${stateNumber})`);
      
      // Check proposal details through proposals mapping if available
      try {
        const proposalInfo = await governor.proposals(id);
        console.log("Proposal details from contract:", proposalInfo);
      } catch (detailsErr) {
        console.log("Could not get proposal details:", detailsErr);
      }
      
      return stateNumber;
    } catch (err) {
      console.error("Error checking proposal state:", err);
      setQueueExecuteError(`Error checking state: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  };

  // Define the ProposalCreated event ABI fragment explicitly
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

  // Handle Queue - Refactored to use ProposalCreated event data
  const handleQueue = async () => {
    if (!writeContract || !id || !publicClient || !governorAddress) return;

    setIsQueueing(true);
    setQueueExecuteError(null);

    try {
      console.log("Starting queue operation for proposal ID:", id);
      
      // --- Fetch Original Proposal Parameters from Event Log ---
      let targets: `0x${string}`[];
      let values: bigint[];
      let calldatas: `0x${string}`[];
      let description: string;
      let descriptionHash: `0x${string}`;

      try {
        console.log(`Fetching ProposalCreated event logs for Governor: ${governorAddress}`);
        
        // OPTIMIZATION: Store proposal creation block_number in Supabase
        // and use it here as `fromBlock` for much faster lookup.
        // As a fallback, query the last ~1 million blocks (adjust as needed).
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlockEst = latestBlock > 1_000_000n ? latestBlock - 1_000_000n : 0n;

        console.log(`Querying logs from block ${fromBlockEst} to ${latestBlock}`);

        const logs = await publicClient.getLogs({
          address: governorAddress,
          event: proposalCreatedEventAbi,
          fromBlock: fromBlockEst,
          toBlock: 'latest'
        });

        console.log(`Found ${logs.length} ProposalCreated event logs.`);

        const matchingLog = logs.find(log => {
          try {
            const decodedLogItem = decodeEventLog({ abi: [proposalCreatedEventAbi], data: log.data, topics: log.topics });
            // Use type guard
            if (hasProposalCreatedArgs(decodedLogItem)) {
               return decodedLogItem.args.proposalId?.toString() === id;
            }
            return false;
          } catch (decodeErr) {
            console.warn("Failed to decode a log:", decodeErr);
            return false;
          }
        });

        if (!matchingLog) {
          throw new Error(`ProposalCreated event log not found for proposal ID ${id}. Cannot verify parameters.`);
        }

        // Decode the specific log we found
        const decodedEvent = decodeEventLog({
          abi: [proposalCreatedEventAbi],
          data: matchingLog.data,
          topics: matchingLog.topics
        });

        // Use type guard
        if (!hasProposalCreatedArgs(decodedEvent)) {
          throw new Error("Failed to decode args from the found ProposalCreated event log.");
        }

        const args = decodedEvent.args; // Typed args
        
        console.log("Decoded ProposalCreated event args:", args);

        // Validate required fields exist using the typed args
        if (!Array.isArray(args.targets) || !Array.isArray(args.values) || !Array.isArray(args.calldatas) || typeof args.description !== 'string') {
           throw new Error("Decoded event log is missing required parameters (targets, values, calldatas, description).");
        }

        // Extract parameters directly from the typed args
        targets = [...args.targets]; // Convert readonly array to mutable if needed
        values = [...args.values].map(BigInt); // Convert readonly, ensure BigInt
        calldatas = [...args.calldatas]; // Convert readonly
        description = args.description;

        // Calculate descriptionHash from the event's description
        descriptionHash = ethers.utils.id(description) as `0x${string}`;
        
        console.log('Parameters obtained from ProposalCreated event:', {
          targets,
          values: values.map(v => v.toString()), // Log as string for readability
          calldatas,
          description, // Log the description used for the hash
          descriptionHash
        });

      } catch (eventError: any) {
        console.error("Error fetching or processing ProposalCreated event:", eventError);
        setQueueExecuteError(`Error fetching event data: ${eventError.message || String(eventError)}`);
        toast({ title: "Event Fetch Error", description: "Could not retrieve original proposal parameters.", variant: "destructive" });
        setIsQueueing(false);
        return;
      }
      // --- End Fetch Original Proposal Parameters ---

      console.log("Successfully fetched and processed event parameters.");

      // First, check the current state directly (optional but good practice)
      try {
        const stateResult = await checkProposalState();
        if (stateResult !== 4) { // 4 = Succeeded
          throw new Error(`Proposal must be in Succeeded state to queue. Current state: ${getProposalState(stateResult)}`);
        }
        console.log("✅ Proposal is in correct state (Succeeded) for queueing");
      } catch (stateErr) {
        console.error("Failed to verify proposal state:", stateErr);
        // Potentially continue, let the contract validate state
      }
      
      toast({ title: "Queueing Proposal", description: "Please confirm the transaction in your wallet." });
      
      // Get transaction gas config
      const gasConfig = getTransactionGasConfig();

      // Log the exact values we're sending to the contract (using event data)
      console.log('Exact hex inputs to contract (from event data):', {
        targetsHex: targets.map(t => t.toLowerCase()),
        valuesHex: values.map(v => `0x${v.toString(16)}`),
        calldatasHex: calldatas,
        descriptionHashHex: descriptionHash
      });

      // Send the transaction using parameters derived from the event log
      const txResult = await writeContract({
        address: governorAddress as `0x${string}`,
        abi: governorABI,
        functionName: 'queue',
        args: [targets, values, calldatas, descriptionHash], // Use event-derived data
        chain: currentChain,
        account: address,
        ...gasConfig
      });
        
      toast({ 
        title: "Transaction Submitted", 
        description: "Queue transaction has been sent to the blockchain." 
      });
      
      console.log("✅ Queue transaction sent successfully:", txResult);

      // Update Supabase state (optional, but good for UI feedback)
      try {
        const newState = 'Queued'; 
        await supabase
          .from('proposals')
          .update({ state: newState, updated_at: new Date().toISOString() })
          .eq('proposal_id', id);
        console.log('Proposal state updated to Queued in database');
      } catch (dbErr) {
        console.error('Failed to update proposal state in database:', dbErr);
        toast({ title: "Database Update Warning", description: "Tx sent, but DB state update failed.", variant: "destructive" });
      }
    } catch (err) {
      console.error('Failed to queue proposal:', err);
      
      if (err instanceof Error) {
        console.error('Error details:', err.message);
        if (err.message.includes("Governor: proposal not successful")) {
           setQueueExecuteError("Error: Proposal is not in 'Succeeded' state. It must be successful before queueing.");
         } else if (err.message.includes("Governor: unknown proposal id")) {
           // This error should now be less likely if event fetching worked
           setQueueExecuteError("Error: Unknown proposal ID. Event log might be incorrect or contract state changed.");
         } else if (err.message.includes("TimelockController:")) {
           setQueueExecuteError(`Error from Timelock Controller: ${err.message}`);
         } else {
           setQueueExecuteError(err.message);
         }
      } else {
         setQueueExecuteError('Failed to queue proposal: Unknown error');
      }
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Failed to queue proposal', variant: "destructive" });
    } finally {
      setIsQueueing(false);
    }
  };

  // Handle Execute - Refactored to use ProposalCreated event data
  const handleExecute = async () => {
    if (!writeContract || !id || !publicClient || !governorAddress) return;

    setIsExecuting(true);
    setQueueExecuteError(null);

    try {
      console.log("Starting execute operation for proposal ID:", id);
      
      // --- Fetch Original Proposal Parameters from Event Log ---
      let targets: `0x${string}`[];
      let values: bigint[];
      let calldatas: `0x${string}`[];
      let description: string;
      let descriptionHash: `0x${string}`;

      try {
        console.log(`Fetching ProposalCreated event logs for Governor: ${governorAddress}`);
        
        // OPTIMIZATION: Store proposal creation block_number in Supabase
        // and use it here as `fromBlock` for much faster lookup.
        // As a fallback, query the last ~1 million blocks (adjust as needed).
        const latestBlockExe = await publicClient.getBlockNumber();
        const fromBlockEstExe = latestBlockExe > 1_000_000n ? latestBlockExe - 1_000_000n : 0n;

        console.log(`Querying logs from block ${fromBlockEstExe} to ${latestBlockExe} for execution`);

        const logs = await publicClient.getLogs({
          address: governorAddress,
          event: proposalCreatedEventAbi,
          fromBlock: fromBlockEstExe,
          toBlock: 'latest'
        });

        console.log(`Found ${logs.length} ProposalCreated event logs for execution.`);

        const matchingLog = logs.find(log => {
          try {
            const decodedLogItem = decodeEventLog({ abi: [proposalCreatedEventAbi], data: log.data, topics: log.topics });
            // Use type guard
            if (hasProposalCreatedArgs(decodedLogItem)) {
               return decodedLogItem.args.proposalId?.toString() === id;
            }
            return false;
          } catch { return false; }
        });

        if (!matchingLog) {
          throw new Error(`ProposalCreated event log not found for proposal ID ${id}.`);
        }

        const decodedEvent = decodeEventLog({ abi: [proposalCreatedEventAbi], data: matchingLog.data, topics: matchingLog.topics });

        // Use type guard
        if (!hasProposalCreatedArgs(decodedEvent)) {
          throw new Error("Failed to decode args from the found ProposalCreated event log for execution.");
        }
        
        const args = decodedEvent.args; // Typed args

        if (!Array.isArray(args.targets) || !Array.isArray(args.values) || !Array.isArray(args.calldatas) || typeof args.description !== 'string') {
           throw new Error("Decoded event log is missing required parameters for execution.");
        }

        targets = [...args.targets];
        values = [...args.values].map(BigInt);
        calldatas = [...args.calldatas];
        description = args.description;
        descriptionHash = ethers.utils.id(description) as `0x${string}`;
        
        console.log('Parameters obtained from ProposalCreated event for execution:', {
          targets,
          values: values.map(v => v.toString()),
          calldatas,
          description,
          descriptionHash
        });
      } catch (eventError: any) {
        console.error("Error fetching or processing ProposalCreated event for execution:", eventError);
        setQueueExecuteError(`Error fetching event data: ${eventError.message || String(eventError)}`);
        toast({ title: "Event Fetch Error", description: "Could not retrieve original proposal parameters.", variant: "destructive" });
        setIsExecuting(false);
        return;
      }
      // --- End Fetch Original Proposal Parameters ---

      console.log("Successfully fetched and processed event parameters for execution.");

      // Optional: Check state (should be Queued - 5) and ETA
      try {
         const stateResult = await checkProposalState();
         if (stateResult !== 5) { // 5 = Queued
           throw new Error(`Proposal must be in Queued state to execute. Current state: ${getProposalState(stateResult)}`);
         }
         // Add ETA check if needed based on proposalEta state variable
         if (proposalEta && Date.now() / 1000 < Number(proposalEta)) {
            throw new Error(`Timelock delay has not passed yet. Execution available after ${new Date(Number(proposalEta) * 1000).toLocaleString()}`);
         }
         console.log("✅ Proposal state and ETA checks passed for execution.");
      } catch (stateErr: any) {
        console.error("Failed to verify proposal state/ETA for execution:", stateErr);
        setQueueExecuteError(`Pre-execution Check Failed: ${stateErr.message}`);
        toast({ title: "Pre-Execution Check Failed", description: stateErr.message, variant: "destructive" });
        setIsExecuting(false);
        return;
      }

      toast({ title: "Executing Proposal", description: "Please confirm the transaction in your wallet." });
      
      const gasConfig = getTransactionGasConfig();

      console.log('Exact hex inputs to contract (from event data):', {
        targetsHex: targets.map(t => t.toLowerCase()),
        valuesHex: values.map(v => `0x${v.toString(16)}`),
        calldatasHex: calldatas,
        descriptionHashHex: descriptionHash
      });

      const txResult = await writeContract({
        address: governorAddress as `0x${string}`,
        abi: governorABI,
        functionName: 'execute',
        args: [targets, values, calldatas, descriptionHash], // Use event-derived data
        chain: currentChain,
        account: address,
        ...gasConfig
      });
        
      toast({ 
        title: "Transaction Submitted", 
        description: "Execute transaction has been sent to the blockchain." 
      });

      // Update Supabase state
      try {
        await supabase
          .from('proposals')
          .update({ state: 'Executed', updated_at: new Date().toISOString() })
          .eq('proposal_id', id);
        console.log('Proposal state updated to Executed in database');
      } catch (dbErr) {
        console.error('Failed to update proposal state in database:', dbErr);
        toast({ title: "Database Update Warning", description: "Tx sent, but DB state update failed.", variant: "destructive" });
      }
    } catch (err) {
      console.error('Failed to execute proposal:', err);
      
      if (err instanceof Error) {
        console.error('Error details:', err.message);
        if (err.message.includes("Governor: proposal not successful")) {
           setQueueExecuteError("Error: Proposal must be in 'Queued' state and the timelock delay must have passed.");
         } else if (err.message.includes("Governor: unknown proposal id")) {
           setQueueExecuteError("Error: Unknown proposal ID. Event log might be incorrect or contract state changed.");
         } else if (err.message.includes("TimelockController:")) {
           setQueueExecuteError(`Error from Timelock Controller: ${err.message}`);
         } else {
           setQueueExecuteError(err.message);
         }
      } else {
         setQueueExecuteError('Failed to execute proposal: Unknown error');
      }
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Failed to execute proposal', variant: "destructive" });
    } finally {
      setIsExecuting(false);
    }
  };

  // Track write errors
  useEffect(() => {
    if (writeError) {
      console.error('Error initiating vote transaction:', writeError);
      setVoteStatus(`Error initiating transaction: ${writeError.message || 'Unknown error'}`);
      setIsSubmitting(false);
    }
  }, [writeError]);

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
                      {voteHash && (
                        <p className="text-xs text-blue-600 mt-2">
                          Transaction: {voteHash.slice(0, 10)}...{voteHash.slice(-8)}
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
         </div>
       )}
    </div>
  );
};
export default ProposalDetail;

