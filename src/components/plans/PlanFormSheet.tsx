import { useState, useEffect, useRef } from 'react';

const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });
import { createPlan, getPlan, updatePlan, BASE_URL } from '@/lib/api';
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
import { Layers3, Plus, Trash2, Loader2, FileText, ExternalLink, Building2, CalendarDays } from 'lucide-react';
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

const CUSTOM_CONCEPT_VALUE = '__custom__';
const FUND_CONCEPTS = [
  { value: 'Desc_Pie_Factura', label: 'Desc. Pie Factura', amountType: 'porcentaje' as const },
  { value: 'Rebate_SellIn', label: 'Rebate Sell In', amountType: 'porcentaje' as const },
  { value: 'Rebate_SellOut', label: 'Rebate Sell Out', amountType: 'porcentaje' as const },
  { value: 'Marketing', label: 'Marketing', amountType: 'porcentaje' as const },
  { value: 'Pronto_Pago', label: 'Pronto Pago', amountType: 'porcentaje' as const },
];

function isPresetConcept(concept: string): boolean {
  return FUND_CONCEPTS.some((item) => item.value === concept);
}

function getConceptLabel(concept: string): string {
  return FUND_CONCEPTS.find((item) => item.value === concept)?.label ?? concept;
}

export function PlanFormSheet({ open, onOpenChange, laboratories, onSuccess, editingPlan }: PlanFormSheetProps) {
  const currentYear = new Date().getFullYear();
  const isEditing = !!editingPlan;

  const [labId, setLabId] = useState('');
  const [year, setYear] = useState(currentYear + 1);
  const [purchaseGoal, setPurchaseGoal] = useState<number>(0);
  const [funds, setFunds] = useState<PlanFundInput[]>([]);
  const aiExtractedDataRef = useRef<Record<string, unknown> | null>(null);
  const [formErrors, setFormErrors] = useState<{ lab_id?: string; year?: string; purchase_goal?: string; funds?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingFunds, setIsLoadingFunds] = useState(false);

  useEffect(() => {
    if (open && editingPlan) {
      setLabId(editingPlan.lab_id);
      setLabNameFromAI('');
      setYear(editingPlan.year);
      setPurchaseGoal(editingPlan.total_purchase_goal || 0);
      aiExtractedDataRef.current = editingPlan.ai_extracted_data ?? null;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: resetForm is not useCallback; effect must run only on open/editingPlan change
  }, [open, editingPlan]);

  const totalBudget = funds.reduce((sum, fund) => {
    if (fund.amount_type === 'fijo') {
      return sum + fund.amount_value;
    }
    return sum + (purchaseGoal * fund.amount_value / 100);
  }, 0);

  const addFund = () => {
    setFunds((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        concept: FUND_CONCEPTS[0].value,
        amount_type: FUND_CONCEPTS[0].amountType,
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

  const updateFundConcept = (id: string, value: string) => {
    setFunds(funds.map((fund) => {
      if (fund.id !== id) return fund;
      if (value === CUSTOM_CONCEPT_VALUE) {
        return { ...fund, concept: '', amount_type: fund.amount_type };
      }
      const selectedConcept = FUND_CONCEPTS.find((item) => item.value === value);
      if (!selectedConcept) return fund;
      return {
        ...fund,
        concept: selectedConcept.value,
        amount_type: selectedConcept.amountType,
      };
    }));
  };

  const resetForm = () => {
    setLabId('');
    setYear(currentYear + 1);
    setPurchaseGoal(0);
    setFunds([]);
    setFormErrors({});
    aiExtractedDataRef.current = null;
  };

  const handleSubmit = async () => {
    const errors: typeof formErrors = {};
    if (!labId) errors.lab_id = 'Selecciona un laboratorio';
    if (!year || year < 2020 || year > 2100) errors.year = 'Ingresa un año válido (2020-2100)';
    if (purchaseGoal <= 0) errors.purchase_goal = 'La meta de compra debe ser mayor a 0';
    if (funds.some((fund) => !fund.concept.trim())) errors.funds = 'Completa el nombre de todos los conceptos';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    setIsSubmitting(true);

    try {
      const pdfUrl: string | null = editingPlan?.contract_pdf_url ?? null;
      const lab = laboratories.find((l) => l.id === labId);
      const payload = {
        lab_id: labId,
        year,
        name: `Plan Comercial ${lab?.name || 'Lab'} ${year}`,
        total_purchase_goal: purchaseGoal,
        ai_extracted_data: aiExtractedDataRef.current,
        contract_pdf_url: pdfUrl,
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

  const formatCurrency = (value: number) => COP_FORMATTER.format(value);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Plan' : 'Nuevo Plan Año'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Modifica los datos del acuerdo comercial' : 'Crea un nuevo acuerdo comercial con un laboratorio'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isEditing && editingPlan && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Editando plan</p>
              <p className="font-semibold text-foreground leading-tight">{editingPlan.name}</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="size-3.5" />
                  {laboratories.find((l) => l.id === editingPlan.lab_id)?.name || '—'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {editingPlan.year}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {isEditing ? 'Contrato comercial' : 'Análisis Inteligente'}
              </h3>
              {isEditing && editingPlan?.contract_pdf_url && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                  <span className="size-1.5 rounded-full bg-green-500" />
                  PDF adjunto
                </span>
              )}
            </div>

            {isEditing && editingPlan?.contract_pdf_url && (
              <a
                href={`${BASE_URL}${editingPlan.contract_pdf_url}`}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-lg border bg-muted/30 p-3.5 transition-all hover:border-primary/30 hover:bg-muted/50"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Contrato firmado</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Documento PDF adjunto</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors group-hover:bg-primary/20">
                  Abrir
                  <ExternalLink className="size-3" />
                </span>
              </a>
            )}

            {!isEditing && (
              <ContractDropzone
                labId={labId}
                disabled={isSubmitting || !labId}
              />
            )}
          </div>
          <Separator />

          {isLoadingFunds && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando datos…</span>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Datos Generales
            </h3>

            <div className="space-y-2">
              <Label htmlFor="laboratory">Laboratorio</Label>
              <Select value={labId} onValueChange={(v) => { setLabId(v); setFormErrors((e) => ({ ...e, lab_id: undefined })); }}>
                <SelectTrigger id="laboratory" className={formErrors.lab_id ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecciona un laboratorio" />
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
              {formErrors.lab_id && <p className="text-xs text-destructive">{formErrors.lab_id}</p>}
              {laboratories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Primero debes crear laboratorios en la base de datos
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="year">Año</Label>
                <Input
                  id="year"
                  type="number"
                  min={2020}
                  max={2100}
                  value={year}
                  className={formErrors.year ? 'border-destructive' : ''}
                  onChange={(e) => { setYear(parseInt(e.target.value, 10) || currentYear); setFormErrors((err) => ({ ...err, year: undefined })); }}
                />
                {formErrors.year && <p className="text-xs text-destructive">{formErrors.year}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchaseGoal">Meta de Compra Total</Label>
                <Input
                  id="purchaseGoal"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={purchaseGoal || ''}
                  className={formErrors.purchase_goal ? 'border-destructive' : ''}
                  onChange={(e) => { setPurchaseGoal(parseFloat(e.target.value) || 0); setFormErrors((err) => ({ ...err, purchase_goal: undefined })); }}
                />
                {formErrors.purchase_goal && <p className="text-xs text-destructive">{formErrors.purchase_goal}</p>}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Estructura de Fondos del Plan
              </h3>
              <Button variant="outline" size="sm" onClick={addFund}>
                <Plus className="size-4 mr-1" />
                Agregar Concepto
              </Button>
            </div>

            {funds.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center">
                <div className="mb-3 flex justify-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Layers3 className="size-5" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  No hay conceptos agregados
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {funds.map((fund, index) => (
                  <div
                    key={fund.id}
                    className={`grid gap-2 rounded-lg bg-muted/50 p-3 ${
                      isPresetConcept(fund.concept)
                        ? 'grid-cols-1 md:grid-cols-[1.5rem_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]'
                        : 'grid-cols-1 md:grid-cols-[1.5rem_minmax(0,1.15fr)_minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground sm:w-6 sm:self-center">
                      {index + 1}.
                    </span>

                    <Select
                      value={isPresetConcept(fund.concept) ? fund.concept : CUSTOM_CONCEPT_VALUE}
                      onValueChange={(v) => updateFundConcept(fund.id, v)}
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue>
                          {isPresetConcept(fund.concept) ? getConceptLabel(fund.concept) : 'Otro'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {FUND_CONCEPTS.map((concept) => (
                          <SelectItem key={concept.value} value={concept.value}>
                            {concept.label}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_CONCEPT_VALUE}>Otro</SelectItem>
                      </SelectContent>
                    </Select>

                    {!isPresetConcept(fund.concept) && (
                      <Input
                        value={fund.concept}
                        onChange={(e) => updateFund(fund.id, 'concept', e.target.value)}
                        placeholder="Escribe el concepto"
                        className="w-full min-w-0"
                      />
                    )}

                    <div className="flex min-w-0 items-center gap-2">
                      <Select
                        value={fund.amount_type}
                        onValueChange={(v) => updateFund(fund.id, 'amount_type', v as 'fijo' | 'porcentaje')}
                      >
                        <SelectTrigger className="w-full min-w-0 md:max-w-[130px]">
                          <SelectValue>
                            {fund.amount_type === 'porcentaje' ? '% Desc.' : '$ Fijo'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="porcentaje">% Desc.</SelectItem>
                          <SelectItem value="fijo">$ Fijo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full min-w-0">
                      <Input
                        type="number"
                        min={0}
                        step={fund.amount_type === 'porcentaje' ? 0.1 : 1}
                        className="w-full min-w-0 md:max-w-[140px]"
                        value={fund.amount_value || ''}
                        onChange={(e) => updateFund(fund.id, 'amount_value', parseFloat(e.target.value) || 0)}
                        placeholder={fund.amount_type === 'porcentaje' ? '3.0' : '1000000'}
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 justify-self-end text-destructive hover:text-destructive"
                      onClick={() => removeFund(fund.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {formErrors.funds && <p className="text-xs text-destructive">{formErrors.funds}</p>}

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
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {isEditing ? 'Actualizando…' : 'Guardando…'}
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
