# Privy EIP-7702 Smart Account Integration — Findings

## Goal

Integrate Privy's embedded wallet with EIP-7702 smart accounts (via permissionless/Pimlico) so users can batch transactions (e.g. approve + supply to Morpho) in a single UserOperation.

---

## Error 1: "Signing wallet not found"

### What we tried

- Used the `useSignAuthorization` hook from `@privy-io/react-auth` (the older, non-7702-specific hook).
- Called `signAuthorization()` without specifying which wallet to sign with.

### Why it failed

`useSignAuthorization` is a generic hook that doesn't know how to route signing for EIP-7702 authorizations. Privy couldn't resolve which wallet to use for signing, even though the embedded wallet was active.

### Fix

Switched to `useSign7702Authorization` — the dedicated hook Privy provides specifically for EIP-7702 authorization signing. This hook is designed to work with Privy's embedded wallet iframe signing infrastructure.

---

## Error 2: "method [secp256k1_sign] doesn't have corresponding handler"

### What we tried

After switching to `useSign7702Authorization`, we passed a second options argument to force the signing wallet:

```ts
const authorization = await signAuthorization(
  {
    contractAddress: SIMPLE_ACCOUNT_IMPL,
    chainId: selectedChain.id,
  },
  { address: embeddedWallet?.address as Address },
);
```

### Why it failed

Passing `{ address: embeddedWallet?.address }` as the second argument forces Privy to route signing through the wallet's EIP-1193 provider. This provider tries to call `secp256k1_sign` — an RPC method that is **not supported client-side** by Privy's embedded wallet iframe. The embedded wallet signs via Privy's iframe-based infrastructure, not through raw EIP-1193 RPC methods.

### Fix (final, working)

Removed the `{ address }` option entirely and added the `nonce` parameter — matching the official Privy EIP-7702 recipe at `docs.privy.io/recipes/react/eip-7702`:

```ts
const authorization = await signAuthorization({
  contractAddress: SIMPLE_ACCOUNT_IMPL,
  chainId: selectedChain.id,
  nonce: await publicClient.getTransactionCount({
    address: walletClient.account.address,
  }),
});
```

Without the `{ address }` option, `useSign7702Authorization` automatically finds the first available wallet (which is the embedded wallet we set as active via `setActiveWallet`) and signs through Privy's iframe — the supported path.

---

## Other fixes applied alongside

### Missing `client: publicClient` in `createSmartAccountClient`

The official Privy recipe passes `client: publicClient` to `createSmartAccountClient`. Our code omitted it. While not the direct cause of the signing errors, this aligns our setup with the reference implementation and may prevent subtle issues with account resolution.

### Missing `nonce` in `signAuthorization`

The Privy recipe explicitly fetches the nonce via `publicClient.getTransactionCount()` and passes it. Without it, the authorization may use a stale or incorrect nonce, causing on-chain failures even if signing succeeds.

---

## Key takeaways

1. **Never pass `{ address }` to `useSign7702Authorization`** — it bypasses Privy's iframe signing and hits an unsupported EIP-1193 code path (`secp256k1_sign`).
2. **Use `useSign7702Authorization`, not `useSignAuthorization`** — the generic hook doesn't handle EIP-7702 correctly.
3. **Always pass `nonce`** to `signAuthorization` — fetch it from `publicClient.getTransactionCount()`.
4. **Follow the official Privy recipe closely** — `docs.privy.io/recipes/react/eip-7702` is the source of truth. Deviations cause subtle signing-infrastructure misrouting.

---

## Reference versions

- `@privy-io/react-auth@2.17.3`
- `permissionless@0.2.57`
- `viem` (latest compatible)
- Reference: `docs.privy.io/recipes/react/eip-7702`
