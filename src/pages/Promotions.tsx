import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Promotion, Laboratory, PromoMechanic } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  AlertCircle, Plus, Search, Eye, EyeOff, Pencil, Trash2, 
  Tag, Calendar, DollarSign, Zap, Copy, Upload, Columns3 
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
import { format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

// Extended type with lab info
interface PromotionWithLab extends Promotion {
  laboratories?: { name: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  borrador: { label: 'Borrador', variant: 'outline' },
  revision: { label: 'En Revisión', variant: 'secondary' },
  aprobada: { label: 'Aprobada', variant: 'default' },
  activa: { label: 'Activa', variant: 'default' },
  pausada: { label: 'Pausada', variant: 'secondary' },
  finalizada: { label: 'Finalizada', variant: 'outline' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
};

const MECHANIC_LABELS: Record<string, string> = {
  sku_list: 'Pague X Lleve Y',
  min_amount: 'Monto Mínimo',
  category: 'Por Categoría',
};

const Promotions = () => {
  const [promotions, setPromotions] = useState<PromotionWithLab[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [mechanics, setMechanics] = useState<Record<string, PromoMechanic[]>>({});
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

  // Column visibility & row-level hiding
  const [showCostColumn, setShowCostColumn] = useState(true);
  const [hiddenCostRows, setHiddenCostRows] = useState<Set<string>>(new Set());

  // Toggle status loading
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [promosRes, labsRes] = await Promise.all([
        supabase
          .from('promotions')
          .select('*, laboratories(name)')
          .order('created_at', { ascending: false }),
        supabase.from('laboratories').select('*').order('name')
      ]);

      if (promosRes.error) throw new Error(`Promociones: ${promosRes.error.message}`);
      if (labsRes.error) throw new Error(`Laboratorios: ${labsRes.error.message}`);

      setPromotions(promosRes.data || []);
      setLaboratories(labsRes.data || []);

      // Fetch mechanics for all promotions
      if (promosRes.data && promosRes.data.length > 0) {
        const promoIds = promosRes.data.map(p => p.id);
        const { data: mechanicsData } = await supabase
          .from('promo_mechanics')
          .select('*')
          .in('promo_id', promoIds);

        if (mechanicsData) {
          const mechanicsMap: Record<string, PromoMechanic[]> = {};
          mechanicsData.forEach(m => {
            if (!mechanicsMap[m.promo_id]) {
              mechanicsMap[m.promo_id] = [];
            }
            mechanicsMap[m.promo_id].push(m);
          });
          setMechanics(mechanicsMap);
        }
      }
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

  // Filter promotions
  const filteredPromotions = useMemo(() => {
    if (!searchQuery.trim()) return promotions;
    
    const query = searchQuery.toLowerCase();
    return promotions.filter((promo) => {
      const labName = promo.laboratories?.name || '';
      return (
        labName.toLowerCase().includes(query) ||
        promo.title.toLowerCase().includes(query)
      );
    });
  }, [promotions, searchQuery]);

  // Summary stats
  const activeCount = promotions.filter(p => p.status === 'activa').length;
  const totalEstimatedCost = promotions.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

  const handlePromoSaved = () => {
    setSheetOpen(false);
    setEditingPromo(null);
    fetchData();
  };

  const handleEditPromo = (promo: Promotion) => {
    setEditingPromo(promo);
    setSheetOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingPromo(null);
    setSheetOpen(true);
  };

  const handleDeleteClick = (promo: Promotion) => {
    setPromoToDelete(promo);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!promoToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', promoToDelete.id);

      if (error) throw error;

      toast.success('Promoción eliminada exitosamente');
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

  const handleViewPromo = (promo: Promotion) => {
    setViewingPromo(promo);
    setDetailsSheetOpen(true);
  };

  const handleToggleStatus = async (promo: Promotion) => {
    const newStatus = promo.status === 'activa' ? 'pausada' : 'activa';
    setTogglingStatusId(promo.id);
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ status: newStatus })
        .eq('id', promo.id);

      if (error) throw error;

      setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, status: newStatus } as PromotionWithLab : p));
      toast.success(`Promoción ${newStatus === 'activa' ? 'activada' : 'pausada'}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al cambiar estado: ${errorMessage}`);
    } finally {
      setTogglingStatusId(null);
    }
  };

  const toggleRowCostHidden = (promoId: string) => {
    setHiddenCostRows(prev => {
      const next = new Set(prev);
      if (next.has(promoId)) next.delete(promoId);
      else next.add(promoId);
      return next;
    });
  };

  // Clone/Duplicate promotion
  const handleClonePromo = async (promo: PromotionWithLab) => {
    setIsCloning(true);
    try {
      const nextMonthStart = addMonths(new Date(), 1);
      const nextMonthEnd = addMonths(nextMonthStart, 1);

      const { data: newPromo, error: promoError } = await supabase
        .from('promotions')
        .insert({
          lab_id: promo.lab_id,
          title: `Copia de ${promo.title}`,
          start_date: format(nextMonthStart, 'yyyy-MM-dd'),
          end_date: format(nextMonthEnd, 'yyyy-MM-dd'),
          status: 'borrador',
          target_segment: promo.target_segment,
          estimated_cost: promo.estimated_cost,
        })
        .select()
        .single();

      if (promoError) throw promoError;

      const promoMechanics = mechanics[promo.id];
      if (promoMechanics && promoMechanics.length > 0) {
        const mechanicToCopy = promoMechanics[0];
        const { error: mechError } = await supabase
          .from('promo_mechanics')
          .insert({
            promo_id: newPromo.id,
            condition_type: mechanicToCopy.condition_type,
            condition_config: mechanicToCopy.condition_config,
            reward_type: mechanicToCopy.reward_type,
            reward_config: mechanicToCopy.reward_config,
            accounting_treatment: mechanicToCopy.accounting_treatment,
          });

        if (mechError) {
          console.error('Error copying mechanics:', mechError);
        }
      }

      toast.success('Promoción duplicada exitosamente');
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al clonar: ${errorMessage}`);
    } finally {
      setIsCloning(false);
    }
  };

  // Excel import handling
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
        toast.error('El archivo está vacío');
        return;
      }

      const expectedColumns = ['Laboratorio', 'Titulo', 'SKU_Condicion', 'Cantidad_Condicion', 'Tipo_Beneficio', 'Valor_Beneficio'];
      const firstRow = jsonData[0];
      const missingColumns = expectedColumns.filter(col => !(col in firstRow));
      
      if (missingColumns.length > 0) {
        toast.error(`Columnas faltantes: ${missingColumns.join(', ')}`);
        return;
      }

      const labMap = new Map(laboratories.map(lab => [lab.name.toLowerCase(), lab.id]));

      let importedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const row of jsonData) {
        const labName = String(row['Laboratorio'] || '').toLowerCase();
        const labId = labMap.get(labName);

        if (!labId) {
          skippedCount++;
          errors.push(`Lab no encontrado: ${row['Laboratorio']}`);
          continue;
        }

        let rewardType = 'free_product';
        const benefitType = String(row['Tipo_Beneficio'] || '').toLowerCase();
        if (benefitType.includes('descuento') || benefitType.includes('%')) {
          rewardType = 'discount_percent';
        } else if (benefitType.includes('precio')) {
          rewardType = 'special_price';
        }

        const nextMonth = addMonths(new Date(), 1);
        const { data: newPromo, error: promoError } = await supabase
          .from('promotions')
          .insert({
            lab_id: labId,
            title: String(row['Titulo'] || 'Sin título'),
            start_date: format(nextMonth, 'yyyy-MM-dd'),
            end_date: format(addMonths(nextMonth, 1), 'yyyy-MM-dd'),
            status: 'borrador',
            target_segment: { type: 'all' },
            estimated_cost: 0,
          })
          .select()
          .single();

        if (promoError) {
          skippedCount++;
          errors.push(`Error en fila: ${promoError.message}`);
          continue;
        }

        await supabase
          .from('promo_mechanics')
          .insert({
            promo_id: newPromo.id,
            condition_type: 'sku_list',
            condition_config: { 
              skus: String(row['SKU_Condicion'] || '').split(',').map(s => s.trim()),
              quantity: Number(row['Cantidad_Condicion']) || 1
            },
            reward_type: rewardType,
            reward_config: { value: Number(row['Valor_Beneficio']) || 0 },
            accounting_treatment: 'bonificacion_precio_cero',
          });

        importedCount++;
      }

      if (importedCount > 0) {
        toast.success(`Se importaron ${importedCount} promociones correctamente`);
        fetchData();
      }
      
      if (skippedCount > 0) {
        toast.warning(`Se omitieron ${skippedCount} filas. ${errors.slice(0, 3).join('; ')}`);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestión de Promociones</h1>
            <p className="text-muted-foreground mt-1">Crea y administra promociones comerciales</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <Button 
              variant="outline" 
              onClick={handleImportClick}
              disabled={isImporting}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {isImporting ? 'Importando...' : 'Importar Excel'}
            </Button>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Promoción
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-destructive">Error de Conexión</p>
                  <p className="text-sm text-destructive/90">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Promociones Activas
              </CardTitle>
              <Zap className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Promociones
              </CardTitle>
              <Tag className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{promotions.length}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Costo Estimado Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalEstimatedCost)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Promotions Table */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                <CardTitle>Promociones</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {/* Column visibility dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Columns3 className="h-4 w-4" />
                      Columnas
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border border-border shadow-md z-50">
                    <DropdownMenuCheckboxItem
                      checked={showCostColumn}
                      onCheckedChange={setShowCostColumn}
                    >
                      Costo Estimado
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar promoción..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : filteredPromotions.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No se encontraron promociones' : 'No hay promociones registradas'}
                </p>
                {!searchQuery && (
                  <Button variant="outline" className="mt-4" onClick={handleOpenCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear primera promoción
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Activa</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Laboratorio</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tipo Mecánica</TableHead>
                    {showCostColumn && <TableHead className="text-right">Costo Estimado</TableHead>}
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromotions.map((promo) => {
                    const statusConfig = STATUS_CONFIG[promo.status] || STATUS_CONFIG.borrador;
                    const promoMechanics = mechanics[promo.id] || [];
                    const mechanicType = promoMechanics[0]?.condition_type || 'N/A';
                    const isCostHidden = hiddenCostRows.has(promo.id);
                    
                    return (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <Switch
                            checked={promo.status === 'activa'}
                            onCheckedChange={() => handleToggleStatus(promo)}
                            disabled={togglingStatusId === promo.id}
                            aria-label={`${promo.status === 'activa' ? 'Pausar' : 'Activar'} promoción`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{promo.title}</TableCell>
                        <TableCell>{promo.laboratories?.name || '—'}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDateRange(promo.start_date, promo.end_date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {MECHANIC_LABELS[mechanicType] || mechanicType}
                          </Badge>
                        </TableCell>
                        {showCostColumn && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-mono">
                                {isCostHidden ? '••••••' : formatCurrency(promo.estimated_cost || 0)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleRowCostHidden(promo.id)}
                                title={isCostHidden ? 'Mostrar valor' : 'Ocultar valor'}
                              >
                                {isCostHidden ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleViewPromo(promo)}
                              title="Ver detalles"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleClonePromo(promo)}
                              disabled={isCloning}
                              title="Duplicar promoción"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditPromo(promo)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(promo)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Sheet */}
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

      {/* Details Sheet */}
      <PromotionDetailsSheet
        open={detailsSheetOpen}
        onOpenChange={setDetailsSheetOpen}
        promotion={viewingPromo}
        mechanic={viewingPromo ? mechanics[viewingPromo.id]?.[0] : undefined}
        labName={viewingPromo ? (viewingPromo as PromotionWithLab).laboratories?.name : undefined}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará la promoción "{promoToDelete?.title}" y su mecánica asociada. Esta acción no se puede deshacer.
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
