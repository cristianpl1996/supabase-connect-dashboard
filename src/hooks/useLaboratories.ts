import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createLaboratory as createLaboratoryRequest,
  deleteLaboratory as deleteLaboratoryRequest,
  listLaboratories,
  updateLaboratory as updateLaboratoryRequest,
} from '@/lib/api';

export interface Laboratory {
  id: string;
  external_brand_id: number | null;
  erp_code: string | null;
  name: string;
  tax_id: string | null;
  logo_url: string | null;
  brand_color: string | null;
  annual_goal: number | null;
  created_at: string;
}

export interface LaboratoryFormData {
  external_brand_id: number;
  erp_code: string;
  logo_url: string;
  brand_color: string;
  annual_goal: number | null;
}

export function useLaboratories() {
  const queryClient = useQueryClient();

  const { data: laboratories = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['laboratories'],
    queryFn: listLaboratories,
    staleTime: 5 * 60_000,
  });

  const createLab = useMutation({
    mutationFn: (formData: LaboratoryFormData) => createLaboratoryRequest({
      external_brand_id: formData.external_brand_id,
      erp_code: formData.erp_code || null,
      tax_id: null,
      logo_url: formData.logo_url || null,
      brand_color: formData.brand_color || null,
      annual_goal: formData.annual_goal,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['laboratories'] }),
  });

  const updateLab = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: LaboratoryFormData }) =>
      updateLaboratoryRequest(id, {
        external_brand_id: formData.external_brand_id,
        erp_code: formData.erp_code || null,
        tax_id: null,
        logo_url: formData.logo_url || null,
        brand_color: formData.brand_color || null,
        annual_goal: formData.annual_goal,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['laboratories'] }),
  });

  const deleteLab = useMutation({
    mutationFn: (id: string) => deleteLaboratoryRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['laboratories'] }),
  });

  return {
    laboratories,
    isLoading,
    isError,
    errorMessage: isError ? (error instanceof Error ? error.message : 'Error desconocido') : '',
    createLab: (formData: LaboratoryFormData) => createLab.mutateAsync(formData),
    updateLab: (id: string, formData: LaboratoryFormData) => updateLab.mutateAsync({ id, formData }),
    deleteLab: (id: string) => deleteLab.mutateAsync(id),
    refetch,
  };
}
