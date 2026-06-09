import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ChevronDown, FileSearch, Loader2, Plus, Save, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  approvePlanExtraction,
  BASE_URL,
  getPlan,
  rejectPlanExtraction,
  savePlanExtractionDraft,
} from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/PageHeader';
import { ModuleErrorCard } from '@/components/common/ModuleErrorCard';
import { ExtractionConditionsSection } from '@/components/plans/review/ExtractionConditionsSection';
import { ExtractionFundCard } from '@/components/plans/review/ExtractionFundCard';
import { ExtractionGeneralSection } from '@/components/plans/review/ExtractionGeneralSection';
import {
  buildReviewState,
  toApprovePayload,
  validateReviewState,
  type ReviewFund,
  type ReviewState,
} from '@/components/plans/review/reviewModel';

function confidenceBadge(confidence: number | null) {
  if (confidence === null) return <Badge variant="outline">Sin confianza</Badge>;
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.8) return <Badge className="bg-green-600 hover:bg-green-600">Extracción {pct}%</Badge>;
  if (confidence >= 0.5) return <Badge className="bg-amber-500 hover:bg-amber-500">Extracción {pct}%</Badge>;
  return <Badge variant="destructive">Extracción {pct}%</Badge>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible defaultOpen className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold">
        {title}
        <ChevronDown className="size-4 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

const emptyFund = (): ReviewFund => ({
  concept: '',
  amount_type: 'porcentaje',
  amount_value: null,
  settlement_frequency: 'annual',
  payment_method: 'credit_note',
  product_exclusions: null,
  compliance_threshold_pct: 100,
  allows_carryover: true,
  scales: [],
  periods: [],
  modifiers: [],
});

