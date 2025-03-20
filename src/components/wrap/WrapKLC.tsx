import React, { useState, useEffect } from 'react';
import { useAccount, useBalance, useChainId, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { AlertCircle } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';
import { kalyChainMainnet, kalyChainTestnet } from '@/blockchain/config/chains';
import { getTransactionGasConfig } from '@/blockchain/config/transaction';
import { useBlockWatcher } from '../BlockWatcher';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const governanceTokenABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: []
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  }
] as const;

const WrapKLC = () => {
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Get the correct token address based on current network
  const isTestnet = chainId === kalyChainTestnet.id;
  const governanceTokenAddress = isTestnet
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN;

  // Debug logging for network detection
  useEffect(() => {
    console.log('Network Detection Debug:', {
      currentChainId: chainId,
      testnetChainId: kalyChainTestnet.id,
      mainnetChainId: kalyChainMainnet.id,
      isTestnet,
      selectedAddress: governanceTokenAddress,
      testnetAddress: CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN,
      mainnetAddress: CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN
    });
  }, [chainId, governanceTokenAddress, isTestnet]);

  // Get native KLC balance
  const { data: klcBalance, refetch: refetchKLCBalance } = useBalance({
    address,
  });

  // Get gKLC balance
  const { data: gklcBalance, refetch: refetchGKLCBalance } = useBalance({
    address,
    token: governanceTokenAddress,
  });

  // Set up block watcher to refresh balances
  useBlockWatcher(() => {
    refetchKLCBalance();
    refetchGKLCBalance();
  });

  const { writeContract } = useWriteContract();

  const handleWrap = async () => {
    if (!writeContract || !amount || !address) return;

    setIsProcessing(true);
    setError(null);
    try {
      const gasConfig = getTransactionGasConfig();
      
      console.log('Deposit Transaction Debug:', {
        chainId,
        isTestnet,
        governanceTokenAddress,
        amount,
        address,
        gasConfig,
        value: parseEther(amount).toString()
      });

      // @ts-ignore
      const result = await writeContract({
        address: governanceTokenAddress as `0x${string}`,
        abi: governanceTokenABI,
        functionName: 'deposit',
        value: parseEther(amount),
        args: [],
        ...gasConfig
      });

      console.log('Transaction submitted:', result);
    } catch (error) {
      console.error('Error depositing KLC:', error);
      setError(error instanceof Error ? error.message : 'Failed to deposit KLC. Please try again.');
    } finally {
      setIsProcessing(false);
      setAmount('');
    }
  };

  const handleUnwrap = async () => {
    if (!writeContract || !amount || !address) return;

    setIsProcessing(true);
    setError(null);
    try {
      const gasConfig = getTransactionGasConfig();

      console.log('Withdraw Transaction Debug:', {
        chainId,
        isTestnet,
        governanceTokenAddress,
        amount,
        address,
        gasConfig,
        args: [parseEther(amount).toString()]
      });

      // @ts-ignore
      const result = await writeContract({
        address: governanceTokenAddress as `0x${string}`,
        abi: governanceTokenABI,
        functionName: 'withdraw',
        args: [parseEther(amount)],
        ...gasConfig
      });

      console.log('Transaction submitted:', result);
    } catch (error) {
      console.error('Error withdrawing gKLC:', error);
      setError(error instanceof Error ? error.message : 'Failed to withdraw gKLC. Please try again.');
    } finally {
      setIsProcessing(false);
      setAmount('');
    }
  };

  // Function to handle max button click
  const handleMaxClick = () => {
    if (activeTab === 'deposit') {
      // For deposits, use the KLC balance minus a small amount for gas
      const maxAmount = klcBalance?.value ? 
        formatEther(klcBalance.value - parseEther('0.01')) : '0';
      setAmount(maxAmount);
    } else {
      // For withdraws, use the entire gKLC balance
      const maxAmount = gklcBalance?.value ? 
        formatEther(gklcBalance.value) : '0';
      setAmount(maxAmount);
    }
  };

  if (!isConnected) {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                Wallet Not Connected
              </h3>
              <p className="text-gray-500 mt-2 mb-4">
                Connect your wallet to wrap or unwrap KLC
              </p>
              <ConnectButton />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Wrap/Unwrap KLC</CardTitle>
          <CardDescription>
            Deposit KLC to get gKLC for governance participation, or withdraw your gKLC back to KLC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Available KLC: {klcBalance?.formatted || '0'}</span>
                <span>Available gKLC: {gklcBalance?.formatted || '0'}</span>
              </div>
              <div className="text-sm text-gray-600">
                Network: {isTestnet ? 'Testnet' : 'Mainnet'}
              </div>
            </div>

            <Tabs defaultValue="deposit" onValueChange={(value) => setActiveTab(value as "deposit" | "withdraw")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="deposit">Deposit</TabsTrigger>
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              </TabsList>

              <TabsContent value="deposit" className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="text"
                      pattern="^[0-9]*[.,]?[0-9]*$"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => {
                        // Only allow numbers and decimals
                        if (/^[0-9]*[.,]?[0-9]*$/.test(e.target.value)) {
                          setAmount(e.target.value);
                        }
                      }}
                      className="pr-16" // Add padding for the max button
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2"
                      onClick={handleMaxClick}
                    >
                      MAX
                    </Button>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleWrap}
                    disabled={isProcessing || !amount || Number(amount) <= 0 || Number(amount) > Number(klcBalance?.formatted || 0)}
                  >
                    {isProcessing ? "Processing..." : "Deposit KLC"}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Deposit your KLC to get gKLC at a 1:1 ratio. You can withdraw back to KLC at any time.
                </p>
              </TabsContent>

              <TabsContent value="withdraw" className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="text"
                      pattern="^[0-9]*[.,]?[0-9]*$"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => {
                        // Only allow numbers and decimals
                        if (/^[0-9]*[.,]?[0-9]*$/.test(e.target.value)) {
                          setAmount(e.target.value);
                        }
                      }}
                      className="pr-16" // Add padding for the max button
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2"
                      onClick={handleMaxClick}
                    >
                      MAX
                    </Button>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleUnwrap}
                    disabled={isProcessing || !amount || Number(amount) <= 0 || Number(amount) > Number(gklcBalance?.formatted || 0)}
                  >
                    {isProcessing ? "Processing..." : "Withdraw gKLC"}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Withdraw your gKLC back to KLC at any time. Note that you need gKLC to participate in governance.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WrapKLC; 