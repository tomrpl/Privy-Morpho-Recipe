// app/providers.tsx
'use client';
import { PrivyProvider } from '@privy-io/react-auth';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'your-app-id-here'} // Make sure to set this in your .env.local file
      config={{
        // Customize Privy's appearance, login methods, and embedded wallets
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets', // Create embedded wallets for users who don't have a wallet
        },
        // Configure supported chains
        supportedChains: [
          {
            id: 8453, // Base mainnet
            name: 'Base',
            network: 'base-mainnet',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: {
                http: ['https://mainnet.base.org'],
              },
            },
            blockExplorers: {
              default: {
                name: 'BaseScan',
                url: 'https://basescan.org',
              },
            },
          },
        ],
      }}
    >
      {children}
    </PrivyProvider>
  );
}