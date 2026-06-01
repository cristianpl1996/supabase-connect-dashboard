import { useEffect, useState, useCallback, useMemo } from 'react';

const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });
import {
  clonePromotion,
  deletePromotion,
  getSapAutoSyncStatus,
  listLaboratories,
  listPromotions,
  updatePromotionStatus,
  SapAutoSyncStatus,
} from '@/lib/api';
import { Promotion, Laboratory } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Eye, EyeOff, Pencil, Trash2,
  Tag, Calendar, DollarSign, Zap, Copy, Upload, Columns3, SlidersHorizontal, X, Check, Loader2, RefreshCw,
  AlertTriangle, XCircle, CheckCircle2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { PromotionFormSheet } from '@/components/promotions/PromotionFormSheet';
import { PromotionDetailsSheet } from '@/components/promotions/PromotionDetailsSheet';
import { ImportPromotionsModal } from '@/components/promotions/ImportPromotionsModal';
import SyncFromSapModal from '@/components/promotions/SyncFromSapModal';
import { SapStatusBadge } from '@/components/promotions/SapStatusBadge';
import { ModuleErrorCard } from '@/components/common/ModuleErrorCard';
import { ErrorDisabledContent } from '@/components/common/ErrorDisabledContent';
import { PageHeader } from '@/components/common/PageHeader';
import { formatApiErrorMessage } from '@/lib/errors';
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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState<Promotion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [viewingPromo, setViewingPromo] = useState<Promotion | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [promoToClone, setPromoToClone] = useState<Promotion | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [laboratoryFilter, setLaboratoryFilter] = useState('all');
  const [mechanicFilter, setMechanicFilter] = useState('all');
  const [showCostColumn, setShowCostColumn] = useState(false);
  const [showSapColumn, setShowSapColumn] = useState(true);
  const [autoSyncStatus, setAutoSyncStatus] = useState<SapAutoSyncStatus | null>(null);
  const [hiddenCostRows, setHiddenCostRows] = useState<Set<string>>(new Set());
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [promosData, labsData] = await Promise.all([listPromotions(), listLaboratories()]);
      setPromotions(promosData || []);
      setLaboratories(labsData || []);
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
    getSapAutoSyncStatus().then(setAutoSyncStatus).catch(() => null);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPromotions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return promotions.filter((promo) => (
      (!query.trim()
        || (promo.laboratory_name || '').toLowerCase().includes(query)
        || promo.title.toLowerCase().includes(query))
      && (statusFilter === 'all' || promo.status === statusFilter)
      && (laboratoryFilter === 'all' || (promo.laboratory_name || 'Sin laboratorio') === laboratoryFilter)
      && (mechanicFilter === 'all' || (promo.mechanic?.promotion_type || 'N/A') === mechanicFilter)
    ));
  }, [laboratoryFilter, mechanicFilter, promotions, searchQuery, statusFilter]);

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

  const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== 'all' || laboratoryFilter !== 'all' || mechanicFilter !== 'all';
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
      tags.push({ key: 'laboratory', label: `Marca: ${laboratoryFilter}`, onRemove: () => setLaboratoryFilter('all') });
    }
    if (mechanicFilter !== 'all') {
      tags.push({ key: 'mechanic', label: `Mecanica: ${MECHANIC_LABELS[mechanicFilter] || mechanicFilter}`, onRemove: () => setMechanicFilter('all') });
    }
    return tags;
  }, [laboratoryFilter, mechanicFilter, searchQuery, statusFilter]);

  const commitSearch = () => setSearchQuery(searchInput.trim());

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setStatusFilter('all');
    setLaboratoryFilter('all');
    setMechanicFilter('all');
  };

  const handlePromoSaved = () => {
    setSheetOpen(false);
    setEditingPromo(null);
    fetchData();
  };

  const handleDeleteClick = (promo: Promotion) => {
    setPromoToDelete(promo);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!promoToDelete) return;
    setIsDeleting(true);
    try {
      await deletePromotion(promoToDelete.id);
      toast.success('Promocion eliminada exitosamente');
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al eliminar: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setPromoToDelete(null);
    }
  };

  const handleToggleStatus = async (promo: Promotion) => {
    const newStatus = promo.status === 'activa' ? 'borrador' : 'activa';
    setTogglingStatusId(promo.id);
    try {
      const updated = await updatePromotionStatus(promo.id, newStatus);
      setPromotions((prev) => prev.map((p) => (p.id === promo.id ? updated : p)));
      toast.success(`Promocion ${newStatus === 'activa' ? 'activada' : 'desactivada'}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al cambiar estado: ${errorMessage}`);
    } finally {
      setTogglingStatusId(null);
    }
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

  const handleConfirmClone = async () => {
    if (!promoToClone) return;
    setIsCloning(true);
    try {
      await clonePromotion(promoToClone.id);
      toast.success('Promocion duplicada exitosamente');
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al clonar: ${errorMessage}`);
    } finally {
      setIsCloning(false);
      setPromoToClone(null);
    }
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

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 sm:space-y-8">
      <ErrorDisabledContent disabled={!!error}>
        <PageHeader
          icon={Tag}
          title="Gestion de Promociones"
          description="Crea y administra promociones comerciales"
          actions={(
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto">
              <Button variant="outline" onClick={() => setShowSyncModal(true)} disabled={loading} className="w-full gap-2">
                <RefreshCw className="size-4" />
                Sincronizar SAP
              </Button>
              <Button variant="outline" onClick={() => setShowImportModal(true)} disabled={loading} className="w-full gap-2">
                {(downloadingTemplate || parsingFile) ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Importar Excel
              </Button>
              <Button onClick={() => { setEditingPromo(null); setSheetOpen(true); }} disabled={loading} className="w-full gap-2">
                <Plus className="size-4" />
                Nueva Promocion
              </Button>
            </div>
          )}
        />
      </ErrorDisabledContent>

      {error && (
        <ModuleErrorCard message={error} onRetry={fetchData} loading={loading} />
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

      <ErrorDisabledContent disabled={!!error} className="space-y-6 sm:space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Promociones Activas</CardTitle>
              <Zap className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {loading ? <div className="h-8 bg-muted animate-pulse rounded" /> : <p className="text-2xl font-bold text-foreground">{activeCount}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{hasActiveFilters ? 'Segun filtros aplicados' : 'Vista actual'}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Promociones</CardTitle>
              <Tag className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
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
              {loading ? (
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
            <div className="grid gap-3 md:grid-cols-[minmax(240px,1.5fr)_repeat(3,minmax(160px,1fr))_auto]">
              <div className="relative min-w-0">
                <button type="button" onClick={commitSearch} disabled={loading} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">
                  <Search className="size-4" />
                </button>
                <Input
                  placeholder="Buscar por titulo o laboratorio"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
                  disabled={loading}
                  className="h-10 bg-background pl-9 pr-9"
                />
                {searchQuery && (
                  <button type="button" onClick={() => { setSearchInput(''); setSearchQuery(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-destructive">
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={loading}>
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
              <Select value={laboratoryFilter} onValueChange={setLaboratoryFilter} disabled={loading}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Laboratorio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los laboratorios</SelectItem>
                  {laboratoryOptions.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={mechanicFilter} onValueChange={setMechanicFilter} disabled={loading}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Mecanica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las mecanicas</SelectItem>
                  {mechanicOptions.map((value) => (
                    <SelectItem key={value} value={value}>{MECHANIC_LABELS[value] || value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 w-full gap-2 md:w-44" disabled={loading}>
                    <Columns3 className="size-4" />
                    Columnas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-50 w-64 border border-border bg-popover p-2 shadow-md">
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
                    disabled={loading}
                    className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15"
                  >
                    <span className="truncate">{filter.label}</span>
                    <X className="size-3 shrink-0" />
                  </button>
                ))}
                <button type="button" onClick={clearFilters} disabled={loading} className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground">
                  <X className="size-3" /> Limpiar
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-0 sm:px-5">
            {loading ? (
                <div className="space-y-3">{["promotion-1", "promotion-2", "promotion-3"].map((slot) => <div key={slot} className="h-12 bg-muted animate-pulse rounded" />)}</div>
            ) : filteredPromotions.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="size-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {hasActiveFilters ? 'No se encontraron promociones con los filtros aplicados' : 'No hay promociones registradas'}
                </p>
                {hasActiveFilters ? (
                  <Button variant="outline" className="mt-4" onClick={clearFilters} disabled={loading}>
                    <X className="size-4 mr-2" />
                    Limpiar filtros
                  </Button>
                ) : (
                  <Button variant="outline" className="mt-4" onClick={() => { setEditingPromo(null); setSheetOpen(true); }} disabled={loading}>
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
                            disabled={loading || togglingStatusId === promo.id}
                            aria-label={`${promo.status === 'activa' ? 'Desactivar' : 'Activar'} promocion`}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                          <Badge variant="outline" className="font-normal">{MECHANIC_LABELS[mechanicType] || mechanicType}</Badge>
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
                          <Button variant="outline" size="icon" className="h-9 w-full" onClick={() => { setViewingPromo(promo); setDetailsSheetOpen(true); }} disabled={loading} title="Ver detalles"><Eye className="size-4" /></Button>
                          <Button variant="outline" size="icon" className="h-9 w-full" onClick={() => handleCloneClick(promo)} disabled={loading || isCloning} title="Duplicar promocion"><Copy className="size-4" /></Button>
                          <Button variant="outline" size="icon" className="h-9 w-full" onClick={() => { setEditingPromo(promo); setSheetOpen(true); }} disabled={loading} title="Editar"><Pencil className="size-4" /></Button>
                          <Button variant="outline" size="icon" className="h-9 w-full text-destructive hover:text-destructive" onClick={() => handleDeleteClick(promo)} disabled={loading} title="Eliminar"><Trash2 className="size-4" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <Table className={showCostColumn && showSapColumn ? "min-w-[1380px]" : showCostColumn || showSapColumn ? "min-w-[1220px]" : "min-w-[1080px]"}>
                    <TableHeader>
                      <TableRow>
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
                        return (
                          <TableRow key={promo.id}>
                            <TableCell>
                              <Switch
                                checked={promo.status === 'activa'}
                                onCheckedChange={() => handleToggleStatus(promo)}
                                disabled={loading || togglingStatusId === promo.id}
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
                                    disabled={loading}
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
                                />
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="size-8" onClick={() => { setViewingPromo(promo); setDetailsSheetOpen(true); }} disabled={loading} title="Ver detalles">
                                  <Eye className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="size-8" onClick={() => handleCloneClick(promo)} disabled={loading || isCloning} title="Duplicar promocion">
                                  <Copy className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditingPromo(promo); setSheetOpen(true); }} disabled={loading} title="Editar">
                                  <Pencil className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(promo)} disabled={loading} title="Eliminar">
                                  <Trash2 className="size-4" />
                                </Button>
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
          onSuccess={fetchData}
          onDownloadingChange={setDownloadingTemplate}
          onBusyChange={setParsingFile}
          laboratories={laboratories}
        />

        <SyncFromSapModal
          open={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          onImported={fetchData}
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
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Eliminando…' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!promoToClone} onOpenChange={(open) => { if (!open && !isCloning) setPromoToClone(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicar promocion?</AlertDialogTitle>
              <AlertDialogDescription>
                Vas a duplicar la promocion "{promoToClone?.title}". Se creara una copia en estado borrador para que puedas revisarla antes de activarla.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCloning}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmClone} disabled={isCloning}>
                {isCloning ? 'Duplicando...' : 'Duplicar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ErrorDisabledContent>
    </div>
  );
};

export default Promotions;
