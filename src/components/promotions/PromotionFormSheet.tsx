import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Laboratory, Promotion, PromoMechanic, PlanFund } from '@/types/database';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, Zap, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getBudgetRulesConfig, isFundSpendable } from '@/hooks/useBudgetRules';

interface PromotionFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laboratories: Laboratory[];
  onSuccess: () => void;
  editingPromo?: Promotion | null;
}

const SEGMENT_OPTIONS = [
  { value: 'ganaderia', label: 'Ganadería' },
  { value: 'mascotas', label: 'Mascotas' },
  { value: 'todo', label: 'Todo el país' },
];

const CONDITION_TYPES = [
  { value: 'sku_list', label: 'Lista de SKUs (Pague X Lleve Y)' },
  { value: 'min_amount', label: 'Monto Mínimo de Compra' },
  { value: 'category', label: 'Categoría de Producto' },
];

const REWARD_TYPES = [
  { value: 'free_product', label: 'Producto Gratis (Bonificación)' },
  { value: 'discount_percent', label: 'Descuento Porcentual' },
  { value: 'price_override', label: 'Precio Especial' },
];

const ACCOUNTING_TREATMENTS = [
  { value: 'descuento_pie', label: 'Descuento Pie de Factura' },
  { value: 'bonificacion_precio_cero', label: 'Bonificación a Precio Cero' },
  { value: 'nota_credito_posterior', label: 'Nota Crédito Posterior' },
];

