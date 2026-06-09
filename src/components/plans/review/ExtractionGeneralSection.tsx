import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ReviewState } from './reviewModel';
import { uncertainClass } from './reviewModel';

interface Props {
  state: ReviewState;
  onChange: (patch: Partial<ReviewState>) => void;
}

export function ExtractionGeneralSection({ state, onChange }: Props) {
  const uf = state.uncertain_fields;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1">
        <Label htmlFor="review-name">Nombre del plan</Label>
        <Input
          id="review-name"
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={cn(uncertainClass(uf, state.name, 'name', 'nombre'))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="review-supplier">Proveedor (extraído)</Label>
        <Input id="review-supplier" value={state.supplier_name ?? ''} disabled className="text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="review-year">Año</Label>
        <Input
          id="review-year"
          type="number"
          min={2020}
          max={2100}
          value={state.year}
          onChange={(e) => onChange({ year: Number(e.target.value) })}
          className={cn(uncertainClass(uf, state.year, 'year', 'año'))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="review-validity-start">Vigencia desde</Label>
        <Input
          id="review-validity-start"
          type="date"
          value={state.validity_start_date}
          onChange={(e) => onChange({ validity_start_date: e.target.value })}
          className={cn(uncertainClass(uf, state.validity_start_date, 'validity', 'vigencia', 'start'))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="review-validity-end">Vigencia hasta</Label>
        <Input
          id="review-validity-end"
          type="date"
          value={state.validity_end_date}
          onChange={(e) => onChange({ validity_end_date: e.target.value })}
          className={cn(uncertainClass(uf, state.validity_end_date, 'validity', 'vigencia', 'end'))}
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label htmlFor="review-goal">Meta total de compras (COP)</Label>
        <Input
          id="review-goal"
          type="number"
          min={0}
          value={state.total_purchase_goal ?? ''}
          onChange={(e) =>
            onChange({ total_purchase_goal: e.target.value === '' ? null : Number(e.target.value) })
          }
          className={cn(uncertainClass(uf, state.total_purchase_goal, 'goal', 'meta'))}
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label htmlFor="review-notes">Notas (dependencias entre fondos, texto libre)</Label>
        <Textarea
          id="review-notes"
          rows={3}
          value={state.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className={cn(uncertainClass(uf, null, 'notes', 'depend'))}
        />
      </div>
    </div>
  );
}
