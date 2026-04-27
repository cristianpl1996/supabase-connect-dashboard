import { useState, useCallback, useEffect } from 'react';
import { createPlan, getPlan, updatePlan } from '@/lib/api';
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
  dbId?: string;
  concept: string;
  amount_type: 'fijo' | 'porcentaje';
  amount_value: number;
  budget_period: string;
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

  const [labId, setLabId] = useState('');
  const [labNameFromAI, setLabNameFromAI] = useState('');
  const [year, setYear] = useState(currentYear + 1);
  const [purchaseGoal, setPurchaseGoal] = useState<number>(0);
  const [funds, setFunds] = useState<PlanFundInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingFunds, setIsLoadingFunds] = useState(false);

  useEffect(() => {
    if (open && editingPlan) {
      setLabId(editingPlan.lab_id);
      setLabNameFromAI('');
      setYear(editingPlan.year);
      setPurchaseGoal(editingPlan.total_purchase_goal || 0);

      const fetchPlan = async () => {
        setIsLoadingFunds(true);
        try {
          const planDetails = await getPlan(editingPlan.id);
          const mappedFunds: PlanFundInput[] = (planDetails.funds || []).map((fund: PlanFund) => ({
            id: crypto.randomUUID(),
            dbId: fund.id,
            concept: fund.concept,
            amount_type: fund.amount_type,
            amount_value: fund.amount_value || 0,
            budget_period: fund.budget_period || 'annual',
          }));
          setFunds(mappedFunds);
        } catch (err) {
          console.error('Error loading funds:', err);
          toast.error('Error al cargar los fondos del plan');
        } finally {
          setIsLoadingFunds(false);
        }
      };

      fetchPlan();
    } else if (open && !editingPlan) {
      resetForm();
    }
  }, [open, editingPlan]);

  const totalBudget = funds.reduce((sum, fund) => {
    if (fund.amount_type === 'fijo') {
      return sum + fund.amount_value;
    }
    return sum + (purchaseGoal * fund.amount_value / 100);
  }, 0);

  const handleContractAnalyzed = useCallback((result: {
    brand_name: string;
    year: number;
    annual_goal: number;
    invoice_discount_perc: number;
    rebate_sell_in_perc: number;
    rebate_sell_out_perc: number;
    marketing_perc: number;
    marketing_fixed_value: number;
    financial_discount_perc: number;
    total_margin_perc: number;
    funds: Array<{ concept: string; type: 'percentage' | 'fixed'; value: number }>;
  }) => {
    const matchedLab = laboratories.find(
      (lab) => lab.name.toLowerCase() === result.brand_name.toLowerCase()
        || lab.name.toLowerCase().includes(result.brand_name.toLowerCase())
        || result.brand_name.toLowerCase().includes(lab.name.toLowerCase())
    );

    if (matchedLab) {
      setLabId(matchedLab.id);
      setLabNameFromAI('');
    } else {
      setLabId('');
      setLabNameFromAI(result.brand_name);
    }

    setYear(result.year || currentYear + 1);
    setPurchaseGoal(result.annual_goal || 0);

    const mappedFunds: PlanFundInput[] = [];
    const addAIFund = (concept: string, amount_type: 'fijo' | 'porcentaje', amount_value: number) => {
      if (amount_value <= 0) return;
      mappedFunds.push({
        id: crypto.randomUUID(),
        concept,
        amount_type,
        amount_value,
        budget_period: 'annual',
      });
    };

    addAIFund('Otro', 'porcentaje', result.invoice_discount_perc);
    addAIFund('Rebate Sell-In', 'porcentaje', result.rebate_sell_in_perc);
    addAIFund('Rebate Sell-Out', 'porcentaje', result.rebate_sell_out_perc);
    addAIFund('Marketing', 'porcentaje', result.marketing_perc);
    addAIFund('Marketing', 'fijo', result.marketing_fixed_value);
    addAIFund('Pronto Pago', 'porcentaje', result.financial_discount_perc);

    setFunds(mappedFunds);
    toast.success(`Datos extraidos: ${result.brand_name} - Margen Total: ${result.total_margin_perc}%`);
  }, [laboratories, currentYear]);

  const addFund = () => {
    setFunds([
      ...funds,
      {
        id: crypto.randomUUID(),
        concept: FUND_CONCEPTS[0],
        amount_type: 'porcentaje',
        amount_value: 0,
        budget_period: 'annual',
      },
    ]);
  };

  const removeFund = (id: string) => {
    setFunds(funds.filter((f) => f.id !== id));
  };

  const updateFund = (id: string, field: keyof PlanFundInput, value: string | number) => {
    setFunds(funds.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const resetForm = () => {
    setLabId('');
    setLabNameFromAI('');
    setYear(currentYear + 1);
    setPurchaseGoal(0);
    setFunds([]);
  };

  const handleSubmit = async () => {
    if (!labId) {
      toast.error('Selecciona un laboratorio');
      return;
    }
    if (!year || year < 2020 || year > 2100) {
      toast.error('Ingresa un ano valido');
      return;
    }
    if (purchaseGoal <= 0) {
      toast.error('La meta de compra debe ser mayor a 0');
      return;
    }

    setIsSubmitting(true);

    try {
      const lab = laboratories.find((l) => l.id === labId);
      const payload = {
        lab_id: labId,
        year,
        name: `Plan Comercial ${lab?.name || 'Lab'} ${year}`,
        total_purchase_goal: purchaseGoal,
        funds: funds.map((fund) => ({
          id: fund.dbId,
          concept: fund.concept,
          amount_type: fund.amount_type,
          amount_value: fund.amount_value,
          budget_period: fund.budget_period || 'annual',
        })),
      };

      if (isEditing && editingPlan) {
        await updatePlan(editingPlan.id, payload);
        toast.success('Plan actualizado exitosamente');
      } else {
        await createPlan(payload);
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
          <SheetTitle>{isEditing ? 'Editar Plan' : 'Nuevo Plan Ano'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Modifica los datos del acuerdo comercial' : 'Crea un nuevo acuerdo comercial con un laboratorio'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {!isEditing && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Analisis Inteligente
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

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Datos Generales
            </h3>

            <div className="space-y-2">
              <Label htmlFor="laboratory">Laboratorio</Label>
              <Select value={labId} onValueChange={(v) => { setLabId(v); setLabNameFromAI(''); }}>
                <SelectTrigger id="laboratory">
                  <SelectValue placeholder={labNameFromAI || 'Selecciona un laboratorio'} />
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
                  La IA detecto "{labNameFromAI}" pero no coincide con ningun laboratorio. Selecciona uno manualmente.
                </p>
              )}
              {laboratories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Primero debes crear laboratorios en la base de datos
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="year">Ano</Label>
                <Input
                  id="year"
                  type="number"
                  min={2020}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || currentYear)}
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
                    className="grid gap-2 rounded-lg bg-muted/50 p-3 sm:grid-cols-[1.5rem_1fr_auto_auto_auto] sm:items-center"
                  >
                    <span className="text-xs text-muted-foreground w-6">
                      {index + 1}.
                    </span>

                    <Select
                      value={fund.concept}
                      onValueChange={(v) => updateFund(fund.id, 'concept', v)}
                    >
                      <SelectTrigger className="w-full sm:w-40">
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
                      <SelectTrigger className="w-full sm:w-24">
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
                      className="w-full sm:w-24"
                      value={fund.amount_value || ''}
                      onChange={(e) => updateFund(fund.id, 'amount_value', parseFloat(e.target.value) || 0)}
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

          <div className="grid gap-2 pt-4 sm:grid-cols-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              className="w-full"
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