export function PromotionFormSheet({ 
  open, 
  onOpenChange, 
  laboratories, 
  onSuccess, 
  editingPromo 
}: PromotionFormSheetProps) {
  const isEditing = !!editingPromo;
  
  // Section A: General Data
  const [labId, setLabId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [segment, setSegment] = useState('todo');
  
  // Section B: Mechanics
  const [conditionType, setConditionType] = useState('sku_list');
  const [conditionValue, setConditionValue] = useState('');
  const [conditionQty, setConditionQty] = useState<number>(0);
  const [rewardType, setRewardType] = useState('free_product');
  const [rewardValue, setRewardValue] = useState<number>(0);
  
  // Section C: Financial
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [accountingTreatment, setAccountingTreatment] = useState('descuento_pie');
  const [maxRedemptions, setMaxRedemptions] = useState<number | ''>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMechanic, setIsLoadingMechanic] = useState(false);
  const [existingMechanicId, setExistingMechanicId] = useState<string | null>(null);
  
  // Overdraft protection
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [spendableBalance, setSpendableBalance] = useState<number | null>(null);

  // Load existing data when editing
  useEffect(() => {
    if (open && editingPromo) {
      setLabId(editingPromo.lab_id);
      setTitle(editingPromo.title);
      setDescription(editingPromo.description || '');
      setStartDate(editingPromo.start_date);
      setEndDate(editingPromo.end_date);
      
      // Parse segment
      const targetSegment = editingPromo.target_segment as { type?: string } | null;
      setSegment(targetSegment?.type || 'todo');
      
      setEstimatedCost(editingPromo.estimated_cost || 0);
      setMaxRedemptions(editingPromo.max_redemptions || '');

      // Fetch existing mechanic
      const fetchMechanic = async () => {
        setIsLoadingMechanic(true);
        try {
          const { data, error } = await supabase
            .from('promo_mechanics')
            .select('*')
            .eq('promo_id', editingPromo.id)
            .single();

          if (error && error.code !== 'PGRST116') throw error;
          
          if (data) {
            setExistingMechanicId(data.id);
            setConditionType(data.condition_type || 'sku_list');
            setAccountingTreatment(data.accounting_treatment || 'descuento_pie');
            setRewardType(data.reward_type || 'free_product');
            
            // Parse condition config
            const condConfig = data.condition_config as { skus?: string; min_qty?: number; min_amount?: number; category?: string } | null;
            if (condConfig) {
              setConditionValue(condConfig.skus || condConfig.category || '');
              setConditionQty(condConfig.min_qty || condConfig.min_amount || 0);
            }
            
            // Parse reward config
            const rewConfig = data.reward_config as { free_qty?: number; discount_percent?: number; special_price?: number } | null;
            if (rewConfig) {
              setRewardValue(rewConfig.free_qty || rewConfig.discount_percent || rewConfig.special_price || 0);
            }
          }
        } catch (err) {
          console.error('Error loading mechanic:', err);
        } finally {
          setIsLoadingMechanic(false);
        }
      };

      fetchMechanic();
    } else if (open && !editingPromo) {
      resetForm();
    }
  }, [open, editingPromo]);

  // Overdraft protection: check spendable budget when lab or cost changes
  useEffect(() => {
    if (!labId || !open) {
      setBudgetError(null);
      setSpendableBalance(null);
      return;
    }

    const checkBudget = async () => {
      try {
        const budgetRules = getBudgetRulesConfig();

        // Fetch plans for this lab
        const { data: plans } = await supabase
          .from('annual_plans')
          .select('id, total_purchase_goal')
          .eq('lab_id', labId);

        const planIds = (plans || []).map(p => p.id);
        let spendable = 0;

        if (planIds.length > 0) {
          const { data: funds } = await supabase
            .from('plan_funds')
            .select('*')
            .in('plan_id', planIds);

          const purchaseGoals: Record<string, number> = {};
          (plans || []).forEach(p => { purchaseGoals[p.id] = p.total_purchase_goal || 0; });

          (funds || []).forEach((fund: PlanFund) => {
            if (isFundSpendable(budgetRules, fund.concept, fund.amount_type)) {
              if (fund.amount_type === 'fijo') {
                spendable += fund.amount_value || 0;
              } else {
                spendable += ((purchaseGoals[fund.plan_id] || 0) * (fund.amount_value || 0)) / 100;
              }
            }
          });
        }

        // Fetch existing committed promos (exclude current promo if editing)
        const query = supabase
          .from('promotions')
          .select('estimated_cost')
          .eq('lab_id', labId)
          .in('status', ['activa', 'borrador', 'revision', 'aprobada']);

        const { data: promos } = editingPromo
          ? await query.neq('id', editingPromo.id)
          : await query;

        const committed = (promos || []).reduce(
          (sum, p) => sum + (p.estimated_cost || 0), 0
        );

        // Fetch adjustments
        const { data: adjustments } = await supabase
          .from('wallet_ledger')
          .select('amount')
          .eq('lab_id', labId)
          .eq('transaction_type', 'ajuste_manual');

        let positiveAdj = 0;
        let negativeAdj = 0;
        (adjustments || []).forEach(adj => {
          if (adj.amount > 0) positiveAdj += adj.amount;
          else negativeAdj += Math.abs(adj.amount);
        });

        const available = (spendable + positiveAdj) - (committed + negativeAdj);
        setSpendableBalance(available);

        if (estimatedCost > 0 && estimatedCost > available) {
          setBudgetError(
            `⛔ Error: No puedes crear esta promoción. Estás excediendo el presupuesto de Marketing asignado (No toques el margen del distribuidor). Saldo gastable disponible: ${formatCurrency(available)}`
          );
        } else {
          setBudgetError(null);
        }
      } catch (err) {
        console.error('Error checking budget:', err);
      }
    };

    checkBudget();
  }, [labId, estimatedCost, open, editingPromo]);

  const resetForm = () => {
    setLabId('');
    setTitle('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setSegment('todo');
    setConditionType('sku_list');
    setConditionValue('');
    setConditionQty(0);
    setRewardType('free_product');
    setRewardValue(0);
    setEstimatedCost(0);
    setAccountingTreatment('descuento_pie');
    setMaxRedemptions('');
    setExistingMechanicId(null);
    setBudgetError(null);
    setSpendableBalance(null);
  };

  const buildConditionConfig = () => {
    switch (conditionType) {
      case 'sku_list':
        return { skus: conditionValue, min_qty: conditionQty };
      case 'min_amount':
        return { min_amount: conditionQty };
      case 'category':
        return { category: conditionValue, min_qty: conditionQty };
      default:
        return {};
    }
  };

  const buildRewardConfig = () => {
    switch (rewardType) {
      case 'free_product':
        return { free_qty: rewardValue };
      case 'discount_percent':
        return { discount_percent: rewardValue };
      case 'price_override':
        return { special_price: rewardValue };
      default:
        return {};
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!labId) {
      toast.error('Selecciona un laboratorio');
      return;
    }
    if (!title.trim()) {
      toast.error('Ingresa un título para la promoción');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Selecciona las fechas de vigencia');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('La fecha de inicio debe ser anterior a la de fin');
      return;
    }

    // Overdraft protection: block if exceeds spendable budget
    if (budgetError) {
      toast.error('No puedes guardar: el costo estimado supera el presupuesto gastable disponible.');
      return;
    }

    setIsSubmitting(true);

    try {
      const promotionData = {
        lab_id: labId,
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        target_segment: { type: segment },
        estimated_cost: estimatedCost || null,
        max_redemptions: maxRedemptions || null,
        created_by_role: 'distribuidor' as const,
        status: 'borrador' as const,
      };

      const mechanicData = {
        condition_type: conditionType,
        condition_config: buildConditionConfig(),
        reward_type: rewardType,
        reward_config: buildRewardConfig(),
        accounting_treatment: accountingTreatment,
      };

      if (isEditing && editingPromo) {
        // UPDATE MODE
        const { error: promoError } = await supabase
          .from('promotions')
          .update(promotionData)
          .eq('id', editingPromo.id);

        if (promoError) throw new Error(`Error al actualizar promoción: ${promoError.message}`);

        // Update or insert mechanic
        if (existingMechanicId) {
          const { error: mechError } = await supabase
            .from('promo_mechanics')
            .update(mechanicData)
            .eq('id', existingMechanicId);

          if (mechError) throw new Error(`Error al actualizar mecánica: ${mechError.message}`);
        } else {
          const { error: mechError } = await supabase
            .from('promo_mechanics')
            .insert({ ...mechanicData, promo_id: editingPromo.id });

          if (mechError) throw new Error(`Error al crear mecánica: ${mechError.message}`);
        }

        toast.success('Promoción actualizada exitosamente');
      } else {
        // CREATE MODE
        const { data: promoData, error: promoError } = await supabase
          .from('promotions')
          .insert(promotionData)
          .select('id')
          .single();

        if (promoError) throw new Error(`Error al crear promoción: ${promoError.message}`);

        // Insert mechanic
        const { error: mechError } = await supabase
          .from('promo_mechanics')
          .insert({ ...mechanicData, promo_id: promoData.id });

        if (mechError) {
          // Rollback
          await supabase.from('promotions').delete().eq('id', promoData.id);
          throw new Error(`Error al crear mecánica: ${mechError.message}`);
        }

        toast.success('Promoción creada exitosamente');
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
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Promoción' : 'Nueva Promoción'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Modifica los datos de la promoción' : 'Crea una nueva promoción comercial'}
          </SheetDescription>
        </SheetHeader>

        {isLoadingMechanic ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando datos...</span>
          </div>
        ) : (
          <div className="mt-6">
            <Accordion type="multiple" defaultValue={['general', 'mechanics', 'financial']} className="space-y-4">
              {/* SECTION A: General Data */}
              <AccordionItem value="general" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Datos Generales</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="laboratory">Laboratorio</Label>
                    <Select value={labId} onValueChange={setLabId}>
                      <SelectTrigger id="laboratory">
                        <SelectValue placeholder="Selecciona un laboratorio" />
                      </SelectTrigger>
                      <SelectContent>
                        {laboratories.map((lab) => (
                          <SelectItem key={lab.id} value={lab.id}>
                            {lab.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Título de la Promoción</Label>
                    <Input
                      id="title"
                      placeholder="Ej: Pague 10 Lleve 12 - Ganadería"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción (opcional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Descripción detallada de la promoción..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Fecha Inicio</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Fecha Fin</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="segment">Segmentación</Label>
                    <Select value={segment} onValueChange={setSegment}>
                      <SelectTrigger id="segment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEGMENT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SECTION B: Mechanics */}
              <AccordionItem value="mechanics" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold">Mecánica de la Promoción</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  {/* Condition */}
                  <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                    <h4 className="text-sm font-medium text-foreground">
                      Si el cliente compra... (Condición)
                    </h4>
                    
                    <div className="space-y-2">
                      <Label>Tipo de Condición</Label>
                      <Select value={conditionType} onValueChange={setConditionType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_TYPES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {conditionType !== 'min_amount' && (
                        <div className="space-y-2">
                          <Label>
                            {conditionType === 'sku_list' ? 'SKUs (separados por coma)' : 'Categoría'}
                          </Label>
                          <Input
                            placeholder={conditionType === 'sku_list' ? 'SKU001, SKU002' : 'Ganadería'}
                            value={conditionValue}
                            onChange={(e) => setConditionValue(e.target.value)}
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>
                          {conditionType === 'min_amount' ? 'Monto Mínimo ($)' : 'Cantidad Requerida'}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={conditionQty || ''}
                          onChange={(e) => setConditionQty(parseFloat(e.target.value) || 0)}
                          placeholder={conditionType === 'min_amount' ? '500000' : '10'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reward */}
                  <div className="p-4 bg-green-500/10 rounded-lg space-y-4">
                    <h4 className="text-sm font-medium text-foreground">
                      Entonces recibe... (Beneficio)
                    </h4>
                    
                    <div className="space-y-2">
                      <Label>Tipo de Beneficio</Label>
                      <Select value={rewardType} onValueChange={setRewardType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REWARD_TYPES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        {rewardType === 'free_product' && 'Cantidad a Regalar'}
                        {rewardType === 'discount_percent' && 'Porcentaje de Descuento (%)'}
                        {rewardType === 'price_override' && 'Precio Especial ($)'}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={rewardType === 'discount_percent' ? 0.1 : 1}
                        value={rewardValue || ''}
                        onChange={(e) => setRewardValue(parseFloat(e.target.value) || 0)}
                        placeholder={rewardType === 'discount_percent' ? '15' : '2'}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SECTION C: Financial */}
              <AccordionItem value="financial" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="font-semibold">Control Financiero</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimatedCost">Costo Estimado ($)</Label>
                      <Input
                        id="estimatedCost"
                        type="number"
                        min={0}
                        value={estimatedCost || ''}
                        onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                        placeholder="1000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxRedemptions">Máx. Redenciones (opcional)</Label>
                      <Input
                        id="maxRedemptions"
                        type="number"
                        min={0}
                        value={maxRedemptions}
                        onChange={(e) => setMaxRedemptions(e.target.value ? parseInt(e.target.value) : '')}
                        placeholder="500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tratamiento Contable (ERP)</Label>
                    <Select value={accountingTreatment} onValueChange={setAccountingTreatment}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNTING_TREATMENTS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Define cómo se reflejará esta promoción en SAP Business One
                    </p>
                  </div>

                  {estimatedCost > 0 && !budgetError && (
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Costo Estimado</span>
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(estimatedCost)}
                        </span>
                      </div>
                      {spendableBalance !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Saldo gastable disponible: {formatCurrency(spendableBalance)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Overdraft blocking error */}
                  {budgetError && (
                    <Alert variant="destructive" className="border-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="font-medium">
                        {budgetError}
                      </AlertDescription>
                    </Alert>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Actions */}
            <div className="flex gap-3 pt-6 mt-6 border-t">
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
                disabled={isSubmitting || !!budgetError}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditing ? 'Actualizando...' : 'Guardando...'}
                  </>
                ) : (
                  isEditing ? 'Actualizar Promoción' : 'Guardar Promoción'
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
