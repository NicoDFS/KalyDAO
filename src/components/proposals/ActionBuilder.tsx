import React, { useState, useEffect } from 'react';
import { encodeFunctionData, parseEther } from 'viem';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';
import { useChainId } from 'wagmi';
import { ethers } from 'ethers'; // Keep for formatEther

// Update the ABI to use sendNativeToken instead of transfer
const treasuryVaultAbi = [
  {
    inputs: [
      { internalType: 'address payable', name: 'recipient', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'sendNativeToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface ActionBuilderProps {
  // Field object from react-hook-form render prop for calldata
  // Contains value, onChange, onBlur, name, ref
  field: {
    onChange: (value: `0x${string}`) => void;
    value: `0x${string}` | string; // Current calldata value
    name: string;
    // other RHF field props if needed
  };
  // We also need the index to potentially sync target/value later
  actionIndex: number;
  // Function to update the main form's target/value for this action
  updateActionFields: (index: number, updates: { target?: string; value?: string }) => void;
}

type ActionType = 'transfer' | 'custom';

export const ActionBuilder: React.FC<ActionBuilderProps> = ({ field, actionIndex, updateActionFields }) => {
  const [actionType, setActionType] = useState<ActionType>('custom');
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>(''); // Store amount as KLC string
  const chainId = useChainId();

  const treasuryVaultAddress = chainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.TREASURY_VAULT
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.TREASURY_VAULT;

  // Effect to generate calldata when transfer params change
  useEffect(() => {
    if (actionType === 'transfer') {
      try {
        // Validate inputs before encoding
        if (/^0x[a-fA-F0-9]{40}$/.test(recipient) && amount && parseFloat(amount) >= 0 && treasuryVaultAddress) {
          const amountInWei = parseEther(amount);
          const calldata = encodeFunctionData({
            abi: treasuryVaultAbi,
            functionName: 'sendNativeToken',
            args: [recipient as `0x${string}`, amountInWei],
          });
          field.onChange(calldata); // Update the form field

          // Also update the target and value for this action in the main form
          updateActionFields(actionIndex, {
            target: treasuryVaultAddress, // Target is the vault
            value: '0',                   // Value is 0 as we're using calldata
          });

        } else {
          field.onChange('0x');
        }
      } catch (error) {
        console.error("Error encoding transfer data:", error);
        field.onChange('0x');
      }
    }
  }, [actionType, recipient, amount, field.onChange, actionIndex, updateActionFields, treasuryVaultAddress]);

  // Effect to reset transfer fields if switching away from 'transfer'
  useEffect(() => {
      if (actionType !== 'transfer') {
          setRecipient('');
          setAmount('');
          // Optional: Revert target/value if they were set by the builder?
          // updateActionFields(actionIndex, { target: '', value: '0' });
      }
  }, [actionType, actionIndex, updateActionFields]);


  const handleActionTypeChange = (value: string) => {
    const newActionType = value as ActionType;
    setActionType(newActionType);
    if (newActionType === 'custom') {
      // Reset calldata when switching to custom, keep existing if user typed manually
      // field.onChange('0x');
    } else if (newActionType === 'transfer') {
        // Trigger useEffect to generate calldata and update target/value
    }
  };

  return (
    <div className="space-y-3">
      <Label htmlFor={`${field.name}-action-type`}>Action Type</Label>
      <Select onValueChange={handleActionTypeChange} defaultValue={actionType}>
        <SelectTrigger id={`${field.name}-action-type`}>
          <SelectValue placeholder="Select action type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="custom">Custom Calldata</SelectItem>
          <SelectItem value="transfer">Transfer KLC (Native Token)</SelectItem>
          {/* Add more action types here later */}
        </SelectContent>
      </Select>

      {actionType === 'transfer' && (
        <Card className="p-4 bg-muted/40">
          <CardContent className="space-y-3 pt-4">
             <p className="text-sm text-muted-foreground mb-2">
               This will create a proposal action to transfer native KLC tokens from the Treasury Vault ({treasuryVaultAddress ? `${treasuryVaultAddress.substring(0,6)}...${treasuryVaultAddress.substring(38)}` : 'N/A'}).
             </p>
            <div>
              <Label htmlFor={`${field.name}-recipient`}>Recipient Address</Label>
              <Input
                id={`${field.name}-recipient`}
                placeholder="0x... address to receive KLC"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              {recipient && !/^0x[a-fA-F0-9]{40}$/.test(recipient) && (
                 <p className="text-xs text-red-500 mt-1">Invalid address format.</p>
              )}
            </div>
            <div>
              <Label htmlFor={`${field.name}-amount`}>Amount (in KLC)</Label>
              <Input
                id={`${field.name}-amount`}
                type="number"
                placeholder="e.g., 1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.000000000000000001" // Allow for wei precision
              />
              {amount && parseFloat(amount) < 0 && (
                  <p className="text-xs text-red-500 mt-1">Amount cannot be negative.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {actionType === 'custom' && (
         <div>
            <Label htmlFor={field.name}>Calldata</Label>
             <Textarea
                id={field.name}
                placeholder="0x... encoded function call data"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value as `0x${string}`)} // Update form state directly
                rows={3}
                className="font-mono text-xs"
             />
             <p className="text-xs text-muted-foreground mt-1">
               Manually specify the hex data for the function call.
             </p>
             {field.value && !/^0x[a-fA-F0-9]*$/.test(field.value) && (
                 <p className="text-xs text-red-500 mt-1">Calldata must be a valid hex string (0x...).</p>
             )}
         </div>
      )}

        {/* Optionally display the generated calldata */}
        {actionType === 'transfer' && field.value && field.value !== '0x' && (
            <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground">Generated Calldata:</p>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">{field.value}</pre>
            </div>
        )}
    </div>
  );
};

export default ActionBuilder; 