import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API_URL } from '@/lib/api';

/**
 * Client-Side OAuth Callback Handler
 * Seamlessly handles redirects to /auth/google/callback:
 * - If code is present, forwards to backend exchange endpoint
 * - If tokens are present, forwards to /login token consumer
 * - If error is present, surfaces message on /login
 */
export const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const token = searchParams.get('accessToken') || searchParams.get('token');

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (token) {
      // Tokens already present in query params, forward to login handler
      navigate(`/login?${searchParams.toString()}`, { replace: true });
      return;
    }

    if (code) {
      // Authorization code needs exchange on backend
      // Strip /api if API_URL has it, to point cleanly to /api/auth/google/callback
      const baseApi = API_URL.replace(/\/+$/, '');
      const backendCallback = `${baseApi}/auth/google/callback?${searchParams.toString()}`;
      window.location.href = backendCallback;
      return;
    }

    // Default fallback
    navigate('/login', { replace: true });
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground font-medium">Completing secure authentication with Google...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
