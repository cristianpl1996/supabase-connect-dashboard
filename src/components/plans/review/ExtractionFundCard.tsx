import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ReviewFund, ReviewPeriod } from './reviewModel';
import { uncertainClass } from './reviewModel';

const SETTLEMENT_OPTIONS = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'biannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
] as const;

const PAYMENT_OPTIONS = [
  { value: 'credit_note', label: 'Nota crédito' },
  { value: 'product', label: 'Producto' },
  { value: 'rotation_boost_note', label: 'Nota impulso rotación' },
  { value: 'invoice', label: 'Factura' },
  { value: 'mixed', label: 'Mixto' },
] as const;

interface Props {
  index: number;
  fund: ReviewFund;
  uncertainFields: string[];
  onChange: (patch: Partial<ReviewFund>) => void;
  onRemove: () => void;
}

const emptyPeriod = (): ReviewPeriod => ({
  label: '',
  start_date: '',
  end_date: '',
  goal_value: null,
  goal_unit: 'money',
  distribution_pct: null,
});

export function ExtractionFundCard({ index, fund, uncertainFields, onChange, onRemove }: Props) {
  const uf = uncertainFields;
  const fundToken = `funds[${index}]`;

  const updateScale = (scaleIndex: number, patch: Partial<ReviewFund['scales'][number]>) => {
    onChange({
      scales: fund.scales.map((scale, i) => (i === scaleIndex ? { ...scale, ...patch } : scale)),
    });
  };
  const updatePeriod = (periodIndex: number, patch: Partial<ReviewPeriod>) => {
    onChange({
      periods: fund.periods.map((period, i) => (i === periodIndex ? { ...period, ...patch } : period)),
    });
  };
  const updateModifier = (modIndex: number, patch: Partial<ReviewFund['modifiers'][number]>) => {
    onChange({
      modifiers: fund.modifiers.map((modifier, i) => (i === modIndex ? { ...modifier, ...patch } : modifier)),
    });
  };

  return (
    <Collapsible defaultOpen className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{index + 1}</Badge>
          <span className="font-medium">{fund.concept || 'Fondo sin concepto'}</span>
          <span className="text-xs text-muted-foreground">
            {fund.amount_type === 'fijo'
              ? `$${(fund.amount_value ?? 0).toLocaleString('es-CO')}`
              : `${fund.amount_value ?? 0}%`}
            {fund.scales.length > 0 && ` · ${fund.scales.length} escalas`}
          </span>
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t px-4 py-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Concepto</Label>
            <Input
              value={fund.concept}
              onChange={(e) => onChange({ concept: e.target.value })}
              className={cn(uncertainClass(uf, fund.concept, fundToken, 'concept'))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={fund.amount_type}
                onValueChange={(value) => onChange({ amount_type: value as ReviewFund['amount_type'] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="porcentaje">% Desc.</SelectItem>
                  <SelectItem value="fijo">$ Fijo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{fund.amount_type === 'fijo' ? 'Valor' : '%'}</Label>
              <Input
                type="number"
                min={0}
                value={fund.amount_value ?? ''}
                onChange={(e) => onChange({ amount_value: e.target.value === '' ? null : Number(e.target.value) })}
                className={cn(uncertainClass(uf, fund.amount_value, fundToken, 'pct', 'value'))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Frecuencia de liquidación</Label>
            <Select
              value={fund.settlement_frequency}
              onValueChange={(value) => onChange({ settlement_frequency: value as ReviewFund['settlement_frequency'] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SETTLEMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Medio de pago</Label>
            <Select
              value={fund.payment_method}
              onValueChange={(value) => onChange({ payment_method: value as ReviewFund['payment_method'] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Umbral de cumplimiento (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={fund.compliance_threshold_pct}
              onChange={(e) => onChange({ compliance_threshold_pct: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>Exclusiones de producto</Label>
            <Input
              value={fund.product_exclusions ?? ''}
              placeholder='Ej: "Excluye Veterinary HPM"'
              onChange={(e) => onChange({ product_exclusions: e.target.value || null })}
              className={cn(uncertainClass(uf, null, fundToken + '.exclusions', 'exclus'))}
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Switch
              checked={fund.allows_carryover}
              onCheckedChange={(checked) => onChange({ allows_carryover: checked })}
            />
            <Label className="text-sm font-normal">Período incumplido recuperable después (carryover)</Label>
          </div>
        </div>

        {/* Escalas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Escalas (meta → % beneficio)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  scales: [
                    ...fund.scales,
                    { level: fund.scales.length + 1, goal_value: 0, goal_unit: 'money', benefit_pct: 0 },
                  ],
                })
              }
            >
              <Plus className="mr-1 size-3" /> Escala
            </Button>
          </div>
          {fund.scales.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin escalas: se usa el % plano del fondo.</p>
          )}
          {fund.scales.map((scale, scaleIndex) => (
            <div key={scaleIndex} className="grid grid-cols-[60px_1fr_110px_90px_36px] items-center gap-2">
              <Input
                type="number"
                min={1}
                value={scale.level}
                onChange={(e) => updateScale(scaleIndex, { level: Number(e.target.value) })}
                aria-label="Nivel"
              />
              <Input
                type="number"
                min={0}
                value={scale.goal_value}
                onChange={(e) => updateScale(scaleIndex, { goal_value: Number(e.target.value) })}
                aria-label="Meta"
                className={cn(uncertainClass(uf, scale.goal_value || null, fundToken + '.scales', 'escala'))}
              />
              <Select
                value={scale.goal_unit}
                onValueChange={(value) => updateScale(scaleIndex, { goal_unit: value as 'money' | 'units' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="money">$ Dinero</SelectItem>
                  <SelectItem value="units">Unidades</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step="0.1"
                value={scale.benefit_pct}
                onChange={(e) => updateScale(scaleIndex, { benefit_pct: Number(e.target.value) })}
                aria-label="% beneficio"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange({ scales: fund.scales.filter((_, i) => i !== scaleIndex) })}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        {/* Períodos del fondo */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Períodos del fondo</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ periods: [...fund.periods, emptyPeriod()] })}
            >
              <Plus className="mr-1 size-3" /> Período
            </Button>
          </div>
          {fund.periods.map((period, periodIndex) => (
            <div key={periodIndex} className="grid grid-cols-[90px_1fr_1fr_1fr_70px_36px] items-center gap-2">
              <Input
                value={period.label}
                placeholder="Q1"
                onChange={(e) => updatePeriod(periodIndex, { label: e.target.value })}
                aria-label="Etiqueta"
              />
              <Input
                type="date"
                value={period.start_date}
                onChange={(e) => updatePeriod(periodIndex, { start_date: e.target.value })}
                className={cn(uncertainClass(uf, period.start_date, fundToken + '.periods', 'period'))}
                aria-label="Inicio"
              />
              <Input
                type="date"
                value={period.end_date}
                onChange={(e) => updatePeriod(periodIndex, { end_date: e.target.value })}
                className={cn(uncertainClass(uf, period.end_date, fundToken + '.periods', 'period'))}
                aria-label="Fin"
              />
              <Input
                type="number"
                min={0}
                value={period.goal_value ?? ''}
                placeholder="Meta"
                onChange={(e) =>
                  updatePeriod(periodIndex, { goal_value: e.target.value === '' ? null : Number(e.target.value) })
                }
                aria-label="Meta"
              />
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={period.distribution_pct ?? ''}
                placeholder="%"
                onChange={(e) =>
                  updatePeriod(periodIndex, {
                    distribution_pct: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                aria-label="% distribución"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange({ periods: fund.periods.filter((_, i) => i !== periodIndex) })}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        {/* Modificadores */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Modificadores (penalización / tope)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  modifiers: [
                    ...fund.modifiers,
                    { modifier_type: 'penalty', condition_text: '', effect_pct: null, cap_pct_over_goal: null },
                  ],
                })
              }
            >
              <Plus className="mr-1 size-3" /> Modificador
            </Button>
          </div>
          {fund.modifiers.map((modifier, modIndex) => (
            <div key={modIndex} className="grid grid-cols-[130px_1fr_90px_36px] items-center gap-2">
              <Select
                value={modifier.modifier_type}
                onValueChange={(value) => updateModifier(modIndex, { modifier_type: value as 'penalty' | 'cap' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="penalty">Penalización</SelectItem>
                  <SelectItem value="cap">Tope (cap)</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={modifier.condition_text ?? ''}
                placeholder="Condición (ej. cartera promedio > 70 días)"
                onChange={(e) => updateModifier(modIndex, { condition_text: e.target.value || null })}
              />
              <Input
                type="number"
                step="0.1"
                value={
                  modifier.modifier_type === 'penalty'
                    ? modifier.effect_pct ?? ''
                    : modifier.cap_pct_over_goal ?? ''
                }
                placeholder={modifier.modifier_type === 'penalty' ? '−pts' : '% tope'}
                onChange={(e) => {
                  const value = e.target.value === '' ? null : Number(e.target.value);
                  if (modifier.modifier_type === 'penalty') updateModifier(modIndex, { effect_pct: value });
                  else updateModifier(modIndex, { cap_pct_over_goal: value });
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange({ modifiers: fund.modifiers.filter((_, i) => i !== modIndex) })}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={onRemove} className="text-destructive">
          <Trash2 className="mr-1 size-3" /> Eliminar fondo
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}
