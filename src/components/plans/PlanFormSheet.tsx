import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Laboratory, AnnualPlan, PlanFund } from '@/types/database';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ContractDropzone } from './ContractDropzone';

interface PlanFundInput {
  id: string;
  dbId?: string; // ID from database for existing funds
  concept: string;
  amount_type: 'fijo' | 'porcentaje';
  amount_value: number;
}

interface PlanFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laboratories: Laboratory[];
  onSuccess: () => void;
  editingPlan?: AnnualPlan | null;
}

const FUND_CONCEPTS = [
  'Rebate Sell-In',
  'Rebate Sell-Out',
  'Marketing',
  'Pronto Pago',
  'Coop',
  'Otro',
];

export function PlanFormSheet({ open, onOpenChange, laboratories, onSuccess, editingPlan }: PlanFormSheetProps) {
  const currentYear = new Date().getFullYear();
  const isEditing = !!editingPlan;
  
  // Form state
  const [labId, setLabId] = useState('');
  const [labNameFromAI, setLabNameFromAI] = useState('');
  const [year, setYear] = useState(currentYear + 1);
  const [purchaseGoal, setPurchaseGoal] = useState<number>(0);
  const [funds, setFunds] = useState<PlanFundInput[]>([]);
  const [originalFundIds, setOriginalFundIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingFunds, setIsLoadingFunds] = useState(false);

  // Load existing data when editing
  useEffect(() => {
    if (open && editingPlan) {
      setLabId(editingPlan.lab_id);
      setLabNameFromAI('');
      setYear(editingPlan.year);
      setPurchaseGoal(editingPlan.total_purchase_goal || 0);
      
      // Fetch existing funds
      const fetchFunds = async () => {
        setIsLoadingFunds(true);
        try {
          const { data, error } = await supabase
            .from('plan_funds')
            .select('*')
            .eq('plan_id', editingPlan.id);

          if (error) throw error;

          const mappedFunds: PlanFundInput[] = (data || []).map((fund: PlanFund) => ({
            id: crypto.randomUUID(),
            dbId: fund.id,
            concept: fund.concept,
            amount_type: fund.amount_type as 'fijo' | 'porcentaje',
            amount_value: fund.amount_value || 0,
          }));

          setFunds(mappedFunds);
          setOriginalFundIds(mappedFunds.map(f => f.dbId!).filter(Boolean));
        } catch (err) {
          console.error('Error loading funds:', err);
          toast.error('Error al cargar los fondos del plan');
        } finally {
          setIsLoadingFunds(false);
        }
      };

      fetchFunds();
    } else if (open && !editingPlan) {
      resetForm();
    }
  }, [open, editingPlan]);

  // Calculate total budget from funds
  const totalBudget = funds.reduce((sum, fund) => {
    if (fund.amount_type === 'fijo') {
      return sum + fund.amount_value;
    } else {
      // Percentage of purchase goal
      return sum + (purchaseGoal * fund.amount_value / 100);
    }
  }, 0);

  // Handle AI analysis results
  const handleContractAnalyzed = useCallback((result: {
    labName: string;
    year: number;
    totalGoal: number;
    funds: Array<{ concept: string; type: 'percentage' | 'fixed'; value: number }>;
  }) => {
    // Try to match lab by name
    const matchedLab = laboratories.find(
      (lab) => lab.name.toLowerCase().includes(result.labName.toLowerCase()) ||
               result.labName.toLowerCase().includes(lab.name.toLowerCase())
    );
    
    if (matchedLab) {
      setLabId(matchedLab.id);
      setLabNameFromAI('');
    } else {
      setLabId('');
      setLabNameFromAI(result.labName);
    }

    setYear(result.year || currentYear + 1);
    setPurchaseGoal(result.totalGoal || 0);

    // Map funds from AI
    const mappedFunds: PlanFundInput[] = result.funds.map((f) => {
      // Try to match concept to our predefined list
      const matchedConcept = FUND_CONCEPTS.find(
        (c) => c.toLowerCase().includes(f.concept.toLowerCase()) ||
               f.concept.toLowerCase().includes(c.toLowerCase())
      ) || 'Otro';

      return {
        id: crypto.randomUUID(),
        concept: matchedConcept,
        amount_type: f.type === 'percentage' ? 'porcentaje' : 'fijo',
        amount_value: f.value,
      };
    });

    setFunds(mappedFunds);
    toast.success('Datos extraídos del contrato. Revisa y ajusta si es necesario.');
  }, [laboratories, currentYear]);

  const addFund = () => {
    setFunds([
      ...funds,
      {
        id: crypto.randomUUID(),
        concept: FUND_CONCEPTS[0],
        amount_type: 'porcentaje',
        amount_value: 0,
      },
    ]);
  };

  const removeFund = (id: string) => {
    setFunds(funds.filter((f) => f.id !== id));
  };

  const updateFund = (id: string, field: keyof PlanFundInput, value: string | number) => {
    setFunds(
      funds.map((f) =>
        f.id === id ? { ...f, [field]: value } : f
      )
    );
  };

  const resetForm = () => {
    setLabId('');
    setLabNameFromAI('');
    setYear(currentYear + 1);
    setPurchaseGoal(0);
    setFunds([]);
    setOriginalFundIds([]);
  };

  const handleSubmit = async () => {
    // Validation
    if (!labId) {
      toast.error('Selecciona un laboratorio');
      return;
    }
    if (!year || year < 2020 || year > 2100) {
      toast.error('Ingresa un año válido');
      return;
    }
    if (purchaseGoal <= 0) {
      toast.error('La meta de compra debe ser mayor a 0');
      return;
    }

    setIsSubmitting(true);

    try {
      const lab = laboratories.find((l) => l.id === labId);
      const planName = `Plan Comercial ${lab?.name || 'Lab'} ${year}`;

      if (isEditing && editingPlan) {
        // UPDATE MODE
        const { error: planError } = await supabase
          .from('annual_plans')
          .update({
            lab_id: labId,
            year: year,
            name: planName,
            total_purchase_goal: purchaseGoal,
            total_budget_allocated: totalBudget,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPlan.id);

        if (planError) {
          throw new Error(`Error al actualizar plan: ${planError.message}`);
        }

        // Handle funds: delete removed, update existing, insert new
        const currentFundDbIds = funds.map(f => f.dbId).filter(Boolean) as string[];
        const fundsToDelete = originalFundIds.filter(id => !currentFundDbIds.includes(id));
        const fundsToUpdate = funds.filter(f => f.dbId);
        const fundsToInsert = funds.filter(f => !f.dbId);

        // Delete removed funds
        if (fundsToDelete.length > 0) {
          const { error } = await supabase
            .from('plan_funds')
            .delete()
            .in('id', fundsToDelete);
          if (error) throw new Error(`Error al eliminar fondos: ${error.message}`);
        }

        // Update existing funds
        for (const fund of fundsToUpdate) {
          const { error } = await supabase
            .from('plan_funds')
            .update({
              concept: fund.concept,
              amount_type: fund.amount_type,
              amount_value: fund.amount_value,
              current_balance: fund.amount_type === 'fijo' 
                ? fund.amount_value 
                : (purchaseGoal * fund.amount_value / 100),
            })
            .eq('id', fund.dbId);
          if (error) throw new Error(`Error al actualizar fondo: ${error.message}`);
        }

        // Insert new funds
        if (fundsToInsert.length > 0) {
          const newFunds = fundsToInsert.map((fund) => ({
            plan_id: editingPlan.id,
            concept: fund.concept,
            amount_type: fund.amount_type,
            amount_value: fund.amount_value,
            current_balance: fund.amount_type === 'fijo' 
              ? fund.amount_value 
              : (purchaseGoal * fund.amount_value / 100),
          }));

          const { error } = await supabase
            .from('plan_funds')
            .insert(newFunds);
          if (error) throw new Error(`Error al crear nuevos fondos: ${error.message}`);
        }

        toast.success('Plan actualizado exitosamente');
      } else {
        // CREATE MODE
        const { data: planData, error: planError } = await supabase
          .from('annual_plans')
          .insert({
            lab_id: labId,
            year: year,
            name: planName,
            status: 'activo',
            total_purchase_goal: purchaseGoal,
            total_budget_allocated: totalBudget,
          })
          .select('id')
          .single();

        if (planError) {
          throw new Error(`Error al crear plan: ${planError.message}`);
        }

        if (funds.length > 0) {
          const fundsToInsert = funds.map((fund) => ({
            plan_id: planData.id,
            concept: fund.concept,
            amount_type: fund.amount_type,
            amount_value: fund.amount_value,
            current_balance: fund.amount_type === 'fijo' 
              ? fund.amount_value 
              : (purchaseGoal * fund.amount_value / 100),
          }));

          const { error: fundsError } = await supabase
            .from('plan_funds')
            .insert(fundsToInsert);

          if (fundsError) {
            await supabase.from('annual_plans').delete().eq('id', planData.id);
            throw new Error(`Error al crear fondos: ${fundsError.message}`);
          }
        }

        toast.success('Plan creado exitosamente');
      }

      resetForm();
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Plan' : 'Nuevo Plan Año'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Modifica los datos del acuerdo comercial' : 'Crea un nuevo acuerdo comercial con un laboratorio'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* AI Contract Analysis - Only show for new plans */}
          {!isEditing && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Análisis Inteligente
                </h3>
                <ContractDropzone 
                  onFileAnalyzed={handleContractAnalyzed}
                  disabled={isSubmitting}
                />
              </div>
              <Separator />
            </>
          )}

          {isLoadingFunds && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando datos...</span>
            </div>
          )}

          {/* SECTION A: General Data */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Datos Generales
            </h3>

            <div className="space-y-2">
              <Label htmlFor="laboratory">Laboratorio</Label>
              <Select value={labId} onValueChange={(v) => { setLabId(v); setLabNameFromAI(''); }}>
                <SelectTrigger id="laboratory">
                  <SelectValue placeholder={labNameFromAI || "Selecciona un laboratorio"} />
                </SelectTrigger>
                <SelectContent>
                  {laboratories.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No hay laboratorios disponibles
                    </SelectItem>
                  ) : (
                    laboratories.map((lab) => (
                      <SelectItem key={lab.id} value={lab.id}>
                        {lab.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {labNameFromAI && !labId && (
                <p className="text-xs text-amber-600">
                  ⚠️ La IA detectó "{labNameFromAI}" pero no coincide con ningún laboratorio. Selecciona uno manualmente.
                </p>
              )}
              {laboratories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Primero debes crear laboratorios en la base de datos
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year">Año</Label>
                <Input
                  id="year"
                  type="number"
                  min={2020}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || currentYear)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchaseGoal">Meta de Compra Total</Label>
                <Input
                  id="purchaseGoal"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={purchaseGoal || ''}
                  onChange={(e) => setPurchaseGoal(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* SECTION B: Funds */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Estructura del Plan (Buckets)
              </h3>
              <Button variant="outline" size="sm" onClick={addFund}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar Concepto
              </Button>
            </div>

            {funds.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground">
                  No hay conceptos agregados
                </p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={addFund}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar primer concepto
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {funds.map((fund, index) => (
                  <div
                    key={fund.id}
                    className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                  >
                    <span className="text-xs text-muted-foreground w-6">
                      {index + 1}.
                    </span>
                    
                    <Select
                      value={fund.concept}
                      onValueChange={(v) => updateFund(fund.id, 'concept', v)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FUND_CONCEPTS.map((concept) => (
                          <SelectItem key={concept} value={concept}>
                            {concept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={fund.amount_type}
                      onValueChange={(v) => updateFund(fund.id, 'amount_type', v as 'fijo' | 'porcentaje')}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="porcentaje">%</SelectItem>
                        <SelectItem value="fijo">$ Fijo</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      min={0}
                      step={fund.amount_type === 'porcentaje' ? 0.1 : 1}
                      className="w-24"
                      value={fund.amount_value || ''}
                      onChange={(e) =>
                        updateFund(fund.id, 'amount_value', parseFloat(e.target.value) || 0)
                      }
                      placeholder={fund.amount_type === 'porcentaje' ? '3.0' : '1000000'}
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeFund(fund.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Budget Summary */}
            {funds.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                <span className="text-sm font-medium text-foreground">
                  Presupuesto Total Calculado
                </span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(totalBudget)}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoadingFunds}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? 'Actualizando...' : 'Guardando...'}
                </>
              ) : (
                isEditing ? 'Actualizar Plan' : 'Guardar Plan'
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