export default function PlanReview() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ReviewState | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const planQuery = useQuery({
    queryKey: ['plan', planId],
    queryFn: () => getPlan(planId as string),
    enabled: Boolean(planId),
  });

  useEffect(() => {
    if (planQuery.data && state === null) {
      setState(buildReviewState(planQuery.data));
    }
  }, [planQuery.data, state]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['plans'] });
    void queryClient.invalidateQueries({ queryKey: ['plan', planId] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approvePlanExtraction(planId as string, toApprovePayload(state as ReviewState)),
    onSuccess: () => {
      invalidate();
      toast.success('Extracción aprobada: el plan quedó cargado con escalas, períodos y condiciones');
      navigate('/plans');
    },
    onError: (err) =>
      toast.error(`Error al aprobar: ${err instanceof Error ? err.message : 'Error desconocido'}`),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectPlanExtraction(planId as string),
    onSuccess: () => {
      invalidate();
      toast.success('Extracción rechazada');
      navigate('/plans');
    },
    onError: (err) =>
      toast.error(`Error al rechazar: ${err instanceof Error ? err.message : 'Error desconocido'}`),
  });

  const draftMutation = useMutation({
    mutationFn: () =>
      savePlanExtractionDraft(planId as string, state as unknown as Record<string, unknown>),
    onSuccess: () => {
      invalidate();
      toast.success('Borrador guardado');
    },
    onError: (err) =>
      toast.error(`Error al guardar borrador: ${err instanceof Error ? err.message : 'Error desconocido'}`),
  });

  if (planQuery.isLoading || (planQuery.data && state === null)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (planQuery.isError || !planQuery.data || !state) {
    return <ModuleErrorCard message="No se pudo cargar el plan" onRetry={() => void planQuery.refetch()} />;
  }
  const plan = planQuery.data;

  const patch = (partial: Partial<ReviewState>) => setState((prev) => (prev ? { ...prev, ...partial } : prev));
  const patchFund = (index: number, partial: Partial<ReviewFund>) =>
    patch({ funds: state.funds.map((fund, i) => (i === index ? { ...fund, ...partial } : fund)) });

  const handleApprove = () => {
    const validationErrors = validateReviewState(state);
    setErrors(validationErrors);
    if (validationErrors.length > 0) {
      toast.error('Corrige los errores de validación antes de aprobar');
      return;
    }
    approveMutation.mutate();
  };

  const pdfSrc = plan.contract_pdf_url ? `${BASE_URL}${plan.contract_pdf_url}` : null;
  const busy = approveMutation.isPending || rejectMutation.isPending || draftMutation.isPending;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileSearch}
        title="Revisión de extracción"
        description={`${plan.laboratory_name ?? plan.name} — valida los datos extraídos del contrato antes de aprobar`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/plans')}>
            <ArrowLeft className="mr-1 size-4" /> Volver
          </Button>
          {confidenceBadge(plan.extraction_confidence)}
          {state.doc_type === 'amendment' && <Badge variant="secondary">Otrosí</Badge>}
          {plan.parent_plan_id && <Badge variant="outline">Modifica plan {plan.parent_plan_id.slice(0, 8)}…</Badge>}
          {state.uncertain_fields.length > 0 && (
            <Badge variant="outline" className="border-amber-400 text-amber-700">
              {state.uncertain_fields.length} campos inciertos
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => draftMutation.mutate()} disabled={busy}>
            <Save className="mr-1 size-4" /> Guardar borrador
          </Button>
          <Button variant="outline" className="text-destructive" onClick={() => rejectMutation.mutate()} disabled={busy}>
            <XCircle className="mr-1 size-4" /> Rechazar
          </Button>
          <Button onClick={handleApprove} disabled={busy}>
            {approveMutation.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 size-4" />
            )}
            Aprobar y guardar
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Errores de validación</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {state.uncertain_fields.length > 0 && (
        <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/30">
          <AlertTitle>Campos inciertos reportados por la IA</AlertTitle>
          <AlertDescription>{state.uncertain_fields.join(' · ')}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Izquierda: visor del PDF */}
        <div className="h-[75vh] overflow-hidden rounded-lg border bg-muted/30 lg:sticky lg:top-4">
          {pdfSrc ? (
            <iframe src={pdfSrc} title="Contrato PDF" className="size-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sin documento adjunto
            </div>
          )}
        </div>

        {/* Derecha: formulario editable */}
        <div className="space-y-3">
          <Section title="Datos generales">
            <ExtractionGeneralSection state={state} onChange={patch} />
          </Section>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Fondos ({state.funds.length})</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => patch({ funds: [...state.funds, emptyFund()] })}
              >
                <Plus className="mr-1 size-3" /> Fondo
              </Button>
            </div>
            {state.funds.map((fund, index) => (
              <ExtractionFundCard
                key={index}
                index={index}
                fund={fund}
                uncertainFields={state.uncertain_fields}
                onChange={(partial) => patchFund(index, partial)}
                onRemove={() => patch({ funds: state.funds.filter((_, i) => i !== index) })}
              />
            ))}
          </div>

          <Section title="Períodos del plan (meta global periodificada)">
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patch({
                      periods: [
                        ...state.periods,
                        { label: '', start_date: '', end_date: '', goal_value: null, goal_unit: 'money', distribution_pct: null },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 size-3" /> Período
                </Button>
              </div>
              {state.periods.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Sin períodos: el cumplimiento prorratea la meta por la fracción de vigencia transcurrida.
                </p>
              )}
              {state.periods.map((period, index) => (
                <div key={index} className="grid grid-cols-[90px_1fr_1fr_1fr_70px_36px] items-center gap-2">
                  <Input
                    value={period.label}
                    placeholder="Q1"
                    onChange={(e) =>
                      patch({
                        periods: state.periods.map((p, i) => (i === index ? { ...p, label: e.target.value } : p)),
                      })
                    }
                  />
                  <Input
                    type="date"
                    value={period.start_date}
                    onChange={(e) =>
                      patch({
                        periods: state.periods.map((p, i) => (i === index ? { ...p, start_date: e.target.value } : p)),
                      })
                    }
                  />
                  <Input
                    type="date"
                    value={period.end_date}
                    onChange={(e) =>
                      patch({
                        periods: state.periods.map((p, i) => (i === index ? { ...p, end_date: e.target.value } : p)),
                      })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Meta"
                    value={period.goal_value ?? ''}
                    onChange={(e) =>
                      patch({
                        periods: state.periods.map((p, i) =>
                          i === index ? { ...p, goal_value: e.target.value === '' ? null : Number(e.target.value) } : p,
                        ),
                      })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    placeholder="%"
                    value={period.distribution_pct ?? ''}
                    onChange={(e) =>
                      patch({
                        periods: state.periods.map((p, i) =>
                          i === index
                            ? { ...p, distribution_pct: e.target.value === '' ? null : Number(e.target.value) }
                            : p,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => patch({ periods: state.periods.filter((_, i) => i !== index) })}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Condiciones habilitantes">
            <ExtractionConditionsSection
              conditions={state.conditions}
              funds={state.funds}
              onChange={(conditions) => patch({ conditions })}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
