import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  clonePromotion,
  deletePromotion,
  importPromotions,
  listLaboratories,
  listPromotions,
  updatePromotionStatus,
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
  AlertCircle, Plus, Search, Eye, EyeOff, Pencil, Trash2,
  Tag, Calendar, DollarSign, Zap, Copy, Upload, Columns3, SlidersHorizontal, X, Check
} from 'lucide-react';
import { PromotionFormSheet } from '@/components/promotions/PromotionFormSheet';
import { PromotionDetailsSheet } from '@/components/promotions/PromotionDetailsSheet';
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
import * as XLSX from 'xlsx';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  borrador: { label: 'Borrador', variant: 'outline' },
  revision: { label: 'En Revision', variant: 'secondary' },
  aprobada: { label: 'Aprobada', variant: 'default' },
  activa: { label: 'Activa', variant: 'default' },
  pausada: { label: 'Pausada', variant: 'secondary' },
  finalizada: { label: 'Finalizada', variant: 'outline' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
};

const MECHANIC_LABELS: Record<string, string> = {
  none: 'Sin condicion',
  min_quantity: 'Cantidad minima',
  min_amount: 'Monto Minimo',
  buy_x_get_y: 'Pague X Lleve Y',
  product_mix: 'Mezcla de productos',
  sku_list: 'Pague X Lleve Y',
  category: 'Por Categoria',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [viewingPromo, setViewingPromo] = useState<Promotion | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [laboratoryFilter, setLaboratoryFilter] = useState('all');
  const [mechanicFilter, setMechanicFilter] = useState('all');
  const [showCostColumn, setShowCostColumn] = useState(false);
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
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
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
      && (mechanicFilter === 'all' || (promo.mechanic?.condition_type || 'N/A') === mechanicFilter)
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
    promotions.forEach((promo) => values.add(promo.mechanic?.condition_type || 'N/A'));
    return Array.from(values).sort((a, b) => (MECHANIC_LABELS[a] || a).localeCompare(MECHANIC_LABELS[b] || b));
  }, [promotions]);

  const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== 'all' || laboratoryFilter !== 'all' || mechanicFilter !== 'all';
  const activeCount = filteredPromotions.filter((p) => p.status === 'activa').length;
  const totalEstimatedCost = filteredPromotions.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

  const activeFilterTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (searchQuery.trim()) {
      tags.push({ key: 'search', label: `Busqueda: ${searchQuery.trim()}`, onRemove: () => setSearchQuery('') });
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

  const clearFilters = () => {
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
    const newStatus = promo.status === 'activa' ? 'pausada' : 'activa';
    setTogglingStatusId(promo.id);
    try {
      const updated = await updatePromotionStatus(promo.id, newStatus);
      setPromotions((prev) => prev.map((p) => (p.id === promo.id ? updated : p)));
      toast.success(`Promocion ${newStatus === 'activa' ? 'activada' : 'pausada'}`);
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

  const handleClonePromo = async (promo: Promotion) => {
    setIsCloning(true);
    try {
      await clonePromotion(promo.id);
      toast.success('Promocion duplicada exitosamente');
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al clonar: ${errorMessage}`);
    } finally {
      setIsCloning(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      if (jsonData.length === 0) {
        toast.error('El archivo esta vacio');
        return;
      }

      const expectedColumns = ['Laboratorio', 'Titulo', 'SKU_Condicion', 'Cantidad_Condicion', 'Tipo_Beneficio', 'Valor_Beneficio'];
      const firstRow = jsonData[0];
      const missingColumns = expectedColumns.filter((col) => !(col in firstRow));
      if (missingColumns.length > 0) {
        toast.error(`Columnas faltantes: ${missingColumns.join(', ')}`);
        return;
      }

      const rows = jsonData.map((row) => ({
        laboratory: String(row['Laboratorio'] || ''),
        title: String(row['Titulo'] || 'Sin titulo'),
        sku_condition: String(row['SKU_Condicion'] || ''),
        quantity_condition: Number(row['Cantidad_Condicion']) || 1,
        benefit_type: String(row['Tipo_Beneficio'] || ''),
        benefit_value: Number(row['Valor_Beneficio']) || 0,
      }));

      const result = await importPromotions(rows);
      if (result.imported_count > 0) {
        toast.success(`Se importaron ${result.imported_count} promociones correctamente`);
        fetchData();
      }
      if (result.skipped_count > 0) {
        toast.warning(`Se omitieron ${result.skipped_count} filas. ${(result.errors || []).slice(0, 3).join('; ')}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al importar: ${errorMessage}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

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
      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Gestion de Promociones</h1>
          <p className="text-muted-foreground mt-1">Crea y administra promociones comerciales</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <Button variant="outline" onClick={handleImportClick} disabled={loading || isImporting} className="w-full gap-2">
            <Upload className="h-4 w-4" />
            {isImporting ? 'Importando...' : 'Importar Excel'}
          </Button>
          <Button onClick={() => { setEditingPromo(null); setSheetOpen(true); }} disabled={loading} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Nueva Promocion
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-destructive">Error de Conexion</p>
                <p className="text-sm text-destructive/90">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Promociones Activas</CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? <div className="h-8 bg-muted animate-pulse rounded" /> : <p className="text-2xl font-bold text-foreground">{activeCount}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{hasActiveFilters ? 'Segun filtros aplicados' : 'Vista actual'}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Promociones</CardTitle>
            <Tag className="h-4 w-4 text-primary" />
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
            <DollarSign className="h-4 w-4 text-amber-500" />
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
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por titulo o laboratorio"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={loading}
                className="h-10 bg-background pl-9"
              />
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
                  <Columns3 className="h-4 w-4" />
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
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${showCostColumn ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>
                      {showCostColumn && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-foreground">Costo estimado</span>
                    <span className="text-xs text-muted-foreground">
                      {showCostColumn ? "Visible en la tabla" : "Mostrar columna en la tabla"}
                    </span>
                    </div>
                  </div>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex min-h-7 flex-wrap items-center gap-2 text-sm">
            {activeFilterTags.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filtros aplicados a la informacion cargada en la tabla.</span>
              </div>
            ) : (
              <>
                {activeFilterTags.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={filter.onRemove}
                    disabled={loading}
                    className="inline-flex h-8 max-w-full items-center gap-2 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15"
                    title={`Quitar ${filter.label}`}
                  >
                    <span className="truncate">{filter.label}</span>
                    <X className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 px-2 text-foreground"
                  onClick={clearFilters}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-5 pt-0 sm:px-5">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
          ) : filteredPromotions.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {hasActiveFilters ? 'No se encontraron promociones con esos filtros' : 'No hay promociones registradas'}
              </p>
              {!hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={() => { setEditingPromo(null); setSheetOpen(true); }} disabled={loading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primera promocion
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredPromotions.map((promo) => {
                  const statusConfig = STATUS_CONFIG[promo.status] || STATUS_CONFIG.borrador;
                  const mechanicType = promo.mechanic?.condition_type || 'N/A';
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
                          aria-label={`${promo.status === 'activa' ? 'Pausar' : 'Activar'} promocion`}
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
                        <Button variant="outline" size="icon" className="h-9 w-full" onClick={() => { setViewingPromo(promo); setDetailsSheetOpen(true); }} disabled={loading} title="Ver detalles"><Eye className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="h-9 w-full" onClick={() => handleClonePromo(promo)} disabled={loading || isCloning} title="Duplicar promocion"><Copy className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="h-9 w-full" onClick={() => { setEditingPromo(promo); setSheetOpen(true); }} disabled={loading} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="h-9 w-full text-destructive hover:text-destructive" onClick={() => handleDeleteClick(promo)} disabled={loading} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table className={showCostColumn ? "min-w-[1240px]" : "min-w-[1080px]"}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Activa</TableHead>
                      <TableHead className="min-w-[220px]">Titulo</TableHead>
                      <TableHead className="min-w-[220px]">Laboratorio</TableHead>
                      <TableHead className="w-[180px]">Vigencia</TableHead>
                      <TableHead className="w-[120px]">Estado</TableHead>
                      <TableHead className="w-[170px]">Tipo Mecanica</TableHead>
                      {showCostColumn && <TableHead className="w-[190px] text-right">Costo Estimado</TableHead>}
                      <TableHead className="w-[150px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPromotions.map((promo) => {
                      const statusConfig = STATUS_CONFIG[promo.status] || STATUS_CONFIG.borrador;
                      const mechanicType = promo.mechanic?.condition_type || 'N/A';
                      const isCostHidden = hiddenCostRows.has(promo.id);
                      return (
                        <TableRow key={promo.id}>
                          <TableCell>
                            <Switch
                              checked={promo.status === 'activa'}
                              onCheckedChange={() => handleToggleStatus(promo)}
                              disabled={loading || togglingStatusId === promo.id}
                              aria-label={`${promo.status === 'activa' ? 'Pausar' : 'Activar'} promocion`}
                            />
                          </TableCell>
                          <TableCell className="max-w-[260px] font-medium">
                            <span className="line-clamp-2">{promo.title}</span>
                          </TableCell>
                          <TableCell>{promo.laboratory_name || '—'}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
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
                                  className="h-6 w-6"
                                  onClick={() => toggleRowCostHidden(promo.id)}
                                  disabled={loading}
                                  title={isCostHidden ? 'Mostrar valor' : 'Ocultar valor'}
                                >
                                  {isCostHidden ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                                </Button>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewingPromo(promo); setDetailsSheetOpen(true); }} disabled={loading} title="Ver detalles">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleClonePromo(promo)} disabled={loading || isCloning} title="Duplicar promocion">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingPromo(promo); setSheetOpen(true); }} disabled={loading} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(promo)} disabled={loading} title="Eliminar">
                                <Trash2 className="h-4 w-4" />
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
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Promotions;
