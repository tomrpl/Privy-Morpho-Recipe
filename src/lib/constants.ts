import { parseAbi } from 'viem';

// Contract Addresses
export const MORPHO_VAULT_ADDRESS = '0xBeeFa74640a5f7c28966cbA82466EED5609444E0' as const;
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// Chain Configuration
export const BASE_CHAIN_ID = 8453;
export const BASE_EXPLORER_URL = 'https://basescan.org';

// ABIs
export const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
]);

export const MORPHO_VAULT_ABI = parseAbi([
  'function deposit(uint256 assets, address receiver) external returns (uint256 shares)',
  'function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)',
  'function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function totalAssets() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function convertToShares(uint256 assets) external view returns (uint256)',
  'function convertToAssets(uint256 shares) external view returns (uint256)',
]);

// Token Decimals
export const USDC_DECIMALS = 6;
export const VAULT_SHARES_DECIMALS = 18;