import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AnnualPlan, Laboratory } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, FileText, Plus, DollarSign } from 'lucide-react';
import { PlanFormSheet } from '@/components/plans/PlanFormSheet';
import { toast } from 'sonner';

const Plans = () => {
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePlanCreated = () => {
    setSheetOpen(false);
    fetchData();
    toast.success('Plan creado exitosamente');
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
          <Button onClick={() => setSheetOpen(true)} className="gap-2">
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
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Planes Anuales</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No hay planes anuales registrados</p>
                <Button variant="outline" className="mt-4" onClick={() => setSheetOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer plan
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Plan</TableHead>
                    <TableHead>Año</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Meta de Compra</TableHead>
                    <TableHead className="text-right">Presupuesto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>{plan.year}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {plan.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(plan.total_purchase_goal || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(plan.total_budget_allocated || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Sheet */}
      <PlanFormSheet 
        open={sheetOpen} 
        onOpenChange={setSheetOpen}
        laboratories={laboratories}
        onSuccess={handlePlanCreated}
      />
    </div>
  );
};

export default Plans;
