import { parseAbi } from 'viem';

// Contract Addresses
export const MORPHO_VAULT_ADDRESS = '0xBeeFa74640a5f7c28966cbA82466EED5609444E0' as const;
export const MORPHO_CORE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const;
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
export const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const;

// Morpho Market Configuration
export const MORPHO_MARKET_ID = '0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda' as const;

// Market Parameters for ETH/USDC market
export const MARKET_PARAMS = {
  loanToken: USDC_ADDRESS,
  collateralToken: WETH_ADDRESS,
  oracle: '0xFEa2D58cEfCb9fcb597723c6bAE66fFE4193aFE4' as const,
  irm: '0x46415998764C29aB2a25CbeA6254146D50D22687' as const,
  lltv: BigInt('860000000000000000'), // 86% LLTV (Loan-to-Value)
} as const;

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

export const MORPHO_CORE_ABI = parseAbi([
  'struct MarketParams { address loanToken; address collateralToken; address oracle; address irm; uint256 lltv; }',
  'function supply((address,address,address,address,uint256) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes calldata data) external returns (uint256, uint256)',
  'function withdraw((address,address,address,address,uint256) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256)',
  'function borrow((address,address,address,address,uint256) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256)',
  'function repay((address,address,address,address,uint256) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes calldata data) external returns (uint256, uint256)',
  'function supplyCollateral((address,address,address,address,uint256) marketParams, uint256 assets, address onBehalf, bytes calldata data) external',
  'function withdrawCollateral((address,address,address,address,uint256) marketParams, uint256 assets, address onBehalf, address receiver) external',
  'function position(bytes32 marketId, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)',
  'function market((address,address,address,address,uint256) marketParams) external view returns (uint256 totalSupplyAssets, uint256 totalSupplyShares, uint256 totalBorrowAssets, uint256 totalBorrowShares, uint256 lastUpdate, uint256 fee)',
  'function isHealthy(bytes32 marketId, address user) external view returns (bool)',
]);

// Token Decimals
export const USDC_DECIMALS = 6;
export const VAULT_SHARES_DECIMALS = 18;
export const ETH_DECIMALS = 18;
