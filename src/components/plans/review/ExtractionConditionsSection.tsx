import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ReviewCondition, ReviewFund } from './reviewModel';

const CONDITION_OPTIONS = [
  { value: 'current_account', label: 'Cartera al día' },
  { value: 'compliance_threshold', label: 'Umbral de cumplimiento' },
  { value: 'interim_progress', label: 'Avance intermedio' },
  { value: 'information_delivery', label: 'Entrega de información' },
  { value: 'other', label: 'Otra' },
] as const;

interface Props {
  conditions: ReviewCondition[];
  funds: ReviewFund[];
  onChange: (conditions: ReviewCondition[]) => void;
}

export function ExtractionConditionsSection({ conditions, funds, onChange }: Props) {
  const update = (index: number, patch: Partial<ReviewCondition>) => {
    onChange(conditions.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)));
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...conditions,
              { condition_type: 'other', fund_index: null, params_text: '', original_text: '', is_blocking: true },
            ])
          }
        >
          <Plus className="mr-1 size-3" /> Condición
        </Button>
      </div>
      {conditions.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin condiciones habilitantes extraídas.</p>
      )}
      {conditions.map((condition, index) => (
        <div key={index} className="space-y-2 rounded-lg border p-3">
          <div className="grid grid-cols-[1fr_1fr_36px] items-end gap-2">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={condition.condition_type}
                onValueChange={(value) =>
                  update(index, { condition_type: value as ReviewCondition['condition_type'] })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Aplica a</Label>
              <Select
                value={condition.fund_index === null ? 'plan' : String(condition.fund_index)}
                onValueChange={(value) => update(index, { fund_index: value === 'plan' ? null : Number(value) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="plan">Todo el plan</SelectItem>
                  {funds.map((fund, fundIndex) => (
                    <SelectItem key={fundIndex} value={String(fundIndex)}>
                      {fund.concept || `Fondo ${fundIndex + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(conditions.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label>Cláusula literal del contrato</Label>
            <Textarea
              rows={2}
              value={condition.original_text ?? ''}
              onChange={(e) => update(index, { original_text: e.target.value || null })}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="space-y-1">
              <Label>Parámetros (JSON)</Label>
              <Input
                value={condition.params_text}
                placeholder='{"date": "2025-10-31", "threshold_pct": 80}'
                onChange={(e) => update(index, { params_text: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch
                checked={condition.is_blocking}
                onCheckedChange={(checked) => update(index, { is_blocking: checked })}
              />
              <Label className="text-sm font-normal">Bloqueante</Label>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
