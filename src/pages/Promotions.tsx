import { useEffect, useRef, useState, useCallback, useMemo, type ElementType, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });
import {
  clonePromotion,
  deletePromotion,
  getAllCustomers,
  getAllProducts,
  getSapAutoSyncStatus,
  listLaboratories,
  listPromotions,
  updatePromotionStatus,
  bulkUpdatePromotionStatus,
  bulkDeletePromotions,
  BulkActionResponse,
} from '@/lib/api';
import { Promotion } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Eye, EyeOff, Pencil, Trash2,
  Tag, Calendar, DollarSign, Zap, Copy, Upload, Columns3, SlidersHorizontal, X, Check, Loader2, RefreshCw,
  AlertTriangle, XCircle, CheckCircle2, Ban, Info,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { PromotionFormSheet } from '@/components/promotions/PromotionFormSheet';
import { PromotionDetailsSheet } from '@/components/promotions/PromotionDetailsSheet';
import { ImportPromotionsModal } from '@/components/promotions/ImportPromotionsModal';
import SyncFromSapModal from '@/components/promotions/SyncFromSapModal';
import { SapStatusBadge } from '@/components/promotions/SapStatusBadge';
import { ModuleErrorCard } from '@/components/common/ModuleErrorCard';
import { ErrorDisabledContent } from '@/components/common/ErrorDisabledContent';
import { PageHeader } from '@/components/common/PageHeader';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  borrador: { label: 'Borrador', variant: 'outline' },
  activa: { label: 'Activa', variant: 'default' },
  finalizada: { label: 'Finalizada', variant: 'secondary' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
};

const MECHANIC_LABELS: Record<string, string> = {
  descuento_linea: 'Descuento en Linea',
  bonificacion_cantidad: 'Bonificacion',
  precio_especial: 'Precio Especial',
  descuento_volumen: 'Descuento Volumen',
  bonificacion_volumen: 'Bonificacion Volumen',
  combo: 'Combo Productos',
};

