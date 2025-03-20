// Gas settings for transactions on KalyChain
export const TRANSACTION_GAS_CONFIG = {
  gas: 300000n, // Reduced gas limit to a more appropriate value
  gasPrice: 1000000000n, // 1 Gwei - adjusted for KalyChain's gas pricing
} as const;

// Helper function to get gas settings for contract interactions
export const getTransactionGasConfig = () => {
  return TRANSACTION_GAS_CONFIG;
};

// Helper function to get gas settings with optional overrides
export const getTransactionGasConfigWithOverrides = (overrides?: Partial<typeof TRANSACTION_GAS_CONFIG>) => {
  return {
    ...TRANSACTION_GAS_CONFIG,
    ...overrides,
  };
}; 