import { http } from 'viem';
import { createConfig } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { kalyChainMainnet, kalyChainTestnet } from './chains';

// Global polling interval in milliseconds
const GLOBAL_POLLING_INTERVAL = 2000; // 2 seconds

// Create the wagmi config with RainbowKit
export const wagmiConfig = getDefaultConfig({
  appName: 'KalyDAO',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [kalyChainMainnet, kalyChainTestnet],
  transports: {
    [kalyChainMainnet.id]: http(),
    [kalyChainTestnet.id]: http(),
  },
});

// Export the polling interval for use in other parts of the app if needed
export const POLLING_INTERVAL = GLOBAL_POLLING_INTERVAL; 