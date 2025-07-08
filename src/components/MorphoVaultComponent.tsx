// components/MorphoVaultComponent.tsx
'use client';

import { useState, useEffect } from 'react';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { encodeFunctionData, maxUint256 } from 'viem';

// Constants and utilities
import {
  MORPHO_VAULT_ADDRESS,
  USDC_ADDRESS,
  ERC20_ABI,
  MORPHO_VAULT_ABI,
  BASE_CHAIN_ID,
} from '@/lib/constants';

import {
  formatUsdcAmount,
  formatVaultShares,
  parseUsdcAmount,
  formatAddress,
  getTransactionUrl,
  handleHexResponse,
  isZero,
} from '@/lib/utils';

export default function MorphoVaultComponent() {
  const { wallets } = useWallets();
  const { authenticated, user } = usePrivy();
  const [depositAmount, setDepositAmount] = useState('1'); // Default 1 USDC
  const [status, setStatus] = useState('');
  const [txHash, setTxHash] = useState('');
  const [shares, setShares] = useState<bigint | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sharePriceUsd, setSharePriceUsd] = useState<number | null>(null);
  const [assetPriceUsd, setAssetPriceUsd] = useState<number | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('100'); // Default 100 USD

  // Find the user's wallet - try embedded wallet first, then any connected wallet
  const wallet = wallets.find((w) => w.walletClientType === 'privy') || 
                wallets.find((w) => w.connectorType === 'embedded') || 
                wallets[0]; // Fallback to first available wallet

  // GraphQL query to fetch vault price
  const fetchVaultPrice = async () => {
    try {
      const query = `
        query {
          vaultByAddress(
            address: "${MORPHO_VAULT_ADDRESS}"
            chainId: ${BASE_CHAIN_ID}
          ) {
            address
            state {
              sharePrice
              sharePriceUsd
            }
            asset {
              address
              priceUsd
            }
          }
        }
      `;

      const response = await fetch('https://api.morpho.org/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      
      if (data.data?.vaultByAddress?.state?.sharePriceUsd) {
        setSharePriceUsd(data.data.vaultByAddress.state.sharePriceUsd);
      }
      
      if (data.data?.vaultByAddress?.asset?.priceUsd) {
        setAssetPriceUsd(data.data.vaultByAddress.asset.priceUsd);
      }
    } catch (error) {
      console.error('Failed to fetch vault price:', error);
    }
  };

  useEffect(() => {
    if (wallet) {
      console.log('Wallet found:', wallet);
      console.log('Wallet type:', wallet.walletClientType);
      console.log('Connector type:', wallet.connectorType);
      
      // Auto-fetch data on component mount
      fetchVaultPrice();
      
      // Auto-fetch user balance and shares
      const autoFetchData = async () => {
        try {
          await handleFetchBalance(true); // Silent fetch
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
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Morpho USDC Vault</h3>
          <p className="text-gray-600">Please log in to access the vault.</p>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Morpho USDC Vault</h3>
          <p className="text-gray-600 mb-4">Creating your wallet...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    setIsLoading(true);
    setStatus('Approving...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [MORPHO_VAULT_ADDRESS, maxUint256],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: USDC_ADDRESS, data }],
      });
      setTxHash(hash as string);
      setStatus('Approval transaction sent! Now you can deposit.');
    } catch (error) {
      console.error(error);
      setStatus('Approval failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeposit = async () => {
    setIsLoading(true);
    setStatus('Depositing...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const amount = parseUsdcAmount(depositAmount);

      const data = encodeFunctionData({
        abi: MORPHO_VAULT_ABI,
        functionName: 'deposit',
        args: [amount, wallet.address as `0x${string}`],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: MORPHO_VAULT_ADDRESS, data }],
      });
      setTxHash(hash as string);
      setStatus('Deposit successful!');
    } catch (error) {
      console.error(error);
      setStatus('Deposit failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchBalance = async (silent = false) => {
    setIsLoading(true);
    if (!silent) {
      setStatus('Fetching balance...');
    }
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const balanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          from: wallet.address,
          to: MORPHO_VAULT_ADDRESS,
          data: encodeFunctionData({
            abi: MORPHO_VAULT_ABI,
            functionName: 'balanceOf',
            args: [wallet.address as `0x${string}`],
          }),
        }, 'latest'],
      });
      
      const userShares = handleHexResponse(balanceHex as string);
      setShares(userShares);
      if (!silent) {
        setStatus(`You have ${formatVaultShares(userShares)} vault shares.`);
      }
    } catch (error) {
      console.error(error);
      if (!silent) {
        setStatus('Failed to fetch balance. Make sure you are connected to Base network.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchBalanceClick = () => {
    handleFetchBalance(false);
  };

  const handleWithdrawAll = async () => {
    if (isZero(shares)) {
      setStatus("No shares to withdraw. Check balance first.");
      return;
    }
    setIsLoading(true);
    setStatus('Withdrawing all...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const data = encodeFunctionData({
        abi: MORPHO_VAULT_ABI,
        functionName: 'redeem',
        args: [shares!, wallet.address as `0x${string}`, wallet.address as `0x${string}`],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: MORPHO_VAULT_ADDRESS, data }],
      });
      setTxHash(hash as string);
      setStatus('Full withdrawal successful!');
      setShares(null);
    } catch (error) {
      console.error(error);
      setStatus('Full withdrawal failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawAmount = async () => {
    if (!assetPriceUsd) {
      setStatus("Asset price not available. Please refresh.");
      return;
    }
    
    setIsLoading(true);
    setStatus('Withdrawing amount...');
    setTxHash('');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      // Convert USD amount to USDC amount
      const usdAmount = parseFloat(withdrawAmount);
      const usdcAmount = usdAmount / assetPriceUsd;
      const amount = parseUsdcAmount(usdcAmount.toString());

      const data = encodeFunctionData({
        abi: MORPHO_VAULT_ABI,
        functionName: 'withdraw',
        args: [amount, wallet.address as `0x${string}`, wallet.address as `0x${string}`],
      });

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: MORPHO_VAULT_ADDRESS, data }],
      });
      setTxHash(hash as string);
      setStatus(`Withdrawal of $${withdrawAmount} successful!`);
    } catch (error) {
      console.error(error);
      setStatus('Partial withdrawal failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchUsdcBalance = async () => {
    setIsLoading(true);
    setStatus('Fetching USDC balance...');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const balanceHex = await provider.request({
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
      
      const balance = handleHexResponse(balanceHex as string);
      setUsdcBalance(balance);
      setStatus(`USDC Balance: ${formatUsdcAmount(balance)} USDC`);
    } catch (error) {
      console.error(error);
      setStatus('Failed to fetch USDC balance. Make sure you are connected to Base network.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckAllowance = async () => {
    setIsLoading(true);
    setStatus('Checking allowance...');
    try {
      const provider = await wallet.getEthereumProvider();
      await wallet.switchChain(BASE_CHAIN_ID);

      const allowanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          from: wallet.address,
          to: USDC_ADDRESS,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [wallet.address as `0x${string}`, MORPHO_VAULT_ADDRESS],
          }),
        }, 'latest'],
      });
      
      const allowanceValue = handleHexResponse(allowanceHex as string);
      setAllowance(allowanceValue);
      setStatus(`Allowance: ${formatUsdcAmount(allowanceValue)} USDC`);
    } catch (error) {
      console.error(error);
      setStatus('Failed to check allowance. Make sure you are connected to Base network.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-base font-semibold text-gray-800 mb-2">USDC Vault</h3>
        <p className="text-sm text-gray-500">
          {formatAddress(wallet.address)}
        </p>
        {sharePriceUsd && (
          <div className="bg-blue-50 rounded-lg p-2 mt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-blue-800">
                📊 Share Price: ${sharePriceUsd.toFixed(4)} USD
              </p>
              <button 
                onClick={fetchVaultPrice}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
              >
                ↻
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Balance Information */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <button 
            onClick={handleFetchUsdcBalance}
            disabled={isLoading}
            className="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            USDC
          </button>
          <button 
            onClick={handleCheckAllowance}
            disabled={isLoading}
            className="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            Allowance
          </button>
          <button 
            onClick={handleFetchBalanceClick}
            disabled={isLoading}
            className="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            Shares
          </button>
        </div>
        <div className="space-y-1 text-sm">
          {usdcBalance !== null && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">💰 USDC in wallet</span>
              <div className="text-right">
                <span className="font-medium text-gray-800">{formatUsdcAmount(usdcBalance)}</span>
                {assetPriceUsd && (
                  <div className="text-xs text-green-600 font-semibold">
                    ${(parseFloat(formatUsdcAmount(usdcBalance)) * assetPriceUsd).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          )}
          {allowance !== null && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">✅ Allowance</span>
              <span className="font-medium text-gray-800">
                {allowance >= BigInt("1000000000000000000000000000000") ? 
                  "∞ (Unlimited)" : 
                  formatUsdcAmount(allowance)
                }
              </span>
            </div>
          )}
          {shares !== null && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">🏦 Vault tokens owned</span>
              <div className="text-right">
                <span className="font-medium text-gray-800">{formatVaultShares(shares)}</span>
                {sharePriceUsd && (
                  <div className="text-xs text-green-600 font-semibold">
                    ${(parseFloat(formatVaultShares(shares)) * sharePriceUsd).toFixed(2)} USDC equivalent
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deposit Section */}
      <div className="bg-green-50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">💰 Deposit USDC</h4>
        <div className="mb-3">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount in USDC"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-black text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleApprove}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors text-sm"
          >
            {isLoading ? 'Processing...' : '1. Approve'}
          </button>
          <button 
            onClick={handleDeposit}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
          >
            {isLoading ? 'Processing...' : '2. Deposit'}
          </button>
        </div>
      </div>

      {/* Withdraw Section */}
      <div className="bg-red-50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">💸 Withdraw</h4>
        
        {/* Show helper text when buttons are disabled */}
        {(isZero(shares) || !assetPriceUsd) && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            {isZero(shares) && !assetPriceUsd ? 
              '⚠️ Fetching balance and price data...' :
              isZero(shares) ? 
                '⚠️ No vault shares found. Deposit first or check your balance.' :
                '⚠️ Asset price not available. Please refresh.'
            }
          </div>
        )}
        
        <div className="mb-3">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount in USD"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-black text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleWithdrawAmount}
            disabled={isLoading || isZero(shares) || !assetPriceUsd}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors text-sm"
            title={isZero(shares) ? "Need vault shares to withdraw" : !assetPriceUsd ? "Asset price not available" : "Withdraw specific amount"}
          >
            {isLoading ? 'Processing...' : 'Withdraw Amount'}
          </button>
          <button 
            onClick={handleWithdrawAll} 
            disabled={isLoading || isZero(shares)}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
            title={isZero(shares) ? "Need vault shares to withdraw" : "Withdraw all shares"}
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