import { formatUnits, parseUnits } from 'viem';
import { USDC_DECIMALS, VAULT_SHARES_DECIMALS, BASE_EXPLORER_URL } from './constants';

/**
 * Format USDC amount for display
 */
export function formatUsdcAmount(amount: bigint): string {
  return formatUnits(amount, USDC_DECIMALS);
}

/**
 * Format vault shares amount for display
 */
export function formatVaultShares(shares: bigint): string {
  return formatUnits(shares, VAULT_SHARES_DECIMALS);
}

/**
 * Parse USDC amount from string input
 */
export function parseUsdcAmount(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

/**
 * Parse vault shares from string input
 */
export function parseVaultShares(shares: string): bigint {
  return parseUnits(shares, VAULT_SHARES_DECIMALS);
}

/**
 * Format address for display (truncated)
 */
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Generate transaction explorer URL
 */
export function getTransactionUrl(txHash: string): string {
  return `${BASE_EXPLORER_URL}/tx/${txHash}`;
}

/**
 * Handle hex response that might be empty
 */
export function handleHexResponse(hex: string | null | undefined): bigint {
  if (!hex || hex === '0x' || hex === '0x0') {
    return BigInt(0);
  }
  return BigInt(hex);
}

/**
 * Check if amount is zero
 */
export function isZero(amount: bigint | null): boolean {
  return amount === null || amount === BigInt(0);
}

/**
 * Truncate transaction hash for display
 */
export function truncateHash(hash: string): string {
  return `${hash.substring(0, 10)}...`;
}