import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface SalesRepContextValue {
  isSalesRep: boolean;
}

const SalesRepContext = createContext<SalesRepContextValue>({ isSalesRep: false });

export function useSalesRep() {
  return useContext(SalesRepContext);
}

export function SalesRepProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isSalesRep = user?.role === 'sales_rep';
  const value = useMemo(() => ({ isSalesRep }), [isSalesRep]);
  return (
    <SalesRepContext.Provider value={value}>
      {children}
    </SalesRepContext.Provider>
  );
}
