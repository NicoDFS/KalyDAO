import { useState, useEffect } from 'react';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { useDao } from '@/blockchain/hooks/useDao';
import { useReadContract, useWriteContract } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, ArrowRight, History, RefreshCw, Users, TrendingUp, Shield, Vote, HelpCircle, CheckCircle2 } from 'lucide-react';
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';
import { type Abi } from 'viem';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Import your ABIs
import governanceTokenABI from '@/blockchain/abis/GovernanceToken.json';

interface DelegationEvent {
  fromDelegate: string;
  toDelegate: string;
  timestamp: number;
  transactionHash: string;
}

interface TopDelegate {
  address: string;
  votingPower: bigint;
  delegators: number;
}

export function DelegationManager() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { contracts, delegate } = useDao();
  const { writeContract } = useWriteContract();
  const [delegateAddress, setDelegateAddress] = useState('');
  const [isDelegating, setIsDelegating] = useState(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  const [delegationHistory, setDelegationHistory] = useState<DelegationEvent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [topDelegates, setTopDelegates] = useState<TopDelegate[]>([]);
  const [isLoadingTopDelegates, setIsLoadingTopDelegates] = useState(false);

  // Get the governance token contract address based on network
  const governanceTokenAddress = chainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN;

  // Get current delegate
  const { data: currentDelegate } = useReadContract({
    address: governanceTokenAddress as `0x${string}`,
    abi: governanceTokenABI.abi as Abi,
    functionName: 'delegates',
    args: [address || '0x0000000000000000000000000000000000000000'],
    chainId,
    account: address
  });

  // Get voting power
  const { data: votingPower } = useReadContract({
    address: governanceTokenAddress as `0x${string}`,
    abi: governanceTokenABI.abi as Abi,
    functionName: 'getVotes',
    args: [address || '0x0000000000000000000000000000000000000000'],
    chainId,
    account: address
  });

  // Get token balance
  const { data: tokenBalance } = useReadContract({
    address: governanceTokenAddress as `0x${string}`,
    abi: governanceTokenABI.abi as Abi,
    functionName: 'balanceOf',
    args: [address || '0x0000000000000000000000000000000000000000'],
    chainId,
    account: address
  });

  // Fetch delegation history
  const fetchDelegationHistory = async () => {
    if (!address || !publicClient) return;
    
    setIsLoadingHistory(true);
    try {
      const events = await publicClient.getLogs({
        address: governanceTokenAddress as `0x${string}`,
        event: {
          type: 'event',
          name: 'DelegateChanged',
          inputs: [
            { type: 'address', name: 'delegator', indexed: true },
            { type: 'address', name: 'fromDelegate', indexed: true },
            { type: 'address', name: 'toDelegate', indexed: true }
          ]
        },
        args: {
          delegator: address
        },
        fromBlock: 'earliest'
      });

      const history = await Promise.all(
        events.map(async (event) => {
          const block = await publicClient.getBlock({
            blockHash: event.blockHash
          });
          return {
            fromDelegate: (event.args as any).fromDelegate,
            toDelegate: (event.args as any).toDelegate,
            timestamp: Number(block.timestamp),
            transactionHash: event.transactionHash
          };
        })
      );

      setDelegationHistory(history.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Failed to fetch delegation history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch top delegates
  const fetchTopDelegates = async () => {
    if (!publicClient) return;
    
    setIsLoadingTopDelegates(true);
    try {
      const events = await publicClient.getLogs({
        address: governanceTokenAddress as `0x${string}`,
        event: {
          type: 'event',
          name: 'DelegateChanged',
          inputs: [
            { type: 'address', name: 'delegator', indexed: true },
            { type: 'address', name: 'fromDelegate', indexed: true },
            { type: 'address', name: 'toDelegate', indexed: true }
          ]
        },
        fromBlock: 'earliest'
      });

      // Process events to find unique delegates and their delegators
      const delegateMap = new Map<string, Set<string>>();
      events.forEach((event) => {
        const toDelegate = (event.args as any).toDelegate as string;
        const delegator = (event.args as any).delegator as string;
        
        if (!delegateMap.has(toDelegate)) {
          delegateMap.set(toDelegate, new Set());
        }
        delegateMap.get(toDelegate)?.add(delegator);
      });

      // Get voting power for each delegate
      const delegates = Array.from(delegateMap.entries());
      const topDelegatesData = await Promise.all(
        delegates.map(async ([delegateAddress, delegators]) => {
          const votingPower = await publicClient.readContract({
            address: governanceTokenAddress as `0x${string}`,
            abi: governanceTokenABI.abi as Abi,
            functionName: 'getVotes',
            args: [delegateAddress]
          });

          return {
            address: delegateAddress,
            votingPower: votingPower as bigint,
            delegators: delegators.size
          };
        })
      );

      // Sort by voting power and take top 5
      const sortedDelegates = topDelegatesData
        .sort((a, b) => (b.votingPower > a.votingPower ? 1 : -1))
        .slice(0, 5);

      setTopDelegates(sortedDelegates);
    } catch (error) {
      console.error('Failed to fetch top delegates:', error);
    } finally {
      setIsLoadingTopDelegates(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      fetchDelegationHistory();
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (isConnected) {
      fetchTopDelegates();
    }
  }, [isConnected]);

  const handleDelegate = async (delegatee: string) => {
    if (!isConnected) return;
    
    setIsDelegating(true);
    setDelegateError(null);
    
    try {
      await delegate(delegatee as `0x${string}`, writeContract);
      setDelegateAddress(''); // Clear input after successful delegation
    } catch (err) {
      console.error('Failed to delegate:', err);
      setDelegateError(err instanceof Error ? err.message : 'Failed to delegate voting power');
    } finally {
      setIsDelegating(false);
    }
  };

  const handleSelfDelegate = () => {
    if (address) {
      handleDelegate(address);
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Delegation Manager</CardTitle>
            <CardDescription>Connect your wallet to manage your delegation</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Wallet Not Connected</AlertTitle>
              <AlertDescription>
                Please connect your wallet to manage your delegation settings.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Delegation Manager</h1>
        <p className="text-muted-foreground mt-2">
          Manage your voting power delegation and view your current delegation status
        </p>
      </div>
      <div className="space-y-6">
        {/* Current Delegation Status */}
        <Card>
          <CardHeader>
            <CardTitle>Your Delegation Status</CardTitle>
            <CardDescription>View and manage your delegation settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Token Balance</div>
                  <div className="text-2xl font-bold">
                    {tokenBalance ? formatEther(tokenBalance as bigint) : '0'} gKLC
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Voting Power</div>
                  <div className="text-2xl font-bold">
                    {votingPower ? formatEther(votingPower as bigint) : '0'} votes
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Current Delegate</div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-medium">
                    {currentDelegate && currentDelegate !== "0x0000000000000000000000000000000000000000" ? (
                      <>
                        {currentDelegate === address ? (
                          "Self-delegated"
                        ) : (
                          shortenAddress(currentDelegate as string)
                        )}
                      </>
                    ) : (
                      "Not delegated"
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDelegateAddress(currentDelegate as string)}
                    className="ml-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Update
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delegation Explanation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Understanding Delegation
            </CardTitle>
            <CardDescription>Learn how delegation and voting power work in the DAO</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="delegation-info">
                <AccordionTrigger className="text-left">
                  <div className="flex items-center gap-2">
                    <Vote className="h-4 w-4 text-primary" />
                    <span>What is Delegation?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Delegation is a key feature that allows you to assign your voting power to any address, including yourself. 
                      When you delegate your tokens, you maintain ownership while empowering yourself or another member to vote in governance proposals.
                    </p>

                    {/* Key Points About Delegation */}
                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Key Points to Remember
                      </h4>
                      <div className="grid gap-3">
                        <div className="flex items-start gap-2 text-sm">
                          <Shield className="h-4 w-4 text-primary mt-1" />
                          <div>
                            <span className="font-medium">Token Ownership:</span>
                            <p className="text-muted-foreground">
                              Delegating does not transfer your tokens. You retain full ownership and can transfer or sell your tokens at any time.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <TrendingUp className="h-4 w-4 text-primary mt-1" />
                          <div>
                            <span className="font-medium">Voting Power:</span>
                            <p className="text-muted-foreground">
                              Your voting power is determined by the number of tokens you hold. When you delegate, this power is transferred to your chosen delegate.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <Users className="h-4 w-4 text-primary mt-1" />
                          <div>
                            <span className="font-medium">Delegation Options:</span>
                            <p className="text-muted-foreground">
                              You can self-delegate to vote directly, or delegate to another address to vote on your behalf. You can change your delegate at any time.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Important Notes */}
                    <div className="bg-accent/50 rounded-lg p-4 space-y-2">
                      <h4 className="font-medium text-sm">Important Notes:</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                        <li>New delegations override previous ones</li>
                        <li>Delegation changes take effect immediately</li>
                        <li>Your tokens must be delegated (to yourself or others) to participate in governance</li>
                        <li>If you acquire more tokens, they automatically follow your current delegation</li>
                      </ul>
                    </div>

                    <Alert>
                      <HelpCircle className="h-4 w-4" />
                      <AlertTitle>First Time User?</AlertTitle>
                      <AlertDescription>
                        If this is your first time participating in governance, we recommend starting by self-delegating your tokens. 
                        This allows you to directly participate in voting while learning how the system works.
                      </AlertDescription>
                    </Alert>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Delegation Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Delegate Your Votes</CardTitle>
            <CardDescription>
              {delegateAddress === currentDelegate 
                ? "Update your current delegation or choose a new delegate"
                : "Choose how to delegate your voting power"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">Delegate to Address</label>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter delegate address (0x...)"
                    value={delegateAddress}
                    onChange={(e) => setDelegateAddress(e.target.value)}
                  />
                  <Button
                    onClick={() => handleDelegate(delegateAddress)}
                    disabled={isDelegating || !delegateAddress}
                  >
                    {isDelegating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {delegateAddress === currentDelegate ? "Updating..." : "Delegating..."}
                      </>
                    ) : (
                      <>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {delegateAddress === currentDelegate ? "Update Delegation" : "Delegate"}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">Quick Actions</label>
                <Button
                  variant="outline"
                  onClick={handleSelfDelegate}
                  disabled={isDelegating}
                  className="w-full"
                >
                  {isDelegating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Delegating...
                    </>
                  ) : (
                    "Delegate to Self"
                  )}
                </Button>
              </div>

              {delegateError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{delegateError}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Delegates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Delegates
            </CardTitle>
            <CardDescription>Most influential delegates in the DAO</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTopDelegates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : topDelegates.length > 0 ? (
              <div className="space-y-4">
                {topDelegates.map((delegate) => (
                  <div
                    key={delegate.address}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex flex-col">
                      <div className="font-medium">
                        {delegate.address === address ? "You" : shortenAddress(delegate.address)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {delegate.delegators} delegator{delegate.delegators !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <div className="font-medium flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          {formatEther(delegate.votingPower)} votes
                        </div>
                      </div>
                      {delegate.address !== address && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDelegateAddress(delegate.address)}
                        >
                          Delegate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <Users className="h-12 w-12 text-muted-foreground mx-auto" />
                <div className="text-muted-foreground">
                  <p className="font-medium">No Top Delegates Yet</p>
                  <p className="text-sm">Be the first to participate in governance!</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleSelfDelegate}
                  className="mt-4"
                >
                  Become a Delegate
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delegation History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Delegation History
            </CardTitle>
            <CardDescription>View your past delegation changes</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : delegationHistory.length > 0 ? (
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                <div className="space-y-4">
                  {delegationHistory.map((event, index) => (
                    <div key={event.transactionHash} className="flex flex-col space-y-2 pb-4 border-b last:border-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            Delegated to: {event.toDelegate === address ? "Self" : shortenAddress(event.toDelegate)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            From: {event.fromDelegate === "0x0000000000000000000000000000000000000000" 
                              ? "None" 
                              : event.fromDelegate === address 
                                ? "Self" 
                                : shortenAddress(event.fromDelegate)}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(event.timestamp * 1000).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-sm">
                        <a
                          href={`https://kalyscan.io/tx/${event.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          View on KalyScan
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No delegation history found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 