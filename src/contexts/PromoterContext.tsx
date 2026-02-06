import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export interface ExternalPromoter {
  id: string;
  user_id: string;
  laboratory_id: string;
  approval_limit: number | null;
  is_active: boolean;
  created_at: string;
}

interface PromoterContextValue {
  /** null = still loading, undefined = not a promoter, ExternalPromoter = is promoter */
  promoter: ExternalPromoter | null | undefined;
  isPromoter: boolean;
  isLoading: boolean;
}

const PromoterContext = createContext<PromoterContextValue>({
  promoter: null,
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
  const [promoter, setPromoter] = useState<ExternalPromoter | null | undefined>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkPromoterStatus();
  }, []);

  async function checkPromoterStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // No authenticated user — not a promoter
        setPromoter(undefined);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('external_promoters')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error checking promoter status:', error);
        setPromoter(undefined);
      } else {
        setPromoter(data ?? undefined);
      }
    } catch (err) {
      console.error('Error in promoter check:', err);
      setPromoter(undefined);
    } finally {
      setIsLoading(false);
    }
  }

  const isPromoter = promoter !== null && promoter !== undefined;

  return (
    <PromoterContext.Provider value={{ promoter, isPromoter, isLoading }}>
      {children}
    </PromoterContext.Provider>
  );
}
