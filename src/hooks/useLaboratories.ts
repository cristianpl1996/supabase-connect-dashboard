import { useState, useEffect, useCallback } from 'react';
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
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fetchLabs = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    try {
      const data = await listLaboratories();
      setLaboratories(data || []);
    } catch (error) {
      console.error('Error fetching laboratories:', error);
      setIsError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabs();
  }, [fetchLabs]);

  const createLab = useCallback(async (formData: LaboratoryFormData) => {
    const data = await createLaboratoryRequest({
      external_brand_id: formData.external_brand_id,
      erp_code: formData.erp_code || null,
      tax_id: null,
      logo_url: formData.logo_url || null,
      brand_color: formData.brand_color || null,
      annual_goal: formData.annual_goal,
    });
    setLaboratories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  }, []);

  const updateLab = useCallback(async (id: string, formData: LaboratoryFormData) => {
    const data = await updateLaboratoryRequest(id, {
      external_brand_id: formData.external_brand_id,
      erp_code: formData.erp_code || null,
      tax_id: null,
      logo_url: formData.logo_url || null,
      brand_color: formData.brand_color || null,
      annual_goal: formData.annual_goal,
    });
    setLaboratories((prev) =>
      prev.map((l) => (l.id === id ? data : l)).sort((a, b) => a.name.localeCompare(b.name))
    );
    return data;
  }, []);

  const deleteLab = useCallback(async (id: string) => {
    await deleteLaboratoryRequest(id);
    setLaboratories((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return {
    laboratories,
    isLoading,
    isError,
    errorMessage,
    createLab,
    updateLab,
    deleteLab,
    refetch: fetchLabs,
  };
}
