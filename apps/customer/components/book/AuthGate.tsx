'use client';
/**
 * AuthGate — step shown when guest hits /book unauthenticated.
 * Offers three paths: sign in, create account, continue as guest.
 * Extracted from BookPageClient.tsx.
 */
import { Button } from '@/components/ui/button';

interface AuthGateProps {
  onLogin:    () => void;
  onRegister: () => void;
  onGuest:    () => void;
}

export function AuthGate({ onLogin, onRegister, onGuest }: AuthGateProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[hsl(var(--muted-foreground))] text-center pb-2">
        To complete your booking, please sign in or continue as guest.
      </p>
      <Button size="lg" className="w-full" onClick={onLogin}>Sign In</Button>
      <Button size="lg" variant="secondary" className="w-full" onClick={onRegister}>Create Account</Button>
      <Button size="lg" variant="outline" className="w-full" onClick={onGuest}>Continue as Guest</Button>
    </div>
  );
}
