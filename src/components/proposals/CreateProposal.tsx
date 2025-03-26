import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, Info, ExternalLink } from "lucide-react";
import { 
  useAccount, 
  useBalance,
  useChainId,
  useWriteContract,
  useTransaction,
  type BaseError
} from 'wagmi';
import { type Abi } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';
import { kalyChainMainnet, kalyChainTestnet } from '@/blockchain/config/chains';
import { getTransactionGasConfig } from '@/blockchain/config/transaction';
import { parseEther } from 'viem';
import { supabase } from '@/lib/supabase';
import { useDao } from '@/blockchain/hooks/useDao';
import { toast } from "@/components/ui/use-toast";
import { ethers } from 'ethers';
// UI Components
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CreateProposalProps {
  minProposalThreshold?: number;
}

const formSchema = z.object({
  title: z.string().min(10).max(100),
  summary: z.string().min(20).max(250),
  description: z.string().min(100),
  fullDescription: z.string().min(200),
  category: z.string(),
  votingPeriod: z.string(),
  targets: z.string().optional(),
  values: z.string().optional(),
  calldatas: z.string().optional()
});

type FormData = z.infer<typeof formSchema>;

// Define minimal ABI for the propose function
// Remove the existing governorABI since we'll use the useDao hook

// Add this interface at the top of the file after imports
interface Window {
  ethereum?: {
    request: (args: { method: string, params?: any[] }) => Promise<any>;
    isMetaMask?: boolean;
  };
}

