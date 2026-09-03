import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPrimaryAdmin: boolean;
  profile: Profile | null;
  features: Record<string, boolean>;
  hasFeature: (featureKey: string) => boolean;
  signIn: (email: string, password: string, isAdminLogin?: boolean) => Promise<{ error: any; user?: any }>;
  signInWithGoogle: (credential: string) => Promise<{
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  const hasFeature = (featureKey: string): boolean => {
    if (isSuperAdmin || user?.isSuperAdmin || user?.role === 'super_admin') return true;
    const coreFeatures = ['student_management', 'room_management', 'fee_management', 'reports'];
    if (coreFeatures.includes(featureKey)) return true;
    return !!features[featureKey];
  };

  const fetchProfile = async () => {
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

        setUser(mappedUser);
        setIsSuperAdmin(userData.role === 'super_admin' || !!userData.isSuperAdmin);
        setIsAdmin(userData.role === 'admin' || userData.role === 'super_admin' || !!userData.isSuperAdmin);
        setIsPrimaryAdmin(userData.role === 'admin' || userData.role === 'super_admin');
        if (userFeatures && typeof userFeatures === 'object') {
          setFeatures(userFeatures);
        }

        if (student) {
          setProfile({
            id: student._id,
            user_id: userData._id,
            name: student.name,
            email: student.email,
            username: student.username,
            profilePhoto: student.profilePhoto,
          });
        } else {
          setProfile({
            id: userData._id,
            user_id: userData._id,
            name: userData.name,
            email: userData.email,
            username: userData.username,
            profilePhoto: userData.profilePhoto,
          });
        }

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
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setIsPrimaryAdmin(false);
      disconnectSocket();
    }
  };

  const refreshProfile = async () => {
    if (localStorage.getItem('accessToken')) {
      await fetchProfile();
    }
  };

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
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setIsPrimaryAdmin(false);
      disconnectSocket();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const handleAuthSuccess = (data: any) => {
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

    setUser(mappedUser);
    setIsSuperAdmin(userData.role === 'super_admin' || !!userData.isSuperAdmin);
    setIsAdmin(userData.role === 'admin' || userData.role === 'super_admin' || !!userData.isSuperAdmin);
    setIsPrimaryAdmin(userData.role === 'admin' || userData.role === 'super_admin');

    if (student) {
      setProfile({
        id: student._id || student.id,
        user_id: userData._id || userData.id,
        name: student.name,
        email: student.email,
        username: student.username,
        profilePhoto: student.profilePhoto,
      });
    } else {
      setProfile({
        id: userData._id || userData.id,
        user_id: userData._id || userData.id,
        name: userData.name,
        email: userData.email,
        username: userData.username,
        profilePhoto: userData.profilePhoto,
      });
    }

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
  };

  const signIn = async (identifier: string, password: string, isAdminLogin: boolean = false) => {
    try {
      const response = await api.post(
        isAdminLogin ? '/auth/admin/login' : '/auth/login',
        { email: identifier, username: identifier, password }
      );

      if (response.data?.success) {
        const mappedUser = handleAuthSuccess(response.data);
        return { error: null, user: mappedUser };
      }
      return { error: new Error('Login failed') };
    } catch (err: any) {
      const data = err.response?.data;
      const errorObj: any = new Error(data?.message || err.message || 'Login failed');
      errorObj.isLocked = data?.isLocked;
      errorObj.lockMinutes = data?.lockMinutes;
      errorObj.remainingAttempts = data?.remainingAttempts;
      return { error: errorObj };
    }
  };

  const signInWithGoogle = async (credential: string) => {
    try {
      const response = await api.post('/auth/google', { credential });
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

  const signOut = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch (err) {
      console.error('Logout error (non-fatal):', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setIsPrimaryAdmin(false);
      disconnectSocket();
    }
  };

  return (
    <AuthContext.Provider value={{
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
    }}>
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
