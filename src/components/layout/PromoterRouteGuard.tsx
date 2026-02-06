import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePromoter } from '@/contexts/PromoterContext';

interface PromoterRouteGuardProps {
  children: ReactNode;
  /** If true, promoters are fully blocked from this route and redirected to /promotions */
  restricted?: boolean;
}

/**
 * Route guard for external promoters.
 *
 * - On "/" (Dashboard): redirects promoters to /promotions (their lab-scoped view).
 * - On restricted routes (settings, calendar, wallet): redirects promoters to /promotions.
 * - For non-promoters: renders children normally.
 */
export function PromoterRouteGuard({ children, restricted }: PromoterRouteGuardProps) {
  const { isPromoter, isLoading } = usePromoter();

  // Still checking — render nothing to avoid flicker
  if (isLoading) return null;

  if (isPromoter && restricted) {
    return <Navigate to="/promotions" replace />;
  }

  // Dashboard redirect: promoters go to /promotions instead of /
  if (isPromoter && !restricted) {
    return <Navigate to="/promotions" replace />;
  }

  return <>{children}</>;
}
