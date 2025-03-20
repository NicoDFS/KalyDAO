import { Contract } from 'ethers';
import GovernanceTokenABI from '../abis/GovernanceToken.json';
import GovernorContractABI from '../abis/GovernorContract.json';
import TimeLockABI from '../abis/TimeLock.json';
import TreasuryVaultABI from '../abis/TreasuryVault.json';

// Export types generated from our ABIs
export type GovernanceTokenContract = Contract & typeof GovernanceTokenABI;
export type GovernorContract = Contract & typeof GovernorContractABI;
export type TimeLockContract = Contract & typeof TimeLockABI;
export type TreasuryVaultContract = Contract & typeof TreasuryVaultABI;
