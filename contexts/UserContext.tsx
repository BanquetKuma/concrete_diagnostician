// User context for global user state management

import React, { createContext, useContext, ReactNode } from 'react';
import { AppUser } from '@/lib/services/userService';
import { useUser } from '@/hooks/useUser';

interface UserContextType {
  user: AppUser | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  refreshUser: () => Promise<void>;
  clearSession: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const userHookResult = useUser();

  return <UserContext.Provider value={userHookResult}>{children}</UserContext.Provider>;
};

export const useUserContext = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
};
