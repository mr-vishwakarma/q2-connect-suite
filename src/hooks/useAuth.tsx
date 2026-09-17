import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { api, getSocket, disconnectSocket } from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: 'super_admin' | 'admin' | 'student' | 'warden' | string;
  isSuperAdmin?: boolean;
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

// Batch all auth fields into one object so login/logout triggers 1 re-render, not 6.
interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPrimaryAdmin: boolean;
  profile: Profile | null;
  features: Record<string, boolean>;
}

const LOGGED_OUT_STATE: AuthState = {
  user: null,
  isAdmin: false,
  isSuperAdmin: false,
  isPrimaryAdmin: false,
  profile: null,
  features: {},
};

interface AuthContextType {
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
  ) => Promise<{ error: any; user?: any }>;
  signInWithGoogle: (
    credential: string,
    portal?: 'super_admin' | 'admin' | 'student'
  ) => Promise<{
    error: any;
    user?: any;
    status?: 'active' | 'pending_approval' | 'approved' | 'new_resident' | 'rejected' | string;
    requiresInitialDetails?: boolean;
    canCompleteSetup?: boolean;
    setupToken?: string;
    googleProfile?: any;
    message?: string;
    pendingUser?: any;
  }>;
  requestGoogleRegistration: (payload: { credential: string; name?: string; phone?: string; hostel?: string }) => Promise<{ error: any; message?: string; status?: string }>;
  completeGoogleSetup: (payload: { setupToken: string; username: string; password: string }) => Promise<{ error: any; user?: any }>;
  signUp: (payload: { name: string; email: string; password: string; username?: string; phone?: string; hostel?: string } | any) => Promise<{ error: any; user?: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// SECURITY NOTE: `isAdmin` / `isPrimaryAdmin` below are UX-only hints used to show
// or hide UI. They are never the source of truth for authorization. All access is
// enforced server-side by row-level security policies (via the has_role() helper)
// and by JWT + role checks inside edge functions.

export function AuthProvider({ children }: { children: ReactNode }) {
  // Single state object — batches all fields into one update → 1 re-render on login/logout
  const [authState, setAuthState] = useState<AuthState>(LOGGED_OUT_STATE);
  const [loading, setLoading] = useState(true);

  const { user, isAdmin, isSuperAdmin, isPrimaryAdmin, profile, features } = authState;

  const hasFeature = useCallback((featureKey: string): boolean => {
    if (authState.isSuperAdmin || authState.user?.isSuperAdmin || authState.user?.role === 'super_admin') return true;
    const coreFeatures = ['student_management', 'room_management', 'fee_management', 'reports'];
    if (coreFeatures.includes(featureKey)) return true;
    if (authState.features && Object.keys(authState.features).length > 0) {
      return !!authState.features[featureKey];
    }
    if (authState.isAdmin) {
      const defaultAdminFeatures = [
        'student_management',
        'room_management',
        'fee_management',
        'security_deposit',
        'expense_management',
        'attendance',
        'mess_management',
        'laundry',
        'complaints',
        'reports',
        'notifications',
        'advanced_analytics',
      ];
      return defaultAdminFeatures.includes(featureKey);
    }
    return !!authState.features[featureKey];
  }, [authState]);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data?.success) {
        const { user: userData, student, features: userFeatures } = response.data;
        
        const mappedUser: User = {
          id: userData._id,
          name: userData.name,
          email: userData.email,
          username: userData.username,
          role: userData.role,
          isSuperAdmin: userData.isSuperAdmin || userData.role === 'super_admin',
        };

        const newProfile: Profile = student
          ? {
              id: student._id || student.id,
              user_id: userData._id || userData.id,
              name: student.name,
              email: student.email,
              username: student.username,
              profilePhoto: student.profilePhoto,
              room_no: student.roomNo || student.room_no || null,
              fees: student.fees ?? null,
              hostel: student.hostel || null,
            }
          : {
              id: userData._id,
              user_id: userData._id,
              name: userData.name,
              email: userData.email,
              username: userData.username,
              profilePhoto: userData.profilePhoto,
            };

        // Single setState → 1 re-render
        setAuthState({
          user: mappedUser,
          isSuperAdmin: userData.role === 'super_admin' || !!userData.isSuperAdmin,
          isAdmin: userData.role === 'admin' || userData.role === 'super_admin' || !!userData.isSuperAdmin,
          isPrimaryAdmin: userData.role === 'admin' || userData.role === 'super_admin',
          profile: newProfile,
          features: (userFeatures && typeof userFeatures === 'object') ? userFeatures : {},
        });

        // Connect Socket.io client
        try {
          const socket = getSocket();
          socket.connect();
          if (userData.role === 'student' && student) {
            socket.emit('join:hostel', student.hostel);
          }
        } catch (socketErr) {
          console.warn('Socket connection failed, offline capability active:', socketErr);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      // Clean up if invalid/expired tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAuthState(LOGGED_OUT_STATE);
      disconnectSocket();
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (localStorage.getItem('accessToken')) {
      await fetchProfile();
    }
  }, [fetchProfile]);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        await fetchProfile();
      }
      setLoading(false);
    };

    initAuth();

    // Listen for unauthorized events from axios interceptor
    const handleUnauthorized = () => {
      setAuthState(LOGGED_OUT_STATE);
      disconnectSocket();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [fetchProfile]);

  const handleAuthSuccess = useCallback((data: any) => {
    const { accessToken, refreshToken, user: userData, student } = data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    const mappedUser: User = {
      id: userData._id || userData.id,
      name: userData.name,
      email: userData.email,
      username: userData.username,
      role: userData.role,
      isSuperAdmin: userData.role === 'super_admin' || !!userData.isSuperAdmin,
    };

    const newProfile: Profile = student
      ? {
          id: student._id || student.id,
          user_id: userData._id || userData.id,
          name: student.name,
          email: student.email,
          username: student.username,
          profilePhoto: student.profilePhoto,
          room_no: student.roomNo || student.room_no || null,
          fees: student.fees ?? null,
          hostel: student.hostel || null,
        }
      : {
          id: userData._id || userData.id,
          user_id: userData._id || userData.id,
          name: userData.name,
          email: userData.email,
          username: userData.username,
          profilePhoto: userData.profilePhoto,
        };

    // Single setState → 1 re-render on login
    setAuthState({
      user: mappedUser,
      isSuperAdmin: userData.role === 'super_admin' || !!userData.isSuperAdmin,
      isAdmin: userData.role === 'admin' || userData.role === 'super_admin' || !!userData.isSuperAdmin,
      isPrimaryAdmin: userData.role === 'admin' || userData.role === 'super_admin',
      profile: newProfile,
      features: (data.features && typeof data.features === 'object') ? data.features : {},
    });

    // Connect Socket
    try {
      const socket = getSocket();
      socket.connect();
      if (userData.role === 'student' && student?.hostel) {
        socket.emit('join:hostel', student.hostel);
      }
    } catch (socketErr) {
      console.warn('Socket connection failed:', socketErr);
    }

    return mappedUser;
  }, []);

  const signIn = async (
    identifier: string,
    password: string,
    portalOrIsAdmin: 'super_admin' | 'admin' | 'student' | boolean = 'student'
  ) => {
    try {
      let endpoint = '/auth/login';
      let requestedPortal = 'STUDENT';

      if (typeof portalOrIsAdmin === 'boolean') {
        endpoint = portalOrIsAdmin ? '/auth/admin/login' : '/auth/login';
        requestedPortal = portalOrIsAdmin ? 'ADMIN' : 'STUDENT';
      } else if (portalOrIsAdmin === 'super_admin') {
        endpoint = '/auth/super-admin/login';
        requestedPortal = 'SUPER_ADMIN';
      } else if (portalOrIsAdmin === 'admin') {
        endpoint = '/auth/admin/login';
        requestedPortal = 'ADMIN';
      } else {
        endpoint = '/auth/login';
        requestedPortal = 'STUDENT';
      }

      const response = await api.post(endpoint, {
        email: identifier,
        username: identifier,
        password,
        portal: requestedPortal,
      });

      if (response.data?.success) {
        const mappedUser = handleAuthSuccess(response.data);
        if (!response.data.features || Object.keys(response.data.features).length === 0) {
          await fetchProfile();
        }
        return { error: null, user: mappedUser };
      }
      return { error: new Error('Login failed') };
    } catch (err: any) {
      const data = err.response?.data;
      const errorObj: any = new Error(data?.message || err.message || 'Login failed');
      errorObj.isLocked = data?.isLocked;
      errorObj.lockMinutes = data?.lockMinutes;
      errorObj.remainingAttempts = data?.remainingAttempts;
      errorObj.code = data?.code;
      return { error: errorObj };
    }
  };

  const signInWithGoogle = async (
    credential: string,
    portal: 'super_admin' | 'admin' | 'student' = 'student'
  ) => {
    try {
      const response = await api.post('/auth/google', {
        credential,
        portal: portal.toUpperCase(),
      });
      const data = response.data;

      if (data?.status === 'pending_approval') {
        return {
          error: null,
          status: 'pending_approval',
          message: data.message,
          pendingUser: data.user,
        };
      }

      if (data?.status === 'approved' && data.canCompleteSetup) {
        return {
          error: null,
          status: 'approved',
          canCompleteSetup: true,
          setupToken: data.setupToken,
          googleProfile: data.googleProfile,
        };
      }

      if (data?.status === 'new_resident') {
        return {
          error: null,
          status: 'new_resident',
          requiresInitialDetails: true,
          googleProfile: data.googleProfile,
        };
      }

      if (data?.status === 'rejected') {
        return {
          error: new Error(data.message || 'Registration request was declined by hostel administration.'),
          status: 'rejected',
        };
      }

      if (data?.success && (data?.status === 'active' || !data?.status)) {
        const mappedUser = handleAuthSuccess(data);
        if (!data.features || Object.keys(data.features).length === 0) {
          await fetchProfile();
        }
        return { error: null, user: mappedUser, status: 'active' };
      }

      return { error: new Error(data?.message || 'Google authentication failed') };
    } catch (err: any) {
      const data = err.response?.data;
      const errorObj: any = new Error(data?.message || err.message || 'Google authentication failed');
      return { error: errorObj, status: data?.status };
    }
  };

  const requestGoogleRegistration = async (payload: {
    credential: string;
    name?: string;
    phone?: string;
    hostel?: string;
  }) => {
    try {
      const response = await api.post('/auth/request-google-registration', payload);
      if (response.data?.success) {
        return { error: null, message: response.data.message, status: response.data.status };
      }
      return { error: new Error('Failed to submit registration request') };
    } catch (err: any) {
      const data = err.response?.data;
      return { error: new Error(data?.message || err.message || 'Failed to submit registration request') };
    }
  };

  const completeGoogleSetup = async (payload: {
    setupToken: string;
    username: string;
    password: string;
  }) => {
    try {
      const response = await api.post('/auth/complete-google-setup', payload);
      if (response.data?.success) {
        const mappedUser = handleAuthSuccess(response.data);
        if (!response.data.features || Object.keys(response.data.features).length === 0) {
          await fetchProfile();
        }
        return { error: null, user: mappedUser };
      }
      return { error: new Error('Profile setup failed') };
    } catch (err: any) {
      const data = err.response?.data;
      return { error: new Error(data?.message || err.message || 'Profile setup failed') };
    }
  };

  const signUp = async (payload: any) => {
    try {
      const endpoint = payload.role === 'admin' ? '/auth/register-admin' : '/auth/register';
      const response = await api.post(endpoint, payload);

      if (response.data?.success) {
        const mappedUser = handleAuthSuccess(response.data);
        return { error: null, user: mappedUser };
      }
      return { error: new Error('Signup failed') };
    } catch (err: any) {
      const data = err.response?.data;
      return { error: new Error(data?.message || err.message || 'Signup failed') };
    }
  };

  const signOut = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch (err) {
      console.error('Logout error (non-fatal):', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      // Single setState → 1 re-render on logout
      setAuthState(LOGGED_OUT_STATE);
      disconnectSocket();
    }
  }, []);

  const authContextValue = useMemo(() => ({
    user,
    loading,
    isAdmin,
    isSuperAdmin,
    isPrimaryAdmin,
    profile,
    features,
    hasFeature,
    signIn,
    signInWithGoogle,
    requestGoogleRegistration,
    completeGoogleSetup,
    signUp,
    signOut,
    refreshProfile
  }), [
    authState,
    loading,
    hasFeature,
    signIn,
    signInWithGoogle,
    requestGoogleRegistration,
    completeGoogleSetup,
    signUp,
    signOut,
    refreshProfile
  ]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
