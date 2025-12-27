// React hook for user management

import { useState, useEffect, useCallback, useRef } from 'react';
import { userService, AppUser } from '@/lib/services/userService';

interface UseUserReturn {
  user: AppUser | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  refreshUser: () => Promise<void>;
  clearSession: () => Promise<void>;
}

export const useUser = (): UseUserReturn => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializingRef = useRef(false);

  const initializeUser = useCallback(async () => {
    // Prevent multiple initialization calls
    if (initializingRef.current) {
      return;
    }
    
    initializingRef.current = true;
    
    try {
      setIsLoading(true);
      setError(null);

      const userData = await userService.initializeUser();
      setUser(userData);
      setIsInitialized(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to initialize user:', err);
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await initializeUser();
  }, [initializeUser]);

  const clearSession = useCallback(async () => {
    try {
      setIsLoading(true);
      await userService.clearUserSession();
      setUser(null);
      setIsInitialized(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear session';
      setError(errorMessage);
      console.error('Failed to clear user session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  return {
    user,
    isLoading,
    error,
    isInitialized,
    refreshUser,
    clearSession,
  };
};
