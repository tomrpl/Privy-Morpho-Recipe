import { formatUnits, parseUnits } from 'viem';
import { VAULT_SHARES_DECIMALS } from './constants';

/**
 * Format token amount for display using the token's decimals
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  return formatUnits(amount, decimals);
}

/**
 * Parse token amount from string input using the token's decimals
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}

/**
 * Format vault shares amount for display
 */
export function formatVaultShares(shares: bigint): string {
  return formatUnits(shares, VAULT_SHARES_DECIMALS);
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
export function getExplorerTxUrl(explorerUrl: string, txHash: string): string {
  return `${explorerUrl}/tx/${txHash}`;
}

/**
 * Check if amount is zero
 */
export function isZero(amount: bigint | null): boolean {
  return amount === null || amount === BigInt(0);
}

/**
 * Format USD values with appropriate suffixes (B/M/K)
 */
export function formatUsd(value: number | null | undefined): string {
  if (value == null) return '-';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Format a decimal ratio as a percentage string
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '-';
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Validate a financial input amount string.
 * Returns an error message if invalid, or null if valid.
 */
export function validateAmount(
  input: string,
  decimals: number,
  maxBalance?: bigint,
): string | null {
  if (!input || input.trim() === '') return 'Please enter an amount.';

  const num = Number(input);
  if (isNaN(num)) return 'Please enter a valid number.';
  if (num <= 0) return 'Amount must be greater than zero.';

  const parts = input.split('.');
  if (parts[1] && parts[1].length > decimals) {
    return `Too many decimal places (max ${decimals}).`;
  }

  if (maxBalance !== undefined) {
    try {
      const parsed = parseUnits(input, decimals);
      if (parsed > maxBalance) return 'Amount exceeds your balance.';
    } catch {
      return 'Please enter a valid number.';
    }
  }

  return null;
}
