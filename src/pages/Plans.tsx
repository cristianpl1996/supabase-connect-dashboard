import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { AnnualPlan, Laboratory } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, TrendingUp, FileText, Plus, DollarSign, Pencil, Trash2, Eye, EyeOff, Search, Columns3 } from 'lucide-react';
import { PlanFormSheet } from '@/components/plans/PlanFormSheet';
import { PlanDetailsSheet } from '@/components/plans/PlanDetailsSheet';
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

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  activo: { label: 'Activo', variant: 'default' },
  negociacion: { label: 'En Negociación', variant: 'secondary' },
  cerrado: { label: 'Cerrado', variant: 'outline' },
};

const Plans = () => {
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AnnualPlan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<AnnualPlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [viewingPlan, setViewingPlan] = useState<AnnualPlan | null>(null);

  // Column visibility & row-level hiding
  const [showGoalColumn, setShowGoalColumn] = useState(true);
  const [showBudgetColumn, setShowBudgetColumn] = useState(true);
  const [allGoalsHidden, setAllGoalsHidden] = useState(false);
  const [allBudgetsHidden, setAllBudgetsHidden] = useState(false);
  const [hiddenGoalRows, setHiddenGoalRows] = useState<Set<string>>(new Set());
  const [hiddenBudgetRows, setHiddenBudgetRows] = useState<Set<string>>(new Set());

  // Toggle status loading
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [plansRes, labsRes] = await Promise.all([
        supabase.from('annual_plans').select('*').order('year', { ascending: false }),
        supabase.from('laboratories').select('*').order('name')
      ]);

      if (plansRes.error) throw new Error(`Planes: ${plansRes.error.message}`);
      if (labsRes.error) throw new Error(`Laboratorios: ${labsRes.error.message}`);

      setPlans(plansRes.data || []);
      setLaboratories(labsRes.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setError(`Error de red/CORS: No se pudo conectar a Supabase. Detalles: ${errorMessage}`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const labMap = useMemo(() => {
    return laboratories.reduce((acc, lab) => {
      acc[lab.id] = lab.name;
      return acc;
    }, {} as Record<string, string>);
  }, [laboratories]);

  const filteredPlans = useMemo(() => {
    if (!searchQuery.trim()) return plans;
    
    const query = searchQuery.toLowerCase();
    return plans.filter((plan) => {
      const labName = labMap[plan.lab_id] || '';
      return (
        labName.toLowerCase().includes(query) ||
        plan.name.toLowerCase().includes(query)
      );
    });
  }, [plans, searchQuery, labMap]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePlanSaved = () => {
    setSheetOpen(false);
    setEditingPlan(null);
    fetchData();
  };

  const handleEditPlan = (plan: AnnualPlan) => {
    setEditingPlan(plan);
    setSheetOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setSheetOpen(true);
  };

  const handleDeleteClick = (plan: AnnualPlan) => {
    setPlanToDelete(plan);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!planToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('annual_plans')
        .delete()
        .eq('id', planToDelete.id);

      if (error) throw error;

      toast.success('Plan eliminado exitosamente');
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al eliminar: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    }
  };

  const handleViewPlan = (plan: AnnualPlan) => {
    setViewingPlan(plan);
    setDetailsSheetOpen(true);
  };

  const handleToggleStatus = async (plan: AnnualPlan) => {
    const newStatus = plan.status === 'activo' ? 'cerrado' : 'activo';
    setTogglingStatusId(plan.id);
    try {
      const { error } = await supabase
        .from('annual_plans')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', plan.id);

      if (error) throw error;

      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: newStatus } : p));
      toast.success(`Plan ${newStatus === 'activo' ? 'activado' : 'desactivado'}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al cambiar estado: ${errorMessage}`);
    } finally {
      setTogglingStatusId(null);
    }
  };

  const toggleRowGoalHidden = (planId: string) => {
    setHiddenGoalRows(prev => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const toggleRowBudgetHidden = (planId: string) => {
    setHiddenBudgetRows(prev => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const totalPurchaseGoal = plans.reduce((sum, plan) => sum + (plan.total_purchase_goal || 0), 0);
  const totalBudget = plans.reduce((sum, plan) => sum + (plan.total_budget_allocated || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bóveda de Acuerdos</h1>
            <p className="text-muted-foreground mt-1">Gestión de Planes Anuales por Laboratorio</p>
          </div>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Plan Año
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-destructive">Error de Conexión</p>
                  <p className="text-sm text-destructive/90 whitespace-pre-wrap">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Meta Total de Compras
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalPurchaseGoal)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Presupuesto Total Asignado
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalBudget)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle>Planes Anuales</CardTitle>
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
                      checked={showGoalColumn}
                      onCheckedChange={setShowGoalColumn}
                    >
                      Meta de Compra
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={showBudgetColumn}
                      onCheckedChange={setShowBudgetColumn}
                    >
                      Presupuesto
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar laboratorio..."
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
            ) : filteredPlans.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No se encontraron planes con ese criterio' : 'No hay planes anuales registrados'}
                </p>
                {!searchQuery && (
                  <Button variant="outline" className="mt-4" onClick={handleOpenCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear primer plan
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Activo</TableHead>
                    <TableHead>Nombre del Plan</TableHead>
                    <TableHead>Año</TableHead>
                    <TableHead>Estado</TableHead>
                    {showGoalColumn && (
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Meta de Compra</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setAllGoalsHidden(prev => !prev);
                              setHiddenGoalRows(new Set());
                            }}
                            title={allGoalsHidden ? 'Mostrar todos' : 'Ocultar todos'}
                          >
                            {allGoalsHidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                          </Button>
                        </div>
                      </TableHead>
                    )}
                    {showBudgetColumn && (
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Presupuesto</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setAllBudgetsHidden(prev => !prev);
                              setHiddenBudgetRows(new Set());
                            }}
                            title={allBudgetsHidden ? 'Mostrar todos' : 'Ocultar todos'}
                          >
                            {allBudgetsHidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                          </Button>
                        </div>
                      </TableHead>
                    )}
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => {
                    const statusConfig = STATUS_CONFIG[plan.status] || STATUS_CONFIG.activo;
                    const isGoalHidden = allGoalsHidden ? !hiddenGoalRows.has(plan.id) : hiddenGoalRows.has(plan.id);
                    const isBudgetHidden = allBudgetsHidden ? !hiddenBudgetRows.has(plan.id) : hiddenBudgetRows.has(plan.id);
                    
                    return (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <Switch
                            checked={plan.status === 'activo'}
                            onCheckedChange={() => handleToggleStatus(plan)}
                            disabled={togglingStatusId === plan.id}
                            aria-label={`${plan.status === 'activo' ? 'Desactivar' : 'Activar'} plan`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{plan.year}</TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        {showGoalColumn && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-mono">
                                {isGoalHidden ? '••••••' : formatCurrency(plan.total_purchase_goal || 0)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleRowGoalHidden(plan.id)}
                                title={isGoalHidden ? 'Mostrar valor' : 'Ocultar valor'}
                              >
                                {isGoalHidden ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                        {showBudgetColumn && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-mono">
                                {isBudgetHidden ? '••••••' : formatCurrency(plan.total_budget_allocated || 0)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleRowBudgetHidden(plan.id)}
                                title={isBudgetHidden ? 'Mostrar valor' : 'Ocultar valor'}
                              >
                                {isBudgetHidden ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
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
                              onClick={() => handleViewPlan(plan)}
                              title="Ver detalles"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditPlan(plan)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(plan)}
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
      <PlanFormSheet 
        open={sheetOpen} 
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditingPlan(null);
        }}
        laboratories={laboratories}
        onSuccess={handlePlanSaved}
        editingPlan={editingPlan}
      />

      {/* Details Sheet */}
      <PlanDetailsSheet
        open={detailsSheetOpen}
        onOpenChange={setDetailsSheetOpen}
        plan={viewingPlan}
        labName={viewingPlan ? labMap[viewingPlan.lab_id] : undefined}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará el plan "{planToDelete?.name}" y todos sus fondos asignados. Esta acción no se puede deshacer.
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

export default Plans;
