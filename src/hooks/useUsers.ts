import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'sales_rep' | 'promotor';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  laboratory_id: string | null;
  laboratory_name: string | null;
  approval_limit: number | null;
  is_active: boolean;
  created_at: string;
}

export function useUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        setUsers([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch all active external promoters with lab names
      const { data: promoters, error: promotersError } = await supabase
        .from('external_promoters')
        .select('user_id, laboratory_id, approval_limit, is_active, laboratories(name)');

      if (promotersError) {
        console.error('Error fetching promoters:', promotersError);
      }

      // 3. Combine: enrich profiles with promoter data
      const promoterMap = new Map<string, {
        laboratory_id: string;
        laboratory_name: string | null;
        approval_limit: number | null;
        is_active: boolean;
      }>();

      if (promoters) {
        for (const p of promoters) {
          // Supabase returns the joined record as object (single FK) or array
          const labRaw = p.laboratories as unknown;
          const labData = Array.isArray(labRaw) ? (labRaw[0] as { name: string } | undefined) : (labRaw as { name: string } | null);
          promoterMap.set(p.user_id, {
            laboratory_id: p.laboratory_id,
            laboratory_name: labData?.name ?? null,
            approval_limit: p.approval_limit,
            is_active: p.is_active,
          });
        }
      }

      const combined: AppUser[] = (profiles || []).map((profile) => {
        const promoter = promoterMap.get(profile.id);
        const effectiveRole: UserRole = promoter ? 'promotor' : (profile.role as UserRole) || 'sales_rep';

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name || null,
          role: effectiveRole,
          laboratory_id: promoter?.laboratory_id ?? null,
          laboratory_name: promoter?.laboratory_name ?? null,
          approval_limit: promoter?.approval_limit ?? null,
          is_active: promoter?.is_active ?? true,
          created_at: profile.created_at,
        };
      });

      setUsers(combined);
    } catch (err) {
      console.error('Error in useUsers:', err);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    // Delete from profiles (cascade will handle external_promoters if FK set)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) throw profileError;

    // Also try to delete from external_promoters directly (safety net)
    await supabase
      .from('external_promoters')
      .delete()
      .eq('user_id', userId);

    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  return {
    users,
    isLoading,
    refetch: fetchUsers,
    deleteUser,
  };
}