const CreateProposal = ({
  minProposalThreshold = 50000,
}: CreateProposalProps) => {
  const navigate = useNavigate();
  // Using toast imported from "@/components/ui/use-toast"
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [proposalId, setProposalId] = useState<string>();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { contracts, createProposal } = useDao();
  
  // Get the correct token address based on current network
  const governanceTokenAddress = chainId === 3889 
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN;

  const { data: balance, isError: balanceError, isLoading: balanceLoading } = useBalance({
    address,
    token: governanceTokenAddress,
  });

  // Debug logging
  useEffect(() => {
    if (isConnected && address) {
      console.log('Wallet connected:', address);
      console.log('Chain ID:', chainId);
      console.log('Governance Token Address:', governanceTokenAddress);
      console.log('Balance data:', balance);
      if (balanceError) {
        console.error('Balance Error:', balanceError);
      }
    }
  }, [balance, chainId, governanceTokenAddress, balanceError, isConnected, address]);

  const userVotingPower = balance ? parseFloat(balance.formatted) : 0;
  const hasEnoughVotingPower = userVotingPower >= minProposalThreshold;

  // Get the correct governor contract address based on current network
  const governorAddress = chainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNOR_CONTRACT
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNOR_CONTRACT;

  const { data: hash, writeContract, isPending } = useWriteContract();
  
  useEffect(() => {
    if (hash) {
      setTxHash(hash);
      console.log('Transaction hash set:', hash);
      
      // When we have a hash, we can wait for the transaction receipt
      const processTransaction = async () => {
        try {
          // Using ethers to wait for the transaction
          const provider = new ethers.providers.Web3Provider(window.ethereum as any);
          console.log('Waiting for transaction confirmation...');
          const receipt = await provider.waitForTransaction(hash);
          console.log('Transaction confirmed!', receipt);
          
          const proposalId = await processTransactionReceipt(receipt);
          
          if (proposalId) {
            console.log('Proposal created successfully with ID:', proposalId);
            
            // Get proposal data from blockchain before saving to Supabase
            try {
              const onChainData = await getProposalFromBlockchain(proposalId);
              console.log('Retrieved on-chain data:', onChainData);
              
              // Add UI-specific data from form
              const formValues = form.getValues();
              
              // Create proposal data object
              // Convert numeric state to appropriate format based on schema
              const stateValue = onChainData.state.toString();
              
              // Map numeric state to string state for better compatibility
              // 0 = Pending, 1 = Active, 2 = Canceled, 3 = Defeated, 4 = Succeeded, 5 = Queued, 6 = Expired, 7 = Executed
              const stateMap: Record<string, string> = {
                '0': 'Pending',
                '1': 'Active',
                '2': 'Canceled',
                '3': 'Defeated', 
                '4': 'Succeeded',
                '5': 'Queued',
                '6': 'Expired',
                '7': 'Executed'
              };
              
              const completeData = {
                proposal_id: proposalId,
                title: formValues.title,
                description: formValues.description,
                summary: formValues.summary || '',
                proposer_address: onChainData.proposer,
                created_by: address || '',
                chain_id: chainId,
                state: stateMap[stateValue] || 'Pending', // Use string state value
                votes_for: 0,
                votes_against: 0,
                votes_abstain: 0,
                category: formValues.category || '',
                tags: [],
                snapshot_timestamp: Number(onChainData.snapshot),
                deadline_timestamp: Number(onChainData.deadline),
                views_count: 0
              };
              
              // Save the complete data to Supabase
              const saveResult = await saveToSupabase(completeData);
              
              if (saveResult) {
                toast({
                  title: 'Proposal Created',
                  description: 'Your proposal has been created successfully!',
                  variant: 'default',
                });
              } else {
                console.warn('Transaction succeeded but saving to database failed.');
                toast({
                  title: 'Transaction Succeeded',
                  description: 'Your proposal was created, but we could not save details to the database. Please check the Proposals page.',
                  variant: 'default',
                });
                
                // Navigate to proposals list as fallback
                setTimeout(() => {
                  navigate('/proposals');
                }, 1000);
              }
            } catch (err) {
              console.error('Error getting on-chain data or saving to Supabase:', err);
              toast({
                title: 'Error',
                description: 'Your proposal was created on-chain, but we could not save the details to our database.',
                variant: 'destructive',
              });
              
              // Navigate to proposals list as fallback
              setTimeout(() => {
                navigate('/proposals');
              }, 1000);
            }
          } else {
            console.warn('Transaction succeeded but proposal ID could not be extracted.');
            toast({
              title: 'Transaction Succeeded',
              description: 'Your proposal was created, but we could not extract the proposal ID. Please check the Proposals page.',
              variant: 'default',
            });
            
            // Navigate to proposals list as fallback
            setTimeout(() => {
              navigate('/proposals');
            }, 1000);
          }
        } catch (err) {
          console.error('Error processing transaction:', err);
          setError(err instanceof Error ? err.message : 'Unknown error processing transaction');
          toast({
            title: 'Transaction Failed',
            description: err instanceof Error ? err.message : 'Unknown error processing transaction',
            variant: 'destructive',
          });
        } finally {
          setIsSubmitting(false);
        }
      };
      
      processTransaction();
    }
  }, [hash]);

  // Function to query proposal data directly from the blockchain
  const getProposalFromBlockchain = async (proposalId: string) => {
    try {
      console.log('Getting on-chain data for proposal:', proposalId);
      
      // Create provider and contract instances
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      
      // Get governor contract instance
      const governorContract = new ethers.Contract(
        governorAddress,
        [
          {
            name: 'proposalProposer',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'proposalId', type: 'uint256' }],
            outputs: [{ name: '', type: 'address' }]
          },
          {
            name: 'state',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'proposalId', type: 'uint256' }],
            outputs: [{ name: '', type: 'uint8' }]
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
          }
        ],
        provider
      );
      
      console.log('Querying governor contract at:', governorAddress);
      
      // Get proposer address
      const proposer = await governorContract.proposalProposer(proposalId);
      console.log('Proposal proposer:', proposer);
      
      // Get proposal state
      const state = await governorContract.state(proposalId);
      console.log('Proposal state:', state);

      // Get snapshot and deadline
      const snapshot = await governorContract.proposalSnapshot(proposalId);
      const deadline = await governorContract.proposalDeadline(proposalId);
      console.log('Proposal snapshot:', snapshot.toString());
      console.log('Proposal deadline:', deadline.toString());
      
      return {
        proposer,
        state,
        snapshot: snapshot.toString(),
        deadline: deadline.toString()
      };
    } catch (error) {
      console.error('Error querying blockchain for proposal data:', error);
      // If we can't get on-chain data, return fallback data
      return {
        proposer: address || '0x0000000000000000000000000000000000000000',
        state: 0,
        snapshot: '0',
        deadline: '0'
      };
    }
  };

  const processTransactionReceipt = async (receipt: any) => {
    console.log('Receipt logs:', JSON.stringify(receipt.logs, null, 2));
    
    // Ensure we have logs
    if (!receipt.logs || receipt.logs.length === 0) {
      console.error('No logs found in transaction receipt');
      return null;
    }
    
    // Log all event topics for debugging
    receipt.logs.forEach((log: any, index: number) => {
      console.log(`Log ${index} topics:`, log.topics);
      console.log(`Log ${index} address:`, log.address);
      console.log(`Log ${index} full log:`, JSON.stringify(log, null, 2));
    });
    
    // From your logs, we can see that the event has a signature topic and then the data contains the proposal ID
    // The ProposalCreated event is from the governor contract
    const governorLog = receipt.logs.find((log: any) => 
      log.address?.toLowerCase() === governorAddress.toLowerCase()
    );
    
    if (governorLog) {
      console.log('Found governor contract log:', governorLog);
      
      // For Governor contracts, the proposal ID is often the first parameter in the data field
      // The data field is a hex string that needs to be decoded
      try {
        // Extract the first 32 bytes (64 hex chars + '0x' prefix) from the data field
        // This is likely the proposal ID
        const data = governorLog.data;
        console.log('Event data:', data);
        
        if (data && data.length >= 66) {
          // The first 32 bytes after the '0x' prefix
          const proposalIdHex = '0x' + data.slice(2, 66);
          console.log('Extracted potential proposal ID hex:', proposalIdHex);
          
          // Convert to decimal for display and database consistency
          const proposalIdDecimal = BigInt(proposalIdHex).toString();
          console.log('Proposal ID in decimal:', proposalIdDecimal);
          
          // Store both formats for debugging
          localStorage.setItem('lastProposalIdHex', proposalIdHex);
          localStorage.setItem('lastProposalIdDecimal', proposalIdDecimal);
          
          // Set the proposal ID in state for navigation
          setProposalId(proposalIdDecimal);
          
          return proposalIdDecimal;
        }
      } catch (error) {
        console.error('Error extracting proposal ID from event data:', error);
      }
    }
    
    console.warn('Could not find proposal ID in event data, checking transaction hash...');
    
    // As a fallback, use the transaction hash as a unique identifier
    if (receipt.transactionHash) {
      const txHash = receipt.transactionHash;
      console.log('Using transaction hash as fallback identifier:', txHash);
      
      // Create a numeric-like ID from the transaction hash
      // Take last 16 chars of the hash and convert to a decimal string
      const txIdHex = '0x' + txHash.slice(-16);
      const txIdDecimal = BigInt(txIdHex).toString();
      
      console.log('Generated proposal ID from tx hash:', txIdDecimal);
      
      // Store both formats
      localStorage.setItem('lastProposalIdHex', txIdHex);
      localStorage.setItem('lastProposalIdDecimal', txIdDecimal);
      
      // Set the proposal ID in state for navigation
      setProposalId(txIdDecimal);
      
      return txIdDecimal;
    }
    
    console.error('Could not extract proposal ID from transaction logs');
    return null;
  };
  
  const saveToSupabase = async (proposalData: any) => {
    try {
      console.log('Saving proposal to Supabase:', proposalData);
      
      // Try insert
      try {
        const { data: insertData, error: insertError } = await supabase
          .from('proposals')
          .insert(proposalData)
          .select();
          
        if (insertError) {
          console.error('Error inserting proposal:', insertError);
          
          // Check specific error cases
          if (insertError.code === '42P01') { // undefined_table
            const errorMessage = 'The proposals table does not exist in your Supabase database.';
            console.error(errorMessage);
            setError(errorMessage);
            return false;
          }
          
          // Row-level security permission errors
          if (insertError.code === '42501') { // permission_denied
            const errorMessage = 'Permission denied: Your anonymous user lacks access to the proposals table.';
            console.error(errorMessage);
            setError(errorMessage);
            return false;
          }
          
          // If unique constraint violation, try update
          if (insertError.code === '23505') {
            console.log('Proposal already exists, attempting update');
            
            const { data: updateData, error: updateError } = await supabase
              .from('proposals')
              .update(proposalData)
              .eq('proposal_id', proposalData.proposal_id)
              .select();
              
            if (updateError) {
              console.error('Update also failed:', updateError);
              setError(`Failed to update proposal: ${updateError.message}`);
              return false;
            }
            
            console.log('Successfully updated proposal:', updateData);
          } else {
            const errorMessage = `Failed to save proposal: ${insertError.message}`;
            setError(errorMessage);
            return false;
          }
        } else {
          console.log('Successfully inserted proposal:', insertData);
        }
        
        // Navigate to proposal details page
        const proposalDetailsUrl = `/proposals/${proposalData.proposal_id}`;
        console.log('Navigating to:', proposalDetailsUrl);
        
        setTimeout(() => {
          navigate(proposalDetailsUrl);
        }, 1500);
        
        return true;
      } catch (innerErr) {
        console.error('Database operation error:', innerErr);
        const errorMessage = `Database error: ${innerErr instanceof Error ? innerErr.message : 'Unknown error'}`;
        setError(errorMessage);
        return false;
      }
    } catch (err) {
      console.error('Unexpected error in saveToSupabase:', err);
      const errorMessage = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(errorMessage);
      return false;
    }
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      summary: "",
      description: "",
      fullDescription: "",
      category: "",
      votingPeriod: "",
      targets: "",
      values: "",
      calldatas: ""
    }
  });

  const getVotingPeriodInSeconds = (period: string): number => {
    const days = {
      '3days': 3,
      '5days': 5,
      '7days': 7,
      '14days': 14
    }[period] || 3;
    
    return days * 24 * 60 * 60; // Convert days to seconds
  };

  // Get the current chain configuration
  const currentChain = chainId === 3889 ? kalyChainTestnet : kalyChainMainnet;

  const onSubmit = async (formData: FormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      const formValues = formData;
      console.log('Submitting form data:', formValues);

      let targets: `0x${string}`[] = [];
      let values: bigint[] = [];
      let calldatas: `0x${string}`[] = [];

      // Only process contract interaction fields for Treasury proposals
      if (formData.category === 'treasury') {
        targets = formData.targets?.split(',').map(addr => addr.trim()) as `0x${string}`[] || [];
        values = formData.values?.split(',').map(val => BigInt(val.trim())) || [];
        calldatas = formData.calldatas?.split(',').map(data => data.trim()) as `0x${string}`[] || [];
      }

      // If no treasury actions specified, use a dummy action
      if (targets.length === 0) {
        targets = [contracts.governor.address as `0x${string}`];
        values = [0n];
        calldatas = ['0x' as `0x${string}`];
      }

      // Combine description and fullDescription for on-chain storage
      const fullProposalText = `# ${formData.title}\n\n## Summary\n${formData.summary}\n\n## Description\n${formData.description}\n\n## Full Description\n${formData.fullDescription}`;

      console.log('Creating proposal with:', {
        targets: targets.map(t => t.toString()),
        values: values.map(v => v.toString()),
        calldatas: calldatas.map(c => c.toString()),
        description: fullProposalText.substring(0, 50) + '...'
      });

      // Simplified approach without extra parameters
      if (!writeContract) {
        throw new Error("WriteContract function not available");
      }

      if (!address) {
        throw new Error("Wallet not connected");
      }

      // Check if MetaMask is detected
      if (typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask) {
        console.log('MetaMask is installed and detected');
      } else {
        console.warn('MetaMask is not detected - this might be why the popup isn\'t showing');
      }

      // In some cases MetaMask needs to be "woken up" before making a transaction
      // Let's try to get the current nonce first
      const provider = window.ethereum;
      if (provider && provider.request) {
        try {
          console.log('Attempting to wake up MetaMask...');
          await provider.request({ method: 'eth_requestAccounts' });
          console.log('Requested accounts to wake up MetaMask');
          
          // Also try getting the chain ID to further wake up MetaMask
          const chainIdHex = await provider.request({ method: 'eth_chainId' });
          console.log('Current chain ID from provider:', chainIdHex);
        } catch (e) {
          console.error('Failed to request accounts:', e);
        }
      }

      // Now try the contract write
      console.log('Submitting transaction...');
      const governorAbi = [
        {
          inputs: [
            { type: 'address[]', name: 'targets' },
            { type: 'uint256[]', name: 'values' },
            { type: 'bytes[]', name: 'calldatas' },
            { type: 'string', name: 'description' }
          ],
          name: 'propose',
          outputs: [{ type: 'uint256', name: '' }],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ] as const;

      // Use type assertion to bypass TypeScript errors
      const config = {
        address: contracts.governor.address as `0x${string}`,
        abi: governorAbi,
        functionName: 'propose',
        args: [targets, values, calldatas, fullProposalText],
        account: address,
        chain: currentChain
      } as any;

      try {
        console.log('Attempting to send transaction using wagmi writeContract...');
        
        // Call writeContract without awaiting - we handle the result in the useEffect hook
        writeContract(config as any);
        
        // The rest of the transaction processing will happen in the useEffect when hash changes
      } catch (wagmiError) {
        console.error('Failed to send transaction via wagmi:', wagmiError);
        setError(`wagmi writeContract failed: ${wagmiError instanceof Error ? wagmiError.message : 'Unknown error'}`);
        setIsSubmitting(false);
        
        // Try fallback method if needed
        try {
          console.log('Attempting fallback with direct provider call...');
          if (window.ethereum && window.ethereum.request) {
            // Try to wake up MetaMask with a request
            try {
              await window.ethereum.request({
                method: 'eth_requestAccounts'
              });
              
              // Retry the writeContract call after waking MetaMask
              console.log('Retrying writeContract after MetaMask wake-up...');
              writeContract(config as any);
              // Result will be handled by the useEffect hook
            } catch (metaMaskError) {
              console.error('Error waking up MetaMask:', metaMaskError);
              throw metaMaskError;
            }
          } else {
            throw new Error('No Ethereum provider available for fallback');
          }
        } catch (providerError) {
          console.error('Fallback method also failed:', providerError);
          setError(`Both methods failed. Please try refreshing the page and ensure MetaMask is unlocked.`);
          setIsSubmitting(false);
        }
      }
    } catch (err) {
      console.error('Failed to create proposal:', err);
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
      setIsSubmitting(false);
      toast({
        title: 'Transaction Failed', 
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Create New Proposal
        </h1>
        <p className="text-gray-600 mt-2">
          Submit a proposal for the KalyChain DAO to vote on. Proposals require
          a minimum of {minProposalThreshold.toLocaleString()} gKLC (Governance KLC) voting power
          to create.
        </p>
        {chainId && (
          <p className="text-sm text-gray-500 mt-1">
            Network: {chainId === 3889 ? 'Testnet' : 'Mainnet'} | Your voting power: {userVotingPower.toLocaleString()} gKLC
          </p>
        )}
      </div>

      {!isConnected ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                Wallet Not Connected
              </h3>
              <p className="text-gray-500 mt-2 mb-4">
                You need to connect your wallet to create a proposal
              </p>
              <ConnectButton />
            </div>
          </CardContent>
        </Card>
      ) : !hasEnoughVotingPower ? (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Insufficient Voting Power</AlertTitle>
            <AlertDescription>
              You need at least {minProposalThreshold.toLocaleString()} gKLC voting
              power to create a proposal. You currently have{" "}
              {userVotingPower.toLocaleString()} gKLC.
            </AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle>Need Voting Power?</CardTitle>
              <CardDescription>
                To participate in governance, you need to wrap your KLC tokens to gKLC
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                gKLC (Governance KLC) is the governance token that gives you voting power in the DAO.
                You can wrap your KLC tokens to gKLC and unwrap them back at any time.
              </p>
              <Link 
                to="/wrap"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                Wrap KLC to gKLC
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Form {...form}>
          <form 
            onSubmit={(e) => {
              // Prevent default form submission
              e.preventDefault();
            }} 
            className="space-y-6"
          >
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Proposal Details</CardTitle>
                <CardDescription>
                  Provide the basic information about your proposal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter a clear, concise title"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This will be displayed as the main title of your proposal
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Summary</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide a brief summary of your proposal"
                          {...field}
                          className="resize-none"
                          rows={2}
                        />
                      </FormControl>
                      <FormDescription>
                        A short summary that will appear in proposal listings
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide a detailed description of your proposal"
                          {...field}
                          className="resize-none"
                          rows={4}
                        />
                      </FormControl>
                      <FormDescription>
                        A clear explanation of what this proposal aims to achieve
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fullDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide comprehensive details, technical specifications, and implementation plans"
                          {...field}
                          className="resize-vertical"
                          rows={8}
                        />
                      </FormControl>
                      <FormDescription>
                        Include all necessary details, technical specifications, implementation plans, and any relevant links or resources
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="governance">Governance</SelectItem>
                          <SelectItem value="treasury">Treasury</SelectItem>
                          <SelectItem value="protocol">Protocol</SelectItem>
                          <SelectItem value="community">Community</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The category helps organize proposals by their purpose
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="votingPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormLabel>Voting Period</FormLabel>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="w-80 text-sm">
                                The voting period determines how long the
                                proposal will be open for voting. Standard
                                periods are recommended for most proposals.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a voting period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="3days">
                            3 Days (Standard)
                          </SelectItem>
                          <SelectItem value="5days">5 Days</SelectItem>
                          <SelectItem value="7days">
                            7 Days (Extended)
                          </SelectItem>
                          <SelectItem value="14days">
                            14 Days (Major Changes)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {form.watch("category") === "treasury" && (
              <Card>
                <CardHeader>
                  <CardTitle>Treasury Actions</CardTitle>
                  <CardDescription>
                    Specify the treasury interactions for this proposal
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="targets"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Addresses</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter the contract address to interact with"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The contract address this proposal will send funds to or interact with
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="values"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (in KLC)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Enter the amount of KLC to send"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Convert KLC to Wei
                              field.onChange(value ? parseEther(value).toString() : '');
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          The amount of KLC to transfer (if applicable)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="calldatas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Function Call</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              // Here we would encode the selected function with its parameters
                              field.onChange(value);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select the function to call" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="transfer">Transfer KLC</SelectItem>
                              <SelectItem value="approve">Approve Spending</SelectItem>
                              {/* Add more common treasury functions */}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription>
                          Select the function you want to call on the target contract
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => navigate("/proposals")}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                disabled={isSubmitting || isPending || !hasEnoughVotingPower}
                onClick={async () => {
                  // Validate the form first
                  const valid = await form.trigger();
                  if (!valid) {
                    console.log('Form validation failed');
                    return;
                  }
                  
                  // Get form values
                  const formData = form.getValues();
                  console.log('Form data:', formData);
                  
                  // Directly call onSubmit
                  onSubmit(formData);
                }}
              >
                {isSubmitting || isPending ? "Creating Proposal..." : "Submit Proposal"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
};

export default CreateProposal;
