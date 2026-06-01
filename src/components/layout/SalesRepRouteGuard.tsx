import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSalesRep } from '@/contexts/SalesRepContext';

interface SalesRepRouteGuardProps {
  children: ReactNode;
}

/**
 * Blocks sales_rep users from accessing any route except /stockouts.
 * Wrap every restricted route with this guard.
 */
export function SalesRepRouteGuard({ children }: SalesRepRouteGuardProps) {
  const { isSalesRep } = useSalesRep();

  if (isSalesRep) {
    return <Navigate to="/stockouts" replace />;
  }

  return <>{children}</>;
}
