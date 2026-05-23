import { createContext, useContext, type ReactNode } from 'react';
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
  return (
    <SalesRepContext.Provider value={{ isSalesRep }}>
      {children}
    </SalesRepContext.Provider>
  );
}
