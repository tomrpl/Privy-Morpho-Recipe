'use client';

import { useMemo } from 'react';
import { createPublicClient, http, type PublicClient } from 'viem';
import { useChain } from '@/context/ChainContext';

const clientCache = new Map<number, PublicClient>();

export function usePublicClient() {
  const { selectedChain } = useChain();

  return useMemo(() => {
    const existing = clientCache.get(selectedChain.id);
    if (existing) return existing;
    const client = createPublicClient({
      chain: selectedChain,
      transport: http(),
    });
    clientCache.set(selectedChain.id, client);
    return client;
  }, [selectedChain]);
}