const Promotions = () => {
  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: promotions = [],
    isLoading,
    isError,
    error: promotionsError,
    refetch: refetchPromotions,
  } = useQuery({
    queryKey: ['promotions'],
    queryFn: listPromotions,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const data = query.state.data as Promotion[] | undefined;
      return data?.some((p) => p.sap_sync_status === 'pending') ? 8_000 : false;
    },
  });

  const { data: laboratories = [] } = useQuery({
    queryKey: ['laboratories'],
    queryFn: listLaboratories,
    staleTime: 5 * 60_000,
  });

  const { data: autoSyncStatus } = useQuery({
    queryKey: ['sap-auto-sync-status'],
    queryFn: getSapAutoSyncStatus,
    staleTime: 60_000,
  });

  // ── UI state ───────────────────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState<Promotion | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [viewingPromo, setViewingPromo] = useState<Promotion | null>(null);
  const [promoToClone, setPromoToClone] = useState<Promotion | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [syncingFromSap, setSyncingFromSap] = useState(false);
  const importClosedWhileBusy = useRef(false);
  const syncClosedWhileBusy = useRef(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [laboratoryFilter, setLaboratoryFilter] = useState('all');
  const [mechanicFilter, setMechanicFilter] = useState('all');
  const [sapStatusFilter, setSapStatusFilter] = useState('all');
  const [showCostColumn, setShowCostColumn] = useState(false);
  const [showSapColumn, setShowSapColumn] = useState(true);
  const [hiddenCostRows, setHiddenCostRows] = useState<Set<string>>(new Set());
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  const [cancelDialogPromo, setCancelDialogPromo] = useState<Promotion | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResult, setBulkResult] = useState<BulkActionResponse | null>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePromotion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promocion eliminada exitosamente');
      setDeleteDialogOpen(false);
      setPromoToDelete(null);
    },
    onError: (err) => toast.error(`Error al eliminar: ${err instanceof Error ? err.message : 'Error desconocido'}`),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ promo, newStatus }: { promo: Promotion; newStatus: string }) => {
      const updated = await updatePromotionStatus(promo.id, newStatus);
      return { result: updated, sapError: null };
    },
    onMutate: async ({ promo, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['promotions'] });
      const previous = queryClient.getQueryData<Promotion[]>(['promotions']);
      queryClient.setQueryData<Promotion[]>(['promotions'], (prev) =>
        prev?.map((p) => p.id === promo.id ? { ...p, status: newStatus as Promotion['status'] } : p) ?? []
      );
      return { previous };
    },
    onSuccess: ({ result, sapError }) => {
      queryClient.setQueryData<Promotion[]>(['promotions'], (prev) =>
        prev?.map((p) => p.id === result.id ? result : p) ?? []
      );
      if (sapError) {
        toast.warning('No se pudo activar — error SAP', { description: sapError, duration: 8000 });
      } else if (result.status === 'activa' && result.sap_sync_status === 'pending') {
        toast.info('Activada · Sincronizando con SAP en segundo plano…', {
          description: 'La columna SAP se actualizará automáticamente cuando finalice (1–2 min).',
          duration: 7000,
        });
      } else if (result.sap_sync_status === 'failed') {
        toast.warning('Activada, pero el sync con SAP falló', {
          description: 'Abre la promoción para ver el error y reintentar.',
          duration: 8000,
        });
      } else {
        toast.success(`Promoción ${result.status === 'activa' ? 'activada' : 'desactivada'}`);
      }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['promotions'], context.previous);
      toast.error('Error al cambiar estado');
    },
    onSettled: () => setTogglingStatusId(null),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => clonePromotion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promocion duplicada exitosamente');
      setPromoToClone(null);
    },
    onError: (err) => toast.error(`Error al clonar: ${err instanceof Error ? err.message : 'Error desconocido'}`),
  });

  const bulkActivateMutation = useMutation({
    mutationFn: (ids: string[]) => bulkUpdatePromotionStatus(ids, 'activa'),
    onSuccess: (res) => {
      setBulkResult(res);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: () => toast.error('Error al activar promociones'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeletePromotions(ids),
    onSuccess: (res) => {
      setBulkResult(res);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: () => toast.error('Error al eliminar promociones'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => updatePromotionStatus(id, 'cancelada'),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['promotions'] });
      const previous = queryClient.getQueryData<Promotion[]>(['promotions']);
      queryClient.setQueryData<Promotion[]>(['promotions'], (prev) =>
        prev?.map((p) => p.id === id ? { ...p, status: 'cancelada' as const } : p) ?? []
      );
      return { previous };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Promotion[]>(['promotions'], (prev) =>
        prev?.map((p) => p.id === updated.id ? updated : p) ?? []
      );
      toast.success('Promoción cancelada en SAP');
      setCancelDialogPromo(null);
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['promotions'], context.previous);
      toast.error('Error al cancelar');
    },
    onSettled: () => setIsCancelling(false),
  });

  // Auto-reopen sync modal when background operation completes
  useEffect(() => {
    if (!syncingFromSap && syncClosedWhileBusy.current) {
      syncClosedWhileBusy.current = false;
      setShowSyncModal(true);
    }
  }, [syncingFromSap]);

  const filteredPromotions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return promotions.filter((promo) => (
      (!query.trim()
        || (promo.laboratory_name || '').toLowerCase().includes(query)
        || promo.title.toLowerCase().includes(query))
      && (statusFilter === 'all' || promo.status === statusFilter)
      && (laboratoryFilter === 'all' || (promo.laboratory_name || 'Sin laboratorio') === laboratoryFilter)
      && (mechanicFilter === 'all' || (promo.mechanic?.promotion_type || 'N/A') === mechanicFilter)
      && (sapStatusFilter === 'all'
        || (sapStatusFilter === 'synced' && !!promo.sap_campaign_number && !promo.sap_sync_error)
        || (sapStatusFilter === 'error' && !!promo.sap_sync_error)
        || (sapStatusFilter === 'not_synced' && !promo.sap_campaign_number && !promo.sap_sync_error))
    ));
  }, [laboratoryFilter, mechanicFilter, promotions, sapStatusFilter, searchQuery, statusFilter]);

  const visibleIds = filteredPromotions.map((p) => p.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (visibleIds.length > 0 && visibleIds.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(visibleIds);
    });
  }, [visibleIds]);

  const handleBulkActivate = useCallback(() => {
    const ids = [...selectedIds].filter((id) => {
      const p = promotions.find((pr) => pr.id === id);
      return p && p.status !== 'activa';
    });
    if (ids.length === 0) return;
    bulkActivateMutation.mutate(ids);
  }, [selectedIds, promotions, bulkActivateMutation]);

  const handleBulkDelete = useCallback(() => {
    const ids = [...selectedIds].filter((id) => {
      const p = promotions.find((pr) => pr.id === id);
      return p && !p.sap_campaign_number;
    });
    if (ids.length === 0) {
      toast.error('Las promociones seleccionadas tienen campaña SAP y no pueden eliminarse');
      return;
    }
    bulkDeleteMutation.mutate(ids);
  }, [selectedIds, promotions, bulkDeleteMutation]);

  const laboratoryOptions = useMemo(() => {
    const names = new Set<string>();
    laboratories.forEach((lab) => {
      if (lab.name) names.add(lab.name);
    });
    promotions.forEach((promo) => names.add(promo.laboratory_name || 'Sin laboratorio'));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [laboratories, promotions]);

  const mechanicOptions = useMemo(() => {
    const values = new Set<string>();
    promotions.forEach((promo) => values.add(promo.mechanic?.promotion_type || 'N/A'));
    return Array.from(values).sort((a, b) => (MECHANIC_LABELS[a] || a).localeCompare(MECHANIC_LABELS[b] || b));
  }, [promotions]);

  const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== 'all' || laboratoryFilter !== 'all' || mechanicFilter !== 'all' || sapStatusFilter !== 'all';
  const advancedFilterCount = [laboratoryFilter !== 'all', mechanicFilter !== 'all', sapStatusFilter !== 'all'].filter(Boolean).length;
  const activeCount = filteredPromotions.filter((p) => p.status === 'activa').length;
  const totalEstimatedCost = filteredPromotions.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

  const activeFilterTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (searchQuery.trim()) {
      tags.push({ key: 'search', label: `Busqueda: ${searchQuery.trim()}`, onRemove: () => { setSearchQuery(''); setSearchInput(''); } });
    }
    if (statusFilter !== 'all') {
      tags.push({ key: 'status', label: `Estado: ${STATUS_CONFIG[statusFilter]?.label || statusFilter}`, onRemove: () => setStatusFilter('all') });
    }
    if (laboratoryFilter !== 'all') {
      tags.push({ key: 'laboratory', label: `Laboratorio: ${laboratoryFilter}`, onRemove: () => setLaboratoryFilter('all') });
    }
    if (mechanicFilter !== 'all') {
      tags.push({ key: 'mechanic', label: `Mecánica: ${MECHANIC_LABELS[mechanicFilter] || mechanicFilter}`, onRemove: () => setMechanicFilter('all') });
    }
    if (sapStatusFilter !== 'all') {
      const sapLabels: Record<string, string> = { synced: 'Sincronizados', error: 'Con error SAP', not_synced: 'No sincronizados' };
      tags.push({ key: 'sap', label: `SAP: ${sapLabels[sapStatusFilter] || sapStatusFilter}`, onRemove: () => setSapStatusFilter('all') });
    }
    return tags;
  }, [laboratoryFilter, mechanicFilter, sapStatusFilter, searchQuery, statusFilter]);

  const commitSearch = () => setSearchQuery(searchInput.trim());

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setStatusFilter('all');
    setLaboratoryFilter('all');
    setMechanicFilter('all');
    setSapStatusFilter('all');
  };

  const prefetchProductsAndCustomers = () => {
    queryClient.prefetchQuery({ queryKey: ['products-all'], queryFn: getAllProducts });
    queryClient.prefetchQuery({ queryKey: ['customers-all'], queryFn: getAllCustomers });
  };

  const handlePromoSaved = () => {
    setSheetOpen(false);
    setEditingPromo(null);
    queryClient.invalidateQueries({ queryKey: ['promotions'] });
  };

  const handleDeleteClick = (promo: Promotion) => {
    setPromoToDelete(promo);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!promoToDelete) return;
    deleteMutation.mutate(promoToDelete.id);
  };

  const handleToggleStatus = (promo: Promotion) => {
    const newStatus = promo.status === 'activa' ? 'borrador' : 'activa';
    setTogglingStatusId(promo.id);
    toggleStatusMutation.mutate({ promo, newStatus });
  };

  const toggleRowCostHidden = (promoId: string) => {
    setHiddenCostRows((prev) => {
      const next = new Set(prev);
      if (next.has(promoId)) next.delete(promoId);
      else next.add(promoId);
      return next;
    });
  };

  const handleCloneClick = (promo: Promotion) => {
    setPromoToClone(promo);
  };

  const handleConfirmClone = () => {
    if (!promoToClone) return;
    cloneMutation.mutate(promoToClone.id);
  };

  const formatCurrency = (value: number) => COP_FORMATTER.format(value);

  const formatDateRange = (start: string, end: string) => {
    try {
      const startDate = format(new Date(start), 'dd MMM', { locale: es });
      const endDate = format(new Date(end), 'dd MMM yyyy', { locale: es });
      return `${startDate} - ${endDate}`;
    } catch {
      return `${start} - ${end}`;
    }
  };

  const canEdit = (promo: Promotion) => promo.status === 'borrador' || promo.status === 'activa';
  const canDelete = (promo: Promotion) => !promo.sap_campaign_number && canEdit(promo);
  const canCancel = (promo: Promotion) => !!promo.sap_campaign_number && canEdit(promo);

  const handleCancelClick = (promo: Promotion) => {
    setCancelDialogPromo(promo);
  };

  const handleConfirmCancel = () => {
    if (!cancelDialogPromo) return;
    setIsCancelling(true);
    cancelMutation.mutate(cancelDialogPromo.id);
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 sm:space-y-8">
      <ErrorDisabledContent disabled={isError}>
        <PageHeader
          icon={Tag}
          title="Gestion de Promociones"
          description="Crea y administra promociones comerciales"
          actions={(
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto">
              <Button variant="outline" onClick={() => { prefetchProductsAndCustomers(); setShowSyncModal(true); }} disabled={isLoading} className="w-full gap-2">
                {syncingFromSap ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Sincronizar SAP
              </Button>
              <Button variant="outline" onClick={() => { prefetchProductsAndCustomers(); setShowImportModal(true); }} disabled={isLoading} className="w-full gap-2">
                {(downloadingTemplate || parsingFile) ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Importar Excel
              </Button>
              <Button onClick={() => { prefetchProductsAndCustomers(); setEditingPromo(null); setSheetOpen(true); }} disabled={isLoading} className="w-full gap-2">
                <Plus className="size-4" />
                Nueva Promocion
              </Button>
            </div>
          )}
        />
      </ErrorDisabledContent>

      {isError && (
        <ModuleErrorCard
          message={promotionsError instanceof Error ? promotionsError.message : 'Error al cargar las promociones'}
          onRetry={() => void refetchPromotions()}
          loading={isLoading}
        />
      )}

      {autoSyncStatus && autoSyncStatus.status !== 'never_run' && (() => {
        const { status, last_run_at, imported, updated, errors } = autoSyncStatus;
        const timeAgo = last_run_at
          ? formatDistanceToNow(parseISO(last_run_at), { addSuffix: true, locale: es })
          : '';
        if (status === 'ok') return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span>Auto-sync SAP: {timeAgo} · {imported + updated} sincronizadas</span>
          </div>
        );
        if (status === 'errors') return (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 px-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Auto-sync SAP: {timeAgo} · {errors.length} error(es) — Ver detalles</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <p className="text-xs font-medium mb-1.5">Errores en última sincronización automática:</p>
              <ul className="space-y-1 text-xs text-red-700 max-h-40 overflow-y-auto">
                {errors.map((e, i) => <li key={i} className="break-words">• {e}</li>)}
              </ul>
            </PopoverContent>
          </Popover>
        );
        return (
          <div className="flex items-center gap-1.5 text-xs text-red-600 px-1">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Auto-sync SAP: falló {timeAgo}</span>
          </div>
        );
      })()}

      <ErrorDisabledContent disabled={isError} className="space-y-6 sm:space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Promociones Activas</CardTitle>
              <Zap className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="h-8 bg-muted animate-pulse rounded" /> : <p className="text-2xl font-bold text-foreground">{activeCount}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{hasActiveFilters ? 'Segun filtros aplicados' : 'Vista actual'}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Promociones</CardTitle>
              <Tag className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{filteredPromotions.length} / {promotions.length}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Segun filtros actuales</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Costo Estimado Total</CardTitle>
              <DollarSign className="size-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : showCostColumn ? (
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalEstimatedCost)}</p>
              ) : (
                <p className="text-2xl font-bold text-muted-foreground">No elegido</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {showCostColumn ? 'Suma de resultados visibles' : 'Activalo en columnas'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 shadow-sm pt-1">
          <CardHeader className="space-y-2 px-4 py-5 sm:px-5">
            <div className="grid gap-3 md:grid-cols-[minmax(320px,2.5fr)_minmax(160px,1fr)_auto_auto]">
              <div className="relative min-w-0">
                <button type="button" onClick={commitSearch} disabled={isLoading} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">
                  <Search className="size-4" />
                </button>
                <Input
                  placeholder="Buscar por titulo o laboratorio"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
                  disabled={isLoading}
                  className="h-10 bg-background pl-9 pr-9"
                />
                {searchQuery && (
                  <button type="button" onClick={() => { setSearchInput(''); setSearchQuery(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-destructive">
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 w-full gap-2 md:w-auto" disabled={isLoading}>
                    <Columns3 className="size-4" />
                    Columnas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-50 w-64 border border-border bg-popover p-2 shadow-md space-y-1.5">
                  <DropdownMenuCheckboxItem
                    checked={showCostColumn}
                    onCheckedChange={setShowCostColumn}
                    className="min-h-12 rounded-md border border-border bg-background py-2 pl-3 pr-3 focus:bg-accent [&>span:first-child]:hidden"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded border ${showCostColumn ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>
                        {showCostColumn && <Check className="size-3.5" />}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium text-foreground">Costo estimado</span>
                        <span className="text-xs text-muted-foreground">
                          {showCostColumn ? "Visible en la tabla" : "Mostrar columna en la tabla"}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={showSapColumn}
                    onCheckedChange={setShowSapColumn}
                    className="min-h-12 rounded-md border border-border bg-background py-2 pl-3 pr-3 focus:bg-accent [&>span:first-child]:hidden"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded border ${showSapColumn ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>
                        {showSapColumn && <Check className="size-3.5" />}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium text-foreground">Estado SAP</span>
                        <span className="text-xs text-muted-foreground">
                          {showSapColumn ? "Visible en la tabla" : "Mostrar columna en la tabla"}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* ── Filtros avanzados ── */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={advancedFilterCount > 0 ? 'default' : 'outline'} className="h-10 w-full gap-2 md:w-auto" disabled={isLoading}>
                    <SlidersHorizontal className="size-4" />
                    Filtros
                    {advancedFilterCount > 0 && (
                      <span className="rounded bg-background/20 px-1.5 text-xs">{advancedFilterCount}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="max-h-[min(78svh,600px)] w-[calc(100vw-1.5rem)] overflow-y-auto p-0 sm:w-[min(94vw,680px)]">
                  <div className="border-b p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">Filtros avanzados</p>
                        <p className="text-sm text-muted-foreground">Filtra por laboratorio, mecánica comercial y estado de sincronización SAP.</p>
                      </div>
                      {advancedFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => { setLaboratoryFilter('all'); setMechanicFilter('all'); setSapStatusFilter('all'); }} disabled={isLoading} className="w-full gap-2 sm:w-auto">
                          <X className="size-4" /> Limpiar todo
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-5 p-4">
                    <PromoFilterSection icon={Tag} title="Promoción">
                      <PromoFilterField label="Laboratorio">
                        <Select value={laboratoryFilter} onValueChange={setLaboratoryFilter} disabled={isLoading}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los laboratorios</SelectItem>
                            {laboratoryOptions.map((name) => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </PromoFilterField>
                      <PromoFilterField label="Mecánica">
                        <Select value={mechanicFilter} onValueChange={setMechanicFilter} disabled={isLoading}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas las mecánicas</SelectItem>
                            {mechanicOptions.map((value) => (
                              <SelectItem key={value} value={value}>{MECHANIC_LABELS[value] || value}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </PromoFilterField>
                    </PromoFilterSection>
                    <Separator />
                    <PromoFilterSection icon={RefreshCw} title="Sincronización SAP">
                      <PromoFilterField label="Estado SAP">
                        <Select value={sapStatusFilter} onValueChange={setSapStatusFilter} disabled={isLoading}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="synced">Sincronizados</SelectItem>
                            <SelectItem value="error">Con error SAP</SelectItem>
                            <SelectItem value="not_synced">No sincronizados</SelectItem>
                          </SelectContent>
                        </Select>
                      </PromoFilterField>
                    </PromoFilterSection>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {activeFilterTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-4" style={{
                marginTop: "20px"
              }}>
                {activeFilterTags.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={filter.onRemove}
                    disabled={isLoading}
                    className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15"
                  >
                    <span className="truncate">{filter.label}</span>
                    <X className="size-3 shrink-0" />
                  </button>
                ))}
                <button type="button" onClick={clearFilters} disabled={isLoading} className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground">
                  <X className="size-3" /> Limpiar
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-0 sm:px-5">
            {someSelected && (
              <div className="flex items-center gap-4 rounded-md border border-border bg-muted/30 px-4 py-2 mb-4">
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
                </span>
                <div className="h-4 w-px bg-border" />
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedIds(new Set())}
                    disabled={bulkActivateMutation.isPending || bulkDeleteMutation.isPending}
                    className="h-8 gap-1.5"
                  >
                    <X className="size-3.5" />
                    Cerrar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 h-8"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending || bulkActivateMutation.isPending}
                  >
                    {bulkDeleteMutation.isPending
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Trash2 className="size-3.5" />}
                    Eliminar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkActivate}
                    disabled={bulkActivateMutation.isPending || bulkDeleteMutation.isPending}
                    className="gap-1.5 h-8"
                  >
                    {bulkActivateMutation.isPending
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Zap className="size-3.5" />}
                    Activar
                  </Button>
                </div>
              </div>
            )}
            {isLoading ? (
                <div className="space-y-3">{["promotion-1", "promotion-2", "promotion-3"].map((slot) => <div key={slot} className="h-12 bg-muted animate-pulse rounded" />)}</div>
            ) : filteredPromotions.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="size-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {hasActiveFilters ? 'No se encontraron promociones con los filtros aplicados' : 'No hay promociones registradas'}
                </p>
                {hasActiveFilters ? (
                  <Button variant="outline" className="mt-4" onClick={clearFilters} disabled={isLoading}>
                    <X className="size-4 mr-2" />
                    Limpiar filtros
                  </Button>
                ) : (
                  <Button variant="outline" className="mt-4" onClick={() => { prefetchProductsAndCustomers(); setEditingPromo(null); setSheetOpen(true); }} disabled={isLoading}>
                    <Plus className="size-4 mr-2" />
                    Crear primera promocion
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredPromotions.map((promo) => {
                    const statusConfig = STATUS_CONFIG[promo.status] || STATUS_CONFIG.borrador;
                    const mechanicType = promo.mechanic?.promotion_type || 'N/A';
                    const isCostHidden = hiddenCostRows.has(promo.id);
                    const hasSapErrorMobile = !!promo.sap_sync_error;
                    return (
                      <div key={promo.id} className="rounded-md border bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{promo.title}</p>
                            <p className="mt-1 truncate text-sm text-muted-foreground">{promo.laboratory_name || 'Sin laboratorio'}</p>
                          </div>
                          <Switch
                            checked={promo.status === 'activa'}
                            onCheckedChange={() => handleToggleStatus(promo)}
                            disabled={isLoading || togglingStatusId === promo.id || promo.status === 'cancelada' || promo.status === 'finalizada'}
                            aria-label={`${promo.status === 'activa' ? 'Desactivar' : 'Activar'} promocion`}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                          <Badge variant="outline" className="font-normal">{MECHANIC_LABELS[mechanicType] || mechanicType}</Badge>
                          <SapStatusBadge
                            campaignNumber={promo.sap_campaign_number}
                            syncedAt={promo.sap_synced_at}
                            syncError={promo.sap_sync_error}
                            syncStatus={promo.sap_sync_status}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Vigencia</p>
                            <p className="font-medium">{formatDateRange(promo.start_date, promo.end_date)}</p>
                          </div>
                          {showCostColumn && (
                            <div>
                              <p className="text-xs text-muted-foreground">Costo</p>
                              <p className="font-mono font-medium">{isCostHidden ? '••••••' : formatCurrency(promo.estimated_cost || 0)}</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-1">
                          <Button variant="outline" size="icon" className="h-9 w-full" onClick={() => { setViewingPromo(promo); setDetailsSheetOpen(true); }} disabled={isLoading} title="Ver detalles"><Eye className="size-4" /></Button>
                          <Button variant="outline" size="icon" className="h-9 w-full" onClick={() => handleCloneClick(promo)} disabled={isLoading || cloneMutation.isPending} title="Duplicar"><Copy className="size-4" /></Button>
                          <Button variant="outline" size="icon" className="h-9 w-full"
                            onClick={() => canEdit(promo) && (prefetchProductsAndCustomers(), setEditingPromo(promo), setSheetOpen(true))}
                            disabled={isLoading || !canEdit(promo)}
                            title="Editar">
                            <Pencil className="size-4" />
                          </Button>
                          {promo.sap_campaign_number ? (
                            <Button variant="outline" size="icon" className="h-9 w-full text-destructive hover:text-destructive"
                              onClick={() => canCancel(promo) && handleCancelClick(promo)}
                              disabled={isLoading || !canCancel(promo)}
                              title="Cancelar en SAP">
                              <Ban className="size-4" />
                            </Button>
                          ) : (
                            <Button variant="outline" size="icon" className="h-9 w-full text-destructive hover:text-destructive"
                              onClick={() => canDelete(promo) && handleDeleteClick(promo)}
                              disabled={isLoading || !canDelete(promo)}
                              title="Eliminar">
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <Table className={showCostColumn && showSapColumn ? "min-w-[1380px]" : showCostColumn || showSapColumn ? "min-w-[1220px]" : "min-w-[1080px]"}>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 px-3 py-3">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                            aria-label="Seleccionar todo"
                          />
                        </TableHead>
                        <TableHead className="w-20">Activa</TableHead>
                        <TableHead className="min-w-[220px]">Titulo</TableHead>
                        <TableHead className="min-w-[220px]">Laboratorio</TableHead>
                        <TableHead className="w-[180px]">Vigencia</TableHead>
                        <TableHead className="w-[120px]">Estado</TableHead>
                        <TableHead className="w-[170px]">Tipo Mecanica</TableHead>
                        {showCostColumn && <TableHead className="w-[190px] text-right">Costo Estimado</TableHead>}
                        {showSapColumn && <TableHead className="w-[130px]">SAP</TableHead>}
                        <TableHead className="w-[150px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPromotions.map((promo) => {
                        const statusConfig = STATUS_CONFIG[promo.status] || STATUS_CONFIG.borrador;
                        const mechanicType = promo.mechanic?.promotion_type || 'N/A';
                        const isCostHidden = hiddenCostRows.has(promo.id);
                        const hasSapError = !!promo.sap_sync_error;
                        return (
                          <TableRow key={promo.id}>
                            <TableCell className="px-3">
                              <Checkbox
                                checked={selectedIds.has(promo.id)}
                                onCheckedChange={() => toggleOne(promo.id)}
                                aria-label={`Seleccionar ${promo.title}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={promo.status === 'activa'}
                                onCheckedChange={() => handleToggleStatus(promo)}
                                disabled={isLoading || togglingStatusId === promo.id || promo.status === 'cancelada' || promo.status === 'finalizada'}
                                aria-label={`${promo.status === 'activa' ? 'Desactivar' : 'Activar'} promocion`}
                              />
                            </TableCell>
                            <TableCell className="max-w-[260px] font-medium">
                              <span className="line-clamp-2">{promo.title}</span>
                            </TableCell>
                            <TableCell>
                              {promo.laboratory_name || <span className="text-muted-foreground">Sin laboratorio</span>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="size-3" />
                                {formatDateRange(promo.start_date, promo.end_date)}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant={statusConfig.variant}>{statusConfig.label}</Badge></TableCell>
                            <TableCell>
                              <Badge variant="outline" className="max-w-[150px] justify-center whitespace-normal text-center font-normal leading-tight">
                                {MECHANIC_LABELS[mechanicType] || mechanicType}
                              </Badge>
                            </TableCell>
                            {showCostColumn && (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                  <span className="font-mono text-sm">
                                    {isCostHidden ? '••••••' : formatCurrency(promo.estimated_cost || 0)}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6"
                                    onClick={() => toggleRowCostHidden(promo.id)}
                                    disabled={isLoading}
                                    title={isCostHidden ? 'Mostrar valor' : 'Ocultar valor'}
                                  >
                                    {isCostHidden ? <EyeOff className="size-3 text-muted-foreground" /> : <Eye className="size-3 text-muted-foreground" />}
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                            {showSapColumn && (
                              <TableCell>
                                <SapStatusBadge
                                  campaignNumber={promo.sap_campaign_number}
                                  syncedAt={promo.sap_synced_at}
                                  syncError={promo.sap_sync_error}
                                  syncStatus={promo.sap_sync_status}
                                />
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8" onClick={() => { setViewingPromo(promo); setDetailsSheetOpen(true); }} disabled={isLoading}>
                                        <Eye className="size-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <div className="flex items-center gap-1.5">
                                        <Info className="size-3 shrink-0" />
                                        Ver detalles de la promoción
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8" onClick={() => handleCloneClick(promo)} disabled={isLoading || cloneMutation.isPending}>
                                        <Copy className="size-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <div className="flex items-center gap-1.5">
                                        <Info className="size-3 shrink-0" />
                                        Duplicar como borrador
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex">
                                        <Button variant="ghost" size="icon" className="size-8"
                                          onClick={() => { prefetchProductsAndCustomers(); setEditingPromo(promo); setSheetOpen(true); }}
                                          disabled={isLoading || !canEdit(promo)}>
                                          <Pencil className="size-4" />
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <div className="flex items-center gap-1.5">
                                        <Info className="size-3 shrink-0" />
                                        {canEdit(promo) ? 'Editar promoción' : 'No se puede editar en este estado'}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {promo.sap_campaign_number ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex">
                                          <Button variant="ghost" size="icon"
                                            className={`size-8 ${canCancel(promo) ? 'text-destructive hover:text-destructive' : 'text-muted-foreground'}`}
                                            onClick={() => canCancel(promo) && handleCancelClick(promo)}
                                            disabled={isLoading || !canCancel(promo)}>
                                            <Ban className="size-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="left">
                                        <div className="flex items-center gap-1.5">
                                          <Info className="size-3 shrink-0" />
                                          {canCancel(promo) ? 'Cancelar en SAP (irreversible)' : 'Ya cancelada en SAP'}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex">
                                          <Button variant="ghost" size="icon"
                                            className={`size-8 ${canDelete(promo) ? 'text-destructive hover:text-destructive' : 'text-muted-foreground'}`}
                                            onClick={() => canDelete(promo) && handleDeleteClick(promo)}
                                            disabled={isLoading || !canDelete(promo)}>
                                            <Trash2 className="size-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="left">
                                        <div className="flex items-center gap-1.5">
                                          <Info className="size-3 shrink-0" />
                                          {canDelete(promo) ? 'Eliminar promoción' : 'No se puede eliminar en este estado'}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <ImportPromotionsModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['promotions'] })}
          onDownloadingChange={setDownloadingTemplate}
          onBusyChange={setParsingFile}
          laboratories={laboratories}
        />

        <SyncFromSapModal
          open={showSyncModal}
          onClose={() => {
            if (syncingFromSap) syncClosedWhileBusy.current = true;
            setShowSyncModal(false);
          }}
          onImported={() => queryClient.invalidateQueries({ queryKey: ['promotions'] })}
          onBusyChange={setSyncingFromSap}
        />

        <PromotionFormSheet
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) setEditingPromo(null);
          }}
          laboratories={laboratories}
          onSuccess={handlePromoSaved}
          editingPromo={editingPromo}
        />

        <PromotionDetailsSheet
          open={detailsSheetOpen}
          onOpenChange={setDetailsSheetOpen}
          promotion={viewingPromo}
          mechanic={viewingPromo?.mechanic || undefined}
          labName={viewingPromo?.laboratory_name || undefined}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esto eliminara la promocion "{promoToDelete?.title}" y su mecanica asociada. Esta accion no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!promoToClone} onOpenChange={(open) => { if (!open && !cloneMutation.isPending) setPromoToClone(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicar promocion?</AlertDialogTitle>
              <AlertDialogDescription>
                Vas a duplicar la promocion "{promoToClone?.title}". Se creara una copia en estado borrador para que puedas revisarla antes de activarla.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cloneMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmClone} disabled={cloneMutation.isPending}>
                {cloneMutation.isPending ? 'Duplicando...' : 'Duplicar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {bulkResult && (
          <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-background shadow-lg p-4 space-y-2 w-72">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Resultado de acción masiva</p>
              <button onClick={() => setBulkResult(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">✓ {bulkResult.success_count} exitosas</span>
              {bulkResult.failure_count > 0 && (
                <span className="text-destructive font-medium">✗ {bulkResult.failure_count} fallidas</span>
              )}
            </div>
            {bulkResult.failure_count > 0 && (
              <ul className="text-xs text-destructive space-y-0.5 max-h-28 overflow-y-auto">
                {bulkResult.results.filter((r) => !r.success).map((r) => (
                  <li key={r.id}>• {r.error ?? 'Error desconocido'}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <AlertDialog open={!!cancelDialogPromo} onOpenChange={(open) => { if (!open && !isCancelling) setCancelDialogPromo(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Ban className="size-4 text-destructive" />
                Cancelar promoción en SAP
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Vas a cancelar la promoción <strong className="text-foreground">"{cancelDialogPromo?.title}"</strong> en SAP (campaña #{cancelDialogPromo?.sap_campaign_number}).
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCancelling}>Cerrar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isCancelling
                  ? <><Loader2 className="mr-2 size-4 animate-spin" />Cancelando...</>
                  : 'Cancelar en SAP'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ErrorDisabledContent>
    </div>
  );
};

export default Promotions;

function PromoFilterSection({
  icon: Icon,
  title,
  children,
}: {
  icon: ElementType;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function PromoFilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
