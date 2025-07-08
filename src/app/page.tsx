'use client';

import { usePrivy } from '@privy-io/react-auth';
import Image from 'next/image';
import MorphoVaultComponent from '../components/MorphoVaultComponent';

export default function Home() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-4">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="bg-[#2973FF] rounded-xl p-6 mb-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-6">
              <Image 
                src="/privy-logo-dark.png" 
                alt="Privy Logo" 
                width={120}
                height={40}
                className="h-10 w-auto"
              />
              <span className="text-white text-2xl ">×</span>
              <Image 
                src="/Morpho.svg" 
                alt="Morpho Logo" 
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </div>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          One-click yield, secured by Privy, powered by Morpho.
          </p>
          <div className="flex justify-center items-center mt-6 gap-4">
            
            {ready && (
              <div>
                {authenticated ? (
                  <button 
                    onClick={logout}
                    className="bg-[#2973FF] text-white px-4 py-2 rounded-xl transition-colors whitespace-nowrap hover:bg-[#5792FF]"
                    style={{ width: '110px' }}
                  >
                    Log Out
                  </button>
                ) : (
                  <button 
                    onClick={login}
                    className="bg-[#2973FF] text-white px-4 py-2 rounded-xl transition-colors whitespace-nowrap hover:bg-[#5792FF]"
                    style={{ width: '100px' }}
                  >
                    Log In
                  </button>
                )}
              </div>
            )}
          </div>
        </div>



        {/* Main Content */}
        {authenticated && user && (
          <div className="max-w-4xl mx-auto">
            
            <MorphoVaultComponent />
          </div>
        )}

        {!authenticated && (
          <div className="text-center max-w-md mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Get Started</h2>
              <p className="text-gray-600 mb-6">
                Connect your wallet to start earning yield on your USDC
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p className="font-medium mb-2">What you&apos;ll need:</p>
                <ul className="space-y-1">
                  <li>• USDC on Base network</li>
                  <li>• A few clicks to start earning</li>
                                     <li>• That&apos;s it! 🚀</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">📚 Educational Example:</span> This is a demo application for learning purposes. 
              Always exercise caution when interacting with real smart contracts and funds.
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Need help? Check out the documentations:
            </p>
            <div className="flex justify-center gap-6">
              <a 
                href="https://docs.privy.io/basics/get-started/about" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline text-sm"
              >
                Privy Documentation
              </a>
              <span className="text-gray-300">•</span>
              <a 
                href="https://docs.morpho.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline text-sm"
              >
                Morpho Documentation
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
