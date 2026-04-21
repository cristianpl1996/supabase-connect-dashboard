import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface ExternalPromoter {
  id: string;
  user_id: string;
  laboratory_id: string;
  approval_limit: number | null;
  is_active: boolean;
  created_at: string;
}

interface PromoterContextValue {
  promoter: ExternalPromoter | undefined;
  isPromoter: boolean;
  isLoading: boolean;
}

const PromoterContext = createContext<PromoterContextValue>({
  promoter: undefined,
  isPromoter: false,
  isLoading: true,
});

export function usePromoter() {
  return useContext(PromoterContext);
}

interface PromoterProviderProps {
  children: ReactNode;
}

export function PromoterProvider({ children }: PromoterProviderProps) {
  const { user, isLoading } = useAuth();
  const isPromoter = user?.role === 'promotor' && !!user.laboratory_id;
  const promoter = isPromoter
    ? {
        id: String(user?.id ?? ''),
        user_id: String(user?.id ?? ''),
        laboratory_id: user?.laboratory_id ?? '',
        approval_limit: user?.approval_limit ?? null,
        is_active: true,
        created_at: '',
      }
    : undefined;

  return (
    <PromoterContext.Provider value={{ promoter, isPromoter, isLoading }}>
      {children}
    </PromoterContext.Provider>
  );
}
