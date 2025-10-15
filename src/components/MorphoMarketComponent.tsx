// components/MorphoMarketComponent.tsx
'use client';

import { useState, useEffect } from 'react';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { encodeFunctionData, maxUint256, decodeFunctionResult } from 'viem';

// Constants and utilities
import {
  MORPHO_CORE_ADDRESS,
  USDC_ADDRESS,
  WETH_ADDRESS,
  ERC20_ABI,
  MORPHO_CORE_ABI,
  BASE_CHAIN_ID,
  MARKET_PARAMS,
  MORPHO_MARKET_ID,
} from '@/lib/constants';

import {
  formatUsdcAmount,
  formatEthAmount,
  parseUsdcAmount,
  parseEthAmount,
  formatAddress,
  getTransactionUrl,
  handleHexResponse,
  isZero,
} from '@/lib/utils';

export default function MorphoMarketComponent() {
  const { wallets } = useWallets();
  const { authenticated, user } = usePrivy();
  const [collateralAmount, setCollateralAmount] = useState('0.1'); // Default 0.1 ETH
  const [borrowAmount, setBorrowAmount] = useState('100'); // Default 100 USDC
  const [repayAmount, setRepayAmount] = useState('100'); // Default 100 USDC
  const [withdrawAmount, setWithdrawAmount] = useState('0.05'); // Default 0.05 ETH
  const [status, setStatus] = useState('');
  const [txHash, setTxHash] = useState('');
  const [wethBalance, setWethBalance] = useState<bigint | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [usdcAllowance, setUsdcAllowance] = useState<bigint | null>(null);
  const [wethAllowance, setWethAllowance] = useState<bigint | null>(null);
  const [position, setPosition] = useState<{
    supplyShares: bigint;
    borrowShares: bigint;
    collateral: bigint;
  } | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Find the user's wallet
  const wallet = wallets.find((w) => w.walletClientType === 'privy') || 
                wallets.find((w) => w.connectorType === 'embedded') || 
                wallets[0];

  useEffect(() => {
    if (wallet) {
      console.log('Wallet found for Market component:', wallet);
      
      // Auto-fetch data on component mount
      const autoFetchData = async () => {
        try {
          await handleFetchBalances(true); // Silent fetch
          await handleFetchPosition(true); // Silent fetch
        } catch (error) {
          console.error('Auto-fetch failed:', error);
        }
      };
      
      autoFetchData();
    }
  }, [wallet]);

  if (!authenticated || !user) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Morpho ETH/USDC Market</h3>
          <p className="text-gray-600">Please log in to access the market.</p>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Morpho ETH/USDC Market</h3>
          <p className="text-gray-600 mb-4">Creating your wallet...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  const handleFetchBalances = async (silent = false) => {
    setIsLoading(true);
    if (!silent) {
      setStatus('Fetching balances...');
    }
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      // Get WETH balance
      const wethBalanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          from: wallet.address,
          to: WETH_ADDRESS,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [wallet.address as `0x${string}`],
          }),
        }, 'latest'],
      });
      const wethBal = handleHexResponse(wethBalanceHex as string);
      setWethBalance(wethBal);

      // Get USDC balance
      const usdcBalanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          from: wallet.address,
          to: USDC_ADDRESS,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [wallet.address as `0x${string}`],
          }),
        }, 'latest'],
      });
      const usdcBal = handleHexResponse(usdcBalanceHex as string);
      setUsdcBalance(usdcBal);

      // Get USDC allowance for Morpho Core
      const usdcAllowanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          from: wallet.address,
          to: USDC_ADDRESS,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [wallet.address as `0x${string}`, MORPHO_CORE_ADDRESS],
          }),
        }, 'latest'],
      });
      const usdcAllowance = handleHexResponse(usdcAllowanceHex as string);
      setUsdcAllowance(usdcAllowance);

      // Get WETH allowance for Morpho Core
      const wethAllowanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          from: wallet.address,
          to: WETH_ADDRESS,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [wallet.address as `0x${string}`, MORPHO_CORE_ADDRESS],
          }),
        }, 'latest'],
      });
      const wethAllowance = handleHexResponse(wethAllowanceHex as string);
      setWethAllowance(wethAllowance);

      if (!silent) {
        setStatus(`WETH: ${formatEthAmount(wethBal)}, USDC: ${formatUsdcAmount(usdcBal)}`);
      }
    } catch (error) {
      console.error(error);
      if (!silent) {
        setStatus('Failed to fetch balances. Make sure you are connected to Base network.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchPosition = async (silent = false) => {
    setIsLoading(true);
    if (!silent) {
      setStatus('Fetching position...');
    }
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      console.log('Fetching position for market ID:', MORPHO_MARKET_ID);
      console.log('User address:', wallet.address);

      // Get position using marketId instead of marketParams
      const positionHex = await provider.request({
        method: 'eth_call',
        params: [{
          from: wallet.address,
          to: MORPHO_CORE_ADDRESS,
          data: encodeFunctionData({
            abi: MORPHO_CORE_ABI,
            functionName: 'position',
            args: [MORPHO_MARKET_ID as `0x${string}`, wallet.address as `0x${string}`],
          }),
        }, 'latest'],
      });

      // Decode the position response using proper ABI decoding
      const positionData = positionHex as string;
      console.log('Raw position response:', positionData);
      
      if (positionData && positionData !== '0x' && positionData.length > 2) {
        const decodedPosition = decodeFunctionResult({
          abi: MORPHO_CORE_ABI,
          functionName: 'position',
          data: positionData as `0x${string}`,
        });
        
        // decodedPosition is a tuple [supplyShares(uint256), borrowShares(uint128), collateral(uint128)]
        const [supplyShares, borrowShares, collateral] = decodedPosition as [bigint, bigint, bigint];
        
        setPosition({ supplyShares, borrowShares, collateral });
        
        console.log('Position data:', {
          supplyShares: supplyShares.toString(),
          borrowShares: borrowShares.toString(),
          collateral: collateral.toString()
        });

        // Check if position is healthy - using marketParams for health check
        const marketParams = [
          MARKET_PARAMS.loanToken,
          MARKET_PARAMS.collateralToken,
          MARKET_PARAMS.oracle,
          MARKET_PARAMS.irm,
          MARKET_PARAMS.lltv,
        ];
        
        const healthyHex = await provider.request({
          method: 'eth_call',
          params: [{
            from: wallet.address,
            to: MORPHO_CORE_ADDRESS,
            data: encodeFunctionData({
              abi: MORPHO_CORE_ABI,
              functionName: 'isHealthy',
              args: [marketParams as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint], wallet.address as `0x${string}`],
            }),
          }, 'latest'],
        });
        
        // Decode the boolean result
        const decodedHealth = decodeFunctionResult({
          abi: MORPHO_CORE_ABI,
          functionName: 'isHealthy',
          data: healthyHex as `0x${string}`,
        });
        
        const healthy = decodedHealth as boolean;
        setIsHealthy(healthy);
        
        console.log('Health status:', healthy);

        if (!silent) {
          setStatus(`Collateral: ${formatEthAmount(collateral)} WETH, Borrows: ${formatEthAmount(borrowShares)} shares, Health: ${healthy ? 'Good' : 'At Risk'}`);
        }
      } else {
        // No position data found - set empty position
        setPosition({ supplyShares: BigInt(0), borrowShares: BigInt(0), collateral: BigInt(0) });
        setIsHealthy(true); // No position means healthy by default
        if (!silent) {
          setStatus('No active position found.');
        }
      }
    } catch (error) {
      console.error(error);
      if (!silent) {
        setStatus('Failed to fetch position.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveWeth = async () => {
    setIsLoading(true);
    setStatus('Approving WETH...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [MORPHO_CORE_ADDRESS, maxUint256],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: WETH_ADDRESS, data }],
      });
      setTxHash(hash as string);
      setStatus('WETH approval transaction sent!');
    } catch (error) {
      console.error(error);
      setStatus('WETH approval failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveUsdc = async () => {
    setIsLoading(true);
    setStatus('Approving USDC for repayment...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [MORPHO_CORE_ADDRESS, maxUint256],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: USDC_ADDRESS, data }],
      });
      setTxHash(hash as string);
      setStatus('USDC approval transaction sent!');
    } catch (error) {
      console.error(error);
      setStatus('USDC approval failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupplyCollateral = async () => {
    setIsLoading(true);
    setStatus('Supplying WETH collateral...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const amount = parseEthAmount(collateralAmount);
      const marketParams = [
        MARKET_PARAMS.loanToken,
        MARKET_PARAMS.collateralToken,
        MARKET_PARAMS.oracle,
        MARKET_PARAMS.irm,
        MARKET_PARAMS.lltv,
      ];

      const data = encodeFunctionData({
        abi: MORPHO_CORE_ABI,
        functionName: 'supplyCollateral',
        args: [marketParams as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint], amount, wallet.address as `0x${string}`, '0x'],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ 
          from: wallet.address, 
          to: MORPHO_CORE_ADDRESS, 
          data,
          // Remove ETH value since we're transferring WETH (ERC20)
        }],
      });
      setTxHash(hash as string);
      setStatus('WETH collateral supplied successfully!');
    } catch (error) {
      console.error(error);
      setStatus('Collateral supply failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBorrowUsdc = async () => {
    setIsLoading(true);
    setStatus('Borrowing USDC...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const amount = parseUsdcAmount(borrowAmount);
      const marketParams = [
        MARKET_PARAMS.loanToken,
        MARKET_PARAMS.collateralToken,
        MARKET_PARAMS.oracle,
        MARKET_PARAMS.irm,
        MARKET_PARAMS.lltv,
      ];

      const data = encodeFunctionData({
        abi: MORPHO_CORE_ABI,
        functionName: 'borrow',
        args: [marketParams as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint], amount, BigInt(0), wallet.address as `0x${string}`, wallet.address as `0x${string}`],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: MORPHO_CORE_ADDRESS, data }],
      });
      setTxHash(hash as string);
      setStatus('USDC borrowed successfully!');
    } catch (error) {
      console.error(error);
      setStatus('Borrow failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepayUsdc = async () => {
    setIsLoading(true);
    setStatus('Repaying USDC...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const amount = parseUsdcAmount(repayAmount);
      const marketParams = [
        MARKET_PARAMS.loanToken,
        MARKET_PARAMS.collateralToken,
        MARKET_PARAMS.oracle,
        MARKET_PARAMS.irm,
        MARKET_PARAMS.lltv,
      ];

      const data = encodeFunctionData({
        abi: MORPHO_CORE_ABI,
        functionName: 'repay',
        args: [marketParams as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint], amount, BigInt(0), wallet.address as `0x${string}`, '0x'],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: MORPHO_CORE_ADDRESS, data }],
      });
      setTxHash(hash as string);
      setStatus('USDC repaid successfully!');
    } catch (error) {
      console.error(error);
      setStatus('Repay failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawCollateralAmount = async () => {
    setIsLoading(true);
    setStatus('Withdrawing WETH collateral...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const amount = parseEthAmount(withdrawAmount);
      const marketParams = [
        MARKET_PARAMS.loanToken,
        MARKET_PARAMS.collateralToken,
        MARKET_PARAMS.oracle,
        MARKET_PARAMS.irm,
        MARKET_PARAMS.lltv,
      ];

      const data = encodeFunctionData({
        abi: MORPHO_CORE_ABI,
        functionName: 'withdrawCollateral',
        args: [marketParams as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint], amount, wallet.address as `0x${string}`, wallet.address as `0x${string}`],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: MORPHO_CORE_ADDRESS, data }],
      });
      setTxHash(hash as string);
      setStatus(`${withdrawAmount} WETH collateral withdrawn successfully!`);
    } catch (error) {
      console.error(error);
      setStatus('Collateral withdrawal failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawAllCollateral = async () => {
    if (!position || isZero(position.collateral)) {
      setStatus("No collateral to withdraw.");
      return;
    }
    
    setIsLoading(true);
    setStatus('Withdrawing all WETH collateral...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const marketParams = [
        MARKET_PARAMS.loanToken,
        MARKET_PARAMS.collateralToken,
        MARKET_PARAMS.oracle,
        MARKET_PARAMS.irm,
        MARKET_PARAMS.lltv,
      ];

      const data = encodeFunctionData({
        abi: MORPHO_CORE_ABI,
        functionName: 'withdrawCollateral',
        args: [marketParams as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint], position.collateral, wallet.address as `0x${string}`, wallet.address as `0x${string}`],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: MORPHO_CORE_ADDRESS, data }],
      });
      setTxHash(hash as string);
      setStatus('All WETH collateral withdrawn successfully!');
      setPosition(null);
    } catch (error) {
      console.error(error);
      setStatus('Collateral withdrawal failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-base font-semibold text-gray-800 mb-2">ETH/USDC Lending Market</h3>
        <p className="text-sm text-gray-500">
          {formatAddress(wallet.address)}
        </p>
        <div className="bg-purple-50 rounded-lg p-2 mt-2">
          <p className="text-sm font-medium text-purple-800">
            📈 Market: Supply WETH, Borrow USDC (86% LTV)
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mt-2">
          <p className="text-xs text-yellow-800">
            ⚠️ <strong>Note:</strong> This market uses WETH as collateral. Make sure you have WETH tokens and approve WETH spending.
          </p>
        </div>
      </div>
      
      {/* Balance Information */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button 
            onClick={() => handleFetchBalances(false)}
            disabled={isLoading}
            className="px-3 py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            Balances
          </button>
          <button 
            onClick={() => handleFetchPosition(false)}
            disabled={isLoading}
            className="px-3 py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            Position
          </button>
        </div>
        <div className="space-y-1 text-sm">
          {wethBalance !== null && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">⚡ WETH Balance</span>
              <span className="font-medium text-gray-800">{formatEthAmount(wethBalance)}</span>
            </div>
          )}
          {usdcBalance !== null && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">💰 USDC Balance</span>
              <span className="font-medium text-gray-800">{formatUsdcAmount(usdcBalance)}</span>
            </div>
          )}
          {usdcAllowance !== null && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">✅ USDC Allowance</span>
              <span className="font-medium text-gray-800">
                {usdcAllowance >= BigInt("1000000000000000000000000000000") ? 
                  "∞ (Unlimited)" : 
                  formatUsdcAmount(usdcAllowance)
                }
              </span>
            </div>
          )}
          {wethAllowance !== null && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">⚡ WETH Allowance</span>
              <span className="font-medium text-gray-800">
                {wethAllowance >= BigInt("1000000000000000000000000000000") ? 
                  "∞ (Unlimited)" : 
                  formatEthAmount(wethAllowance)
                }
              </span>
            </div>
          )}
          {position ? (
            <>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">🏦 WETH Collateral</span>
                <span className="font-medium text-gray-800">
                  {formatEthAmount(position.collateral)} WETH
                  {!isZero(position.collateral) && <span className="text-xs text-green-600 ml-1">✓</span>}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">📈 Supply Shares</span>
                <span className="font-medium text-gray-800">{formatEthAmount(position.supplyShares)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">💰 Borrow Shares</span>
                <span className="font-medium text-gray-800">
                  {formatEthAmount(position.borrowShares)}
                  {!isZero(position.borrowShares) && <span className="text-xs text-orange-600 ml-1">⚠</span>}
                </span>
              </div>
              {isHealthy !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">❤️ Health Status</span>
                  <span className={`font-medium ${isHealthy ? 'text-green-600' : 'text-red-600'}`}>
                    {isHealthy ? 'Healthy ✓' : 'At Risk ⚠'}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">📋 Position Status</span>
              <span className="font-medium text-gray-500">No position data loaded</span>
            </div>
          )}
        </div>
      </div>

      {/* Supply Collateral Section */}
      <div className="bg-blue-50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">⚡ Supply WETH Collateral</h4>
        <div className="mb-3">
          <input
            type="number"
            value={collateralAmount}
            onChange={(e) => setCollateralAmount(e.target.value)}
            placeholder="Amount in WETH"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleApproveWeth}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors text-sm"
          >
            {isLoading ? 'Processing...' : '1. Approve WETH'}
          </button>
          <button 
            onClick={handleSupplyCollateral}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
          >
            {isLoading ? 'Processing...' : '2. Supply WETH'}
          </button>
        </div>
      </div>

      {/* Borrow Section */}
      <div className="bg-green-50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">💰 Borrow USDC</h4>
        <div className="mb-3">
          <input
            type="number"
            value={borrowAmount}
            onChange={(e) => setBorrowAmount(e.target.value)}
            placeholder="Amount in USDC"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-black text-sm"
          />
        </div>
        <button 
          onClick={handleBorrowUsdc}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
        >
          {isLoading ? 'Processing...' : 'Borrow USDC'}
        </button>
      </div>

      {/* Repay Section */}
      <div className="bg-orange-50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">💸 Repay USDC</h4>
        <div className="mb-3">
          <input
            type="number"
            value={repayAmount}
            onChange={(e) => setRepayAmount(e.target.value)}
            placeholder="Amount in USDC"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-black text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleApproveUsdc}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 transition-colors text-sm"
          >
            {isLoading ? 'Processing...' : '1. Approve USDC'}
          </button>
          <button 
            onClick={handleRepayUsdc}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 transition-colors text-sm"
          >
            {isLoading ? 'Processing...' : '2. Repay USDC'}
          </button>
        </div>
      </div>

      {/* Withdraw Collateral Section */}
      <div className="bg-red-50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">⚡ Withdraw WETH Collateral</h4>
        
        {/* Show helper text when no collateral */}
        {(!position || isZero(position.collateral)) && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            ⚠️ No WETH collateral found. Supply collateral first.
          </div>
        )}
        
        <div className="mb-3">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount in WETH"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-black text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleWithdrawCollateralAmount}
            disabled={isLoading || !position || isZero(position.collateral)}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors text-sm"
            title={!position || isZero(position.collateral) ? "No collateral to withdraw" : "Withdraw specific amount"}
          >
            {isLoading ? 'Processing...' : 'Withdraw Amount'}
          </button>
          <button 
            onClick={handleWithdrawAllCollateral}
            disabled={isLoading || !position || isZero(position.collateral)}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
            title={!position || isZero(position.collateral) ? "No collateral to withdraw" : "Withdraw all WETH collateral"}
          >
            {isLoading ? 'Processing...' : 'Withdraw All'}
          </button>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700">
            Status: <span className="font-normal">{status}</span>
          </p>
          {txHash && (
            <p className="text-sm mt-2">
              <a 
                href={getTransactionUrl(txHash)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View Transaction →
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}