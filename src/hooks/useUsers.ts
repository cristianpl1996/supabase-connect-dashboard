import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

async function fetchAppUsers(): Promise<AppUser[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return [];
  }

  const { data: promoters, error: promotersError } = await supabase
    .from('external_promoters')
    .select('user_id, laboratory_id, approval_limit, is_active, laboratories(name)');

  if (promotersError) {
    console.error('Error fetching promoters:', promotersError);
  }

  const promoterMap = new Map<string, {
    laboratory_id: string;
    laboratory_name: string | null;
    approval_limit: number | null;
    is_active: boolean;
  }>();

  if (promoters) {
    for (const p of promoters) {
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

  return (profiles || []).map((profile) => {
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
}

export function useUsers() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['app-users'],
    queryFn: fetchAppUsers,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
      if (profileError) throw profileError;
      await supabase.from('external_promoters').delete().eq('user_id', userId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app-users'] }),
  });

  return {
    users,
    isLoading,
    refetch,
    deleteUser: (userId: string) => deleteMutation.mutateAsync(userId),
  };
}
