import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getSocket, disconnectSocket } from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: 'admin' | 'student';
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  username: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  profile: Profile | null;
  signIn: (email: string, password: string, isAdminLogin?: boolean) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data?.success) {
        const { user: userData, student } = response.data;
        
        const mappedUser: User = {
          id: userData._id,
          name: userData.name,
          email: userData.email,
          username: userData.username,
          role: userData.role,
        };

        setUser(mappedUser);
        setIsAdmin(userData.role === 'admin');
        setIsPrimaryAdmin(userData.role === 'admin');

        if (student) {
          setProfile({
            id: student._id,
            user_id: userData._id,
            name: student.name,
            email: student.email,
            username: student.username,
          });
        } else {
          setProfile({
            id: userData._id,
            user_id: userData._id,
            name: userData.name,
            email: userData.email,
            username: userData.username,
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
        };

        setUser(mappedUser);
        setIsAdmin(userData.role === 'admin');
        setIsPrimaryAdmin(userData.role === 'admin');

        if (student) {
          setProfile({
            id: student._id,
            user_id: userData._id,
            name: student.name,
            email: student.email,
            username: student.username,
          });
        } else {
          setProfile({
            id: userData._id,
            user_id: userData._id,
            name: userData.name,
            email: userData.email,
            username: userData.username,
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

        return { error: null };
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
      isPrimaryAdmin,
      profile,
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
