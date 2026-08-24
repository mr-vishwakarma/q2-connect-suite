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
  signIn: (email: string, password: string, isAdminLogin?: boolean) => Promise<{ error: Error | null; user?: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
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

  const signIn = async (identifier: string, password: string, isAdminLogin: boolean = false) => {
    try {
      let response;
      response = await api.post(
        isAdminLogin ? '/auth/admin/login' : '/auth/login',
        { email: identifier, username: identifier, password }
      );

      if (response.data?.success) {
        const { accessToken, refreshToken, user: userData, student } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

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

        // Connect Socket
        try {
          const socket = getSocket();
          socket.connect();
          if (userData.role === 'student' && student) {
            socket.emit('join:hostel', student.hostel);
          }
        } catch (socketErr) {
          console.warn('Socket connection failed:', socketErr);
        }

        return { error: null, user: mappedUser };
      }
      return { error: new Error('Login failed') };
    } catch (err: any) {
      console.error(err);
      return { error: new Error(err.response?.data?.message || err.message || 'Login failed') };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const response = await api.post('/auth/register-admin', {
        name,
        email,
        password,
      });

      if (response.data?.success) {
        const { accessToken, refreshToken, user: userData } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        const mappedUser: User = {
          id: userData._id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
        };

        setUser(mappedUser);
        setIsAdmin(userData.role === 'admin');
        setIsPrimaryAdmin(userData.role === 'admin');
        setProfile({
          id: userData._id,
          user_id: userData._id,
          name: userData.name,
          email: userData.email,
          username: null,
          profilePhoto: userData.profilePhoto,
        });

        // Connect Socket
        try {
          const socket = getSocket();
          socket.connect();
        } catch (socketErr) {
          console.warn('Socket connection failed:', socketErr);
        }

        return { error: null };
      }
      return { error: new Error('Signup failed') };
    } catch (err: any) {
      console.error(err);
      return { error: new Error(err.response?.data?.message || err.message || 'Signup failed') };
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
