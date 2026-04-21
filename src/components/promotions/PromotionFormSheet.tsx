import { useState, useEffect, useMemo } from 'react';
import { createPromotion, getPromotion, getPromotionBudget, updatePromotion } from '@/lib/api';
import { usePromoter } from '@/contexts/PromoterContext';
import { Laboratory, Promotion } from '@/types/database';
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

interface PromotionFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laboratories: Laboratory[];
  onSuccess: () => void;
  editingPromo?: Promotion | null;
}

const SEGMENT_OPTIONS = [
  { value: 'ganaderia', label: 'Ganaderia' },
  { value: 'mascotas', label: 'Mascotas' },
  { value: 'todo', label: 'Todo el pais' },
];

const CONDITION_TYPES = [
  { value: 'sku_list', label: 'Lista de SKUs (Pague X Lleve Y)' },
  { value: 'min_amount', label: 'Monto Minimo de Compra' },
  { value: 'category', label: 'Categoria de Producto' },
];

const REWARD_TYPES = [
  { value: 'free_product', label: 'Producto Gratis (Bonificacion)' },
  { value: 'discount_percent', label: 'Descuento Porcentual' },
  { value: 'price_override', label: 'Precio Especial' },
];

const ACCOUNTING_TREATMENTS = [
  { value: 'descuento_pie', label: 'Descuento Pie de Factura' },
  { value: 'bonificacion_precio_cero', label: 'Bonificacion a Precio Cero' },
  { value: 'nota_credito_posterior', label: 'Nota Credito Posterior' },
];

export function PromotionFormSheet({
  open,
  onOpenChange,
  laboratories,
  onSuccess,
  editingPromo
}: PromotionFormSheetProps) {
  const isEditing = !!editingPromo;
  const { promoter, isPromoter } = usePromoter();

  const [approvalWarning, setApprovalWarning] = useState<string | null>(null);
  const [labId, setLabId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [segment, setSegment] = useState('todo');
  const [conditionType, setConditionType] = useState('sku_list');
  const [conditionValue, setConditionValue] = useState('');
  const [conditionQty, setConditionQty] = useState<number>(0);
  const [rewardType, setRewardType] = useState('free_product');
  const [rewardValue, setRewardValue] = useState<number>(0);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [accountingTreatment, setAccountingTreatment] = useState('descuento_pie');
  const [maxRedemptions, setMaxRedemptions] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMechanic, setIsLoadingMechanic] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [spendableBalance, setSpendableBalance] = useState<number | null>(null);

  useEffect(() => {
    if (open && editingPromo) {
      const fetchPromotion = async () => {
        setIsLoadingMechanic(true);
        try {
          const details = await getPromotion(editingPromo.id);
          setLabId(details.lab_id);
          setTitle(details.title);
          setDescription(details.description || '');
          setStartDate(details.start_date);
          setEndDate(details.end_date);
          const targetSegment = details.target_segment as { type?: string } | null;
          setSegment(targetSegment?.type || 'todo');
          setEstimatedCost(details.estimated_cost || 0);
          setMaxRedemptions(details.max_redemptions || '');

          const mechanic = details.mechanic;
          if (mechanic) {
            setConditionType(mechanic.condition_type || 'sku_list');
            setAccountingTreatment(mechanic.accounting_treatment || 'descuento_pie');
            setRewardType(mechanic.reward_type || 'free_product');
            const condConfig = mechanic.condition_config as { skus?: string[]; quantity?: number; min_amount?: number; category?: string; min_qty?: number } | null;
            if (condConfig) {
              setConditionValue(Array.isArray(condConfig.skus) ? condConfig.skus.join(', ') : condConfig.category || '');
              setConditionQty(Number(condConfig.quantity ?? condConfig.min_qty ?? condConfig.min_amount ?? 0));
            }
            const rewConfig = mechanic.reward_config as { value?: number; free_qty?: number; discount_percent?: number; special_price?: number } | null;
            if (rewConfig) {
              setRewardValue(Number(rewConfig.value ?? rewConfig.free_qty ?? rewConfig.discount_percent ?? rewConfig.special_price ?? 0));
            }
          }
        } catch (err) {
          console.error('Error loading promotion:', err);
          toast.error('Error al cargar la promocion');
        } finally {
          setIsLoadingMechanic(false);
        }
      };
      fetchPromotion();
    } else if (open && !editingPromo) {
      resetForm();
      if (isPromoter && promoter) {
        setLabId(promoter.laboratory_id);
      }
    }
  }, [open, editingPromo, isPromoter, promoter]);

  useEffect(() => {
    if (!isPromoter || !promoter || !open) {
      setApprovalWarning(null);
      return;
    }
    if (promoter.approval_limit !== null && estimatedCost > 0 && estimatedCost > promoter.approval_limit) {
      setApprovalWarning(
        `El costo estimado (${formatCurrency(estimatedCost)}) supera tu cupo de aprobacion (${formatCurrency(promoter.approval_limit)}). La promocion se guardara como "Requiere Aprobacion de Gerencia".`
      );
    } else {
      setApprovalWarning(null);
    }
  }, [estimatedCost, isPromoter, promoter, open]);

  useEffect(() => {
    if (!labId || !open) {
      setBudgetError(null);
      setSpendableBalance(null);
      return;
    }
    const checkBudget = async () => {
      try {
        const summary = await getPromotionBudget(labId, editingPromo?.id);
        setSpendableBalance(summary.spendable_balance);
        if (estimatedCost > 0 && estimatedCost > summary.spendable_balance) {
          setBudgetError(
            `Error: No puedes crear esta promocion. Estas excediendo el presupuesto de Marketing asignado. Saldo gastable disponible: ${formatCurrency(summary.spendable_balance)}`
          );
        } else {
          setBudgetError(null);
        }
      } catch (err) {
        console.error('Error checking budget:', err);
      }
    };
    checkBudget();
  }, [labId, estimatedCost, open]);

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
    setBudgetError(null);
    setSpendableBalance(null);
    setApprovalWarning(null);
  };

  const buildConditionConfig = useMemo(() => {
    return () => {
      switch (conditionType) {
        case 'sku_list':
          return { skus: conditionValue.split(',').map((item) => item.trim()).filter(Boolean), quantity: conditionQty };
        case 'min_amount':
          return { min_amount: conditionQty };
        case 'category':
          return { category: conditionValue, min_qty: conditionQty };
        default:
          return {};
      }
    };
  }, [conditionType, conditionValue, conditionQty]);

  const buildRewardConfig = useMemo(() => {
    return () => {
      switch (rewardType) {
        case 'free_product':
          return { free_qty: rewardValue, value: rewardValue };
        case 'discount_percent':
          return { discount_percent: rewardValue, value: rewardValue };
        case 'price_override':
          return { special_price: rewardValue, value: rewardValue };
        default:
          return {};
      }
    };
  }, [rewardType, rewardValue]);

  const handleSubmit = async () => {
    if (!labId) {
      toast.error('Selecciona un laboratorio');
      return;
    }
    if (!title.trim()) {
      toast.error('Ingresa un titulo para la promocion');
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
    if (budgetError) {
      toast.error('No puedes guardar: el costo estimado supera el presupuesto gastable disponible.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        lab_id: labId,
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        target_segment: { type: segment },
        estimated_cost: estimatedCost || null,
        max_redemptions: maxRedemptions || null,
        created_by_role: isPromoter ? ('laboratorio' as const) : ('distribuidor' as const),
        mechanic: {
          condition_type: conditionType,
          condition_config: buildConditionConfig(),
          reward_type: rewardType,
          reward_config: buildRewardConfig(),
          accounting_treatment: accountingTreatment,
        },
      };

      const result = isEditing && editingPromo
        ? await updatePromotion(editingPromo.id, payload)
        : await createPromotion(payload);

      if (result.requires_manager_approval) {
        toast.success('Promocion creada - Requiere Aprobacion de Gerencia');
      } else {
        toast.success(isEditing ? 'Promocion actualizada exitosamente' : 'Promocion creada exitosamente');
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

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Promocion' : 'Nueva Promocion'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Modifica los datos de la promocion' : 'Crea una nueva promocion comercial'}
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
                    {isPromoter ? (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md border">
                        <span className="text-sm font-medium">
                          {laboratories.find((l) => l.id === labId)?.name || 'Laboratorio asignado'}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">Asignado</span>
                      </div>
                    ) : (
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
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Titulo de la Promocion</Label>
                    <Input id="title" placeholder="Ej: Pague 10 Lleve 12 - Ganaderia" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descripcion (opcional)</Label>
                    <Textarea id="description" placeholder="Descripcion detallada de la promocion..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Fecha Inicio</Label>
                      <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Fecha Fin</Label>
                      <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="segment">Segmentacion</Label>
                    <Select value={segment} onValueChange={setSegment}>
                      <SelectTrigger id="segment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEGMENT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="mechanics" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold">Mecanica de la Promocion</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                    <h4 className="text-sm font-medium text-foreground">Si el cliente compra... (Condicion)</h4>
                    <div className="space-y-2">
                      <Label>Tipo de Condicion</Label>
                      <Select value={conditionType} onValueChange={setConditionType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONDITION_TYPES.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {conditionType !== 'min_amount' && (
                        <div className="space-y-2">
                          <Label>{conditionType === 'sku_list' ? 'SKUs (separados por coma)' : 'Categoria'}</Label>
                          <Input
                            placeholder={conditionType === 'sku_list' ? 'SKU001, SKU002' : 'Ganaderia'}
                            value={conditionValue}
                            onChange={(e) => setConditionValue(e.target.value)}
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>{conditionType === 'min_amount' ? 'Monto Minimo ($)' : 'Cantidad Requerida'}</Label>
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

                  <div className="p-4 bg-green-500/10 rounded-lg space-y-4">
                    <h4 className="text-sm font-medium text-foreground">Entonces recibe... (Beneficio)</h4>
                    <div className="space-y-2">
                      <Label>Tipo de Beneficio</Label>
                      <Select value={rewardType} onValueChange={setRewardType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REWARD_TYPES.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
                      <Input id="estimatedCost" type="number" min={0} value={estimatedCost || ''} onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)} placeholder="1000000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxRedemptions">Max. Redenciones (opcional)</Label>
                      <Input id="maxRedemptions" type="number" min={0} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value ? parseInt(e.target.value, 10) : '')} placeholder="500" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tratamiento Contable (ERP)</Label>
                    <Select value={accountingTreatment} onValueChange={setAccountingTreatment}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACCOUNTING_TREATMENTS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Define como se reflejara esta promocion en SAP Business One</p>
                  </div>

                  {estimatedCost > 0 && !budgetError && (
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Costo Estimado</span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(estimatedCost)}</span>
                      </div>
                      {spendableBalance !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Saldo gastable disponible: {formatCurrency(spendableBalance)}
                        </p>
                      )}
                    </div>
                  )}

                  {budgetError && (
                    <Alert variant="destructive" className="border-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="font-medium">{budgetError}</AlertDescription>
                    </Alert>
                  )}

                  {approvalWarning && !budgetError && (
                    <Alert className="border-amber-300 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="font-medium text-amber-800">{approvalWarning}</AlertDescription>
                    </Alert>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex gap-3 pt-6 mt-6 border-t">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isSubmitting || !!budgetError}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditing ? 'Actualizando...' : 'Guardando...'}
                  </>
                ) : (
                  isEditing ? 'Actualizar Promocion' : 'Guardar Promocion'
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
