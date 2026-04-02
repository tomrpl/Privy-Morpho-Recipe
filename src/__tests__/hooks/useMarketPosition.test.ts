import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMarketPosition } from '@/hooks/useMarketPosition';
import { WAD, INFINITE_HEALTH_FACTOR } from '@/lib/constants';

const mockSendBatchTransaction = vi.fn();
const mockSendSingleTransaction = vi.fn();
const mockReadContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' });

vi.mock('@/context/ChainContext', () => ({
  useChain: vi.fn(() => ({
    selectedChain: {
      id: 8453,
      name: 'Base',
      blockExplorers: { default: { url: 'https://basescan.org' } },
    },
  })),
}));

vi.mock('@/hooks/useSmartAccount', () => ({
  useSmartAccount: vi.fn(() => ({
    sendBatchTransaction: mockSendBatchTransaction,
    sendSingleTransaction: mockSendSingleTransaction,
    address: '0x1234567890abcdef1234567890abcdef12345678',
    isReady: true,
  })),
}));

vi.mock('@/hooks/usePublicClient', () => ({
  usePublicClient: vi.fn(() => ({
    readContract: mockReadContract,
    waitForTransactionReceipt: mockWaitForTransactionReceipt,
  })),
}));

const marketParams = {
  loanToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
  collateralToken: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' as `0x${string}`,
  oracle: '0x' + 'cc'.repeat(20) as `0x${string}`,
  irm: '0x' + 'bb'.repeat(20) as `0x${string}`,
  lltv: (86n * WAD) / 100n,
};

const defaultMarketInfo = {
  marketId: ('0x' + 'a1'.repeat(32)) as `0x${string}`,
  marketParamsArg: marketParams,
  loanToken: marketParams.loanToken,
  collateralToken: marketParams.collateralToken,
  oracleAddress: marketParams.oracle,
  marketLltv: marketParams.lltv,
  loanDecimals: 6,
  collateralDecimals: 8,
  loanSymbol: 'USDC',
  collateralSymbol: 'cbBTC',
  selectedMarketKey: '0x' + 'a1'.repeat(32),
};

