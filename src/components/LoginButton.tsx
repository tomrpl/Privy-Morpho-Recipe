// components/LoginButton.tsx
'use client';
import { usePrivy } from '@privy-io/react-auth';

export default function LoginButton() {
  const { ready, authenticated, login, logout } = usePrivy();

  // Wait for the Privy SDK to be ready
  if (!ready) {
    return null;
  }

  return (
    <div>
      {authenticated ? (
        <button onClick={logout}>Log Out</button>
      ) : (
        <button onClick={login}>Log In</button>
      )}
    </div>
  );
}