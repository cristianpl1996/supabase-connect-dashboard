import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Promotion, Laboratory, PromoMechanic } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertCircle, Plus, Search, Eye, Pencil, Trash2, 
  Tag, Calendar, DollarSign, Zap, Copy, Upload,
  CheckCircle, XCircle, Clock, Send, Inbox
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface PromotionWithLab extends Promotion {
  laboratories?: { name: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  borrador: { label: 'Borrador', variant: 'outline' },
  pendiente_aprobacion: { label: 'Pendiente Aprobación', variant: 'secondary' },
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

const PromotionsPortal = () => {
  const { isAdmin, isRepresentative, profile } = useAuth();
  
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

  // Admin approval state
  const [activeTab, setActiveTab] = useState('todas');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [promoToReject, setPromoToReject] = useState<Promotion | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let promosQuery = supabase
        .from('promotions')
        .select('*, laboratories(name)')
        .order('created_at', { ascending: false });

      // If representative, only fetch their lab's promotions
      if (isRepresentative && profile?.laboratory_id) {
        promosQuery = promosQuery.eq('lab_id', profile.laboratory_id);
      }
      
      const [promosRes, labsRes] = await Promise.all([
        promosQuery,
        supabase.from('laboratories').select('*').order('name')
      ]);

      if (promosRes.error) throw new Error(`Promociones: ${promosRes.error.message}`);
      if (labsRes.error) throw new Error(`Laboratorios: ${labsRes.error.message}`);

      setPromotions(promosRes.data || []);
      setLaboratories(labsRes.data || []);

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
  }, [isRepresentative, profile?.laboratory_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter promotions based on tab and search
  const filteredPromotions = useMemo(() => {
    let filtered = promotions;

    // Filter by tab (admin only)
    if (isAdmin) {
      if (activeTab === 'pendientes') {
        filtered = filtered.filter(p => p.status === 'pendiente_aprobacion' as const);
      }
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((promo) => {
        const labName = promo.laboratories?.name || '';
        return (
          labName.toLowerCase().includes(query) ||
          promo.title.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [promotions, searchQuery, activeTab, isAdmin]);

  // Counts
  const pendingCount = promotions.filter(p => p.status === 'pendiente_aprobacion' as const).length;
  const activeCount = promotions.filter(p => p.status === 'activa').length;
  const totalEstimatedCost = promotions.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

  const handlePromoSaved = () => {
    setSheetOpen(false);
    setEditingPromo(null);
    fetchData();
  };

  const handleEditPromo = (promo: Promotion) => {
    // Representatives can't edit approved/active promos
    if (isRepresentative && ['aprobada', 'activa', 'finalizada'].includes(promo.status)) {
      toast.error('No puedes editar promociones ya aprobadas o activas');
      return;
    }
    setEditingPromo(promo);
    setSheetOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingPromo(null);
    setSheetOpen(true);
  };

  const handleDeleteClick = (promo: Promotion) => {
    if (isRepresentative && promo.status !== 'borrador') {
      toast.error('Solo puedes eliminar promociones en borrador');
      return;
    }
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

  // Clone promotion
  const handleClonePromo = async (promo: PromotionWithLab) => {
    setIsCloning(true);
    try {
      const nextMonthStart = addMonths(new Date(), 1);
      const nextMonthEnd = addMonths(nextMonthStart, 1);

      const labId = isRepresentative && profile?.laboratory_id 
        ? profile.laboratory_id 
        : promo.lab_id;

      const { data: newPromo, error: promoError } = await supabase
        .from('promotions')
        .insert({
          lab_id: labId,
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
        await supabase.from('promo_mechanics').insert({
          promo_id: newPromo.id,
          condition_type: mechanicToCopy.condition_type,
          condition_config: mechanicToCopy.condition_config,
          reward_type: mechanicToCopy.reward_type,
          reward_config: mechanicToCopy.reward_config,
          accounting_treatment: mechanicToCopy.accounting_treatment,
        });
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

  // Admin: Approve promotion
  const handleApprove = async (promo: Promotion) => {
    setIsProcessing(true);
    try {
      const newStatus = new Date(promo.start_date) <= new Date() ? 'activa' : 'aprobada';
      
      const { error } = await supabase
        .from('promotions')
        .update({ status: newStatus })
        .eq('id', promo.id);

      if (error) throw error;

      toast.success(`Promoción ${newStatus === 'activa' ? 'activada' : 'aprobada'} exitosamente`);
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Admin: Open reject dialog
  const handleRejectClick = (promo: Promotion) => {
    setPromoToReject(promo);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  // Admin: Confirm rejection
  const handleConfirmReject = async () => {
    if (!promoToReject) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ 
          status: 'borrador',
          description: `[RECHAZADA: ${rejectReason}] ${promoToReject.description || ''}`
        })
        .eq('id', promoToReject.id);

      if (error) throw error;

      toast.success('Promoción rechazada y devuelta a borrador');
      setRejectDialogOpen(false);
      setPromoToReject(null);
      setRejectReason('');
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Excel import
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

      for (const row of jsonData) {
        const labName = String(row['Laboratorio'] || '').toLowerCase();
        let labId = labMap.get(labName);

        // For representatives, force their lab
        if (isRepresentative && profile?.laboratory_id) {
          labId = profile.laboratory_id;
        }

        if (!labId) {
          skippedCount++;
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
          continue;
        }

        await supabase.from('promo_mechanics').insert({
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
        toast.warning(`Se omitieron ${skippedCount} filas`);
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

  // Get available labs for representative
  const availableLabs = isRepresentative && profile?.laboratory_id
    ? laboratories.filter(l => l.id === profile.laboratory_id)
    : laboratories;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isRepresentative ? 'Mis Promociones' : 'Gestión de Promociones'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRepresentative 
              ? `Portal de ${profile?.laboratory_name || 'Laboratorio'}`
              : 'Administra y aprueba promociones comerciales'
            }
          </p>
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
            {isRepresentative ? 'Nueva Solicitud' : 'Nueva Promoción'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {isAdmin && (
          <Card className={pendingCount > 0 ? "border-amber-500/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendientes de Aprobación
              </CardTitle>
              <Inbox className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Promociones Activas
            </CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isRepresentative ? 'Mis Promociones' : 'Total Promociones'}
            </CardTitle>
            <Tag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{promotions.length}</p>
          </CardContent>
        </Card>

        {!isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Costo Estimado Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totalEstimatedCost)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Promotions Table with Tabs (Admin) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <CardTitle>Promociones</CardTitle>
            </div>
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
        </CardHeader>
        <CardContent>
          {isAdmin && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
              <TabsList>
                <TabsTrigger value="todas" className="gap-2">
                  <Tag className="h-4 w-4" />
                  Todas
                </TabsTrigger>
                <TabsTrigger value="pendientes" className="gap-2">
                  <Inbox className="h-4 w-4" />
                  Por Aprobar
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

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
                {activeTab === 'pendientes' 
                  ? 'No hay promociones pendientes de aprobación'
                  : searchQuery 
                    ? 'No se encontraron promociones' 
                    : 'No hay promociones registradas'
                }
              </p>
              {!searchQuery && activeTab !== 'pendientes' && (
                <Button variant="outline" className="mt-4" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  {isRepresentative ? 'Crear solicitud' : 'Crear primera promoción'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Laboratorio</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tipo Mecánica</TableHead>
                  <TableHead className="text-right">Costo Estimado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPromotions.map((promo) => {
                  const statusConfig = STATUS_CONFIG[promo.status] || STATUS_CONFIG.borrador;
                  const promoMechanics = mechanics[promo.id] || [];
                  const mechanicType = promoMechanics[0]?.condition_type || 'N/A';
                          const canEdit = isAdmin || (isRepresentative && ['borrador', 'pendiente_aprobacion'].includes(promo.status as string));
                          const canDelete = isAdmin || (isRepresentative && promo.status === 'borrador');
                          const isPending = promo.status === 'pendiente_aprobacion';
                          
                          return (
                            <TableRow key={promo.id}>
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
                      <TableCell className="text-right font-mono">
                        {formatCurrency(promo.estimated_cost || 0)}
                      </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {/* Admin approval buttons */}
                            {isAdmin && isPending && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleApprove(promo)}
                                disabled={isProcessing}
                                title="Aprobar"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleRejectClick(promo)}
                                disabled={isProcessing}
                                title="Rechazar"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          
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
                            title="Duplicar"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditPromo(promo)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(promo)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Form Sheet */}
      <PromotionFormSheet 
        open={sheetOpen} 
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditingPromo(null);
        }}
        laboratories={availableLabs}
        onSuccess={handlePromoSaved}
        editingPromo={editingPromo}
        forceStatus={isRepresentative ? 'pendiente_aprobacion' : undefined}
        submitLabel={isRepresentative ? 'Enviar a Aprobación' : undefined}
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
              Esto eliminará la promoción "{promoToDelete?.title}". Esta acción no se puede deshacer.
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

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Promoción</DialogTitle>
            <DialogDescription>
              Indica el motivo del rechazo para "{promoToReject?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motivo del rechazo..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmReject}
              disabled={!rejectReason.trim() || isProcessing}
            >
              {isProcessing ? 'Procesando...' : 'Rechazar y Devolver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PromotionsPortal;
