import { createContext } from 'react';
import { GoogleProfilePreview } from '@/services/api/auth.service';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: 'super_admin' | 'admin' | 'student' | 'warden' | string;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  username: string | null;
  profilePhoto?: string;
  room_no?: string | null;
  fees?: number | null;
  hostel?: string | null;
}

export interface AuthActionError extends Error {
  isLocked?: boolean;
  lockMinutes?: number;
  remainingAttempts?: number;
  code?: string;
  requiresMfa?: boolean;
  mfaToken?: string;
  destinationMasked?: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  username?: string;
  phone?: string;
  hostel?: string;
  role?: 'student' | 'admin' | string;
  adminSecret?: string;
}

export interface GoogleSignInResult {
  error: AuthActionError | null;
  user?: User;
  status?: 'active' | 'pending_approval' | 'approved' | 'new_resident' | 'rejected' | string;
  requiresInitialDetails?: boolean;
  canCompleteSetup?: boolean;
  setupToken?: string;
  googleProfile?: GoogleProfilePreview;
  message?: string;
  pendingUser?: Partial<User> & { _id?: string; status?: string };
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPrimaryAdmin: boolean;
  profile: Profile | null;
  features: Record<string, boolean>;
  hasFeature: (featureKey: string) => boolean;
  signIn: (
    identifier: string,
    password: string,
    portalOrIsAdmin?: 'super_admin' | 'admin' | 'student' | boolean
  ) => Promise<{ error: AuthActionError | null; user?: User }>;
  signInWithGoogle: (
    credential: string,
    portal?: 'super_admin' | 'admin' | 'student'
  ) => Promise<GoogleSignInResult>;
  requestGoogleRegistration: (payload: {
    credential: string;
    name?: string;
    phone?: string;
    hostel?: string;
  }) => Promise<{ error: AuthActionError | null; message?: string; status?: string }>;
  completeGoogleSetup: (payload: {
    setupToken: string;
    username: string;
    password: string;
  }) => Promise<{ error: AuthActionError | null; user?: User }>;
  signUp: (payload: SignUpInput) => Promise<{ error: AuthActionError | null; user?: User }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