describe('useMarketPosition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadContract.mockResolvedValue(0n);
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    expect(result.current.collateralAmount).toBe('');
    expect(result.current.borrowAmount).toBe('');
    expect(result.current.repayAmount).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.position).toBeNull();
    expect(result.current.healthFactor).toBeNull();
  });

  it('fetches balances on mount', async () => {
    mockReadContract.mockResolvedValue(1_000_000n);

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));

    await waitFor(() => {
      expect(mockReadContract).toHaveBeenCalled();
    });
  });

  it('fetchPosition reads position and computes health factor with debt', async () => {
    const collateral = 1n * 10n ** 8n; // 1 cbBTC
    const borrowShares = 50_000n * 10n ** 6n;
    const oraclePrice = 60000n * 10n ** 34n;
    const totalBorrowAssets = 500_000n * 10n ** 6n;
    const totalBorrowShares = 500_000n * 10n ** 6n;

    // Fetch balances (4 calls: 2 balanceOf + 2 allowance), then position, then market+oracle
    mockReadContract
      .mockResolvedValueOnce(5n * 10n ** 7n) // collateral balance
      .mockResolvedValueOnce(100_000n * 10n ** 6n) // loan balance
      .mockResolvedValueOnce(0n) // collateral allowance
      .mockResolvedValueOnce(0n) // loan allowance
      .mockResolvedValueOnce([0n, borrowShares, collateral]) // position
      .mockResolvedValueOnce([0n, 0n, totalBorrowAssets, totalBorrowShares, 0n, 0n]) // market
      .mockResolvedValueOnce(oraclePrice); // oracle

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));

    await waitFor(() => {
      expect(result.current.position).not.toBeNull();
    });

    await waitFor(() => {
      expect(result.current.healthFactor).not.toBeNull();
    });

    expect(result.current.healthFactor!).toBeGreaterThan(WAD);
    expect(result.current.liquidationPrice).not.toBeNull();
    expect(result.current.liquidationPrice!).toBeGreaterThan(0n);
  });

  it('health factor is null when no debt', async () => {
    mockReadContract
      .mockResolvedValueOnce(5n * 10n ** 7n) // collateral balance
      .mockResolvedValueOnce(100_000n * 10n ** 6n) // loan balance
      .mockResolvedValueOnce(0n) // collateral allowance
      .mockResolvedValueOnce(0n) // loan allowance
      .mockResolvedValueOnce([0n, 0n, 1n * 10n ** 8n]); // position with no debt

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));

    await waitFor(() => {
      expect(result.current.position).not.toBeNull();
    });

    expect(result.current.position!.borrowShares).toBe(0n);
    expect(result.current.healthFactor).toBeNull();
  });

  it('handleBorrowExecute with only collateral calls sendBatchTransaction for supply', async () => {
    mockReadContract.mockResolvedValue(10n ** 8n); // balance
    mockSendBatchTransaction.mockResolvedValue({ hash: '0xsupplyhash', wasBatched: false });

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));

    await waitFor(() => expect(mockReadContract).toHaveBeenCalled());

    act(() => {
      result.current.setCollateralAmount('0.1');
      result.current.setBorrowAmount('0'); // no borrow
    });
    await act(async () => {
      await result.current.handleBorrowExecute();
    });

    expect(mockSendBatchTransaction).toHaveBeenCalled();
    expect(result.current.status).toContain('collateral supplied');
  });

  it('handleBorrowExecute with both amounts calls supply & borrow', async () => {
    // Return 0n for allowances so approve step is included
    mockReadContract
      .mockResolvedValueOnce(10n ** 8n) // collateral balance
      .mockResolvedValueOnce(10n ** 8n) // loan balance
      .mockResolvedValueOnce(0n) // collateral allowance = 0 (needs approve)
      .mockResolvedValueOnce(0n) // loan allowance
      .mockResolvedValue(0n); // position etc.
    mockSendBatchTransaction.mockResolvedValue({ hash: '0xbatchhash', wasBatched: true });

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    await waitFor(() => expect(mockReadContract).toHaveBeenCalled());

    act(() => {
      result.current.setCollateralAmount('0.1');
      result.current.setBorrowAmount('100');
    });

    await act(async () => {
      await result.current.handleBorrowExecute();
    });

    expect(mockSendBatchTransaction).toHaveBeenCalled();
    // 3 calls: approve + supplyCollateral + borrow
    expect(mockSendBatchTransaction.mock.calls[0][0]).toHaveLength(3);
  });

  it('handleBorrowExecute with borrow only calls sendSingleTransaction', async () => {
    mockSendSingleTransaction.mockResolvedValue('0xborrowhash');
    mockReadContract.mockResolvedValue(0n);

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));

    act(() => {
      result.current.setCollateralAmount('0');
      result.current.setBorrowAmount('100');
    });
    await act(async () => {
      await result.current.handleBorrowExecute();
    });

    expect(mockSendSingleTransaction).toHaveBeenCalled();
  });

  it('handleRepayExecute calls sendBatchTransaction for repay', async () => {
    mockReadContract.mockResolvedValue(100_000n * 10n ** 6n);
    mockSendBatchTransaction.mockResolvedValue({ hash: '0xrepayhash', wasBatched: false });

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    await waitFor(() => expect(mockReadContract).toHaveBeenCalled());

    act(() => result.current.setRepayAmount('100'));
    await act(async () => {
      await result.current.handleRepayExecute();
    });

    expect(mockSendBatchTransaction).toHaveBeenCalled();
  });

  it('handleRepayAll reads fresh position and repays by shares', async () => {
    const borrowShares = 50_000n * 10n ** 6n;
    const totalBorrowAssets = 500_000n * 10n ** 6n;
    const totalBorrowShares = 500_000n * 10n ** 6n;

    mockReadContract
      .mockResolvedValueOnce(0n) // initial collateral balance
      .mockResolvedValueOnce(0n) // initial loan balance
      .mockResolvedValueOnce(0n) // initial collateral allowance
      .mockResolvedValueOnce(0n) // initial loan allowance
      .mockResolvedValueOnce([0n, 0n, 0n]) // initial position fetch
      .mockResolvedValueOnce([0n, 0n, totalBorrowAssets, totalBorrowShares, 0n, 0n]) // initial market data (always fetched now)
      .mockResolvedValueOnce(60000n * 10n ** 34n) // initial oracle price (always fetched now)
      // handleRepayAll calls:
      .mockResolvedValueOnce([0n, borrowShares, 10n ** 8n]) // fresh position
      .mockResolvedValueOnce([0n, 0n, totalBorrowAssets, totalBorrowShares, 0n, 0n]) // fresh market
      // post-tx fetches
      .mockResolvedValue(0n);

    mockSendBatchTransaction.mockResolvedValue({ hash: '0xrepayallhash', wasBatched: false });

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    await waitFor(() => expect(mockReadContract).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleRepayAll();
    });

    expect(mockSendBatchTransaction).toHaveBeenCalled();
    expect(result.current.status).toContain('All debt repaid');
  });

  it('handleRepayAll with zero borrowShares sets "No debt" status', async () => {
    const totalBorrowAssets = 500_000n * 10n ** 6n;
    const totalBorrowShares = 500_000n * 10n ** 6n;
    mockReadContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n) // collateral allowance
      .mockResolvedValueOnce(0n) // loan allowance
      .mockResolvedValueOnce([0n, 0n, 0n]) // initial position
      .mockResolvedValueOnce([0n, 0n, totalBorrowAssets, totalBorrowShares, 0n, 0n]) // initial market data
      .mockResolvedValueOnce(60000n * 10n ** 34n) // initial oracle price
      .mockResolvedValueOnce([0n, 0n, 10n ** 8n]) // fresh position with 0 borrowShares
      .mockResolvedValueOnce([0n, 0n, 0n, 0n, 0n, 0n]);

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    await waitFor(() => expect(mockReadContract).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleRepayAll();
    });

    expect(result.current.status).toContain('No debt');
  });

  it('exposes simulation and validation results', () => {
    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    expect(result.current.simulation).toBeNull(); // null before data loads
    expect(result.current.borrowValidation).toBeDefined();
    expect(result.current.borrowValidation.isValid).toBe(false); // no amounts entered
    expect(result.current.borrowCtaLabel).toBe('Enter amounts');
    expect(result.current.borrowTxSteps).toEqual([]);
  });

  it('explorerUrl is derived from chain', () => {
    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    expect(result.current.explorerUrl).toBe('https://basescan.org');
  });
});
