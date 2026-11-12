import { useContext } from 'react';
import { AuthContext } from '@/contexts/authContextInstance';

export type { User, Profile, AuthActionError, SignUpInput, GoogleSignInResult, AuthContextType } from '@/contexts/authContextInstance';

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

