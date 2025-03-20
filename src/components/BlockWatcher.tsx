import { useWatchBlockNumber } from 'wagmi';
import { useChainId } from 'wagmi';

export function useBlockWatcher(onBlock?: (blockNumber: bigint) => void) {
  const chainId = useChainId();

  useWatchBlockNumber({
    chainId,
    onBlockNumber: onBlock || ((blockNumber) => {
      console.log('New block:', blockNumber.toString());
    }),
    // Poll every 2 seconds
    pollingInterval: 2000,
  });
}

export default function BlockWatcher() {
  useBlockWatcher();
  return null;
} 