import { Promotion, PromoMechanic } from '@/types/database';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Tag, Zap, DollarSign, Target, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PromotionDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion: Promotion | null;
  mechanic?: PromoMechanic;
  labName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  borrador: { label: 'Borrador', variant: 'outline' },
  revision: { label: 'En Revisión', variant: 'secondary' },
  aprobada: { label: 'Aprobada', variant: 'default' },
  activa: { label: 'Activa', variant: 'default' },
  pausada: { label: 'Pausada', variant: 'secondary' },
  finalizada: { label: 'Finalizada', variant: 'outline' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
};

const CONDITION_LABELS: Record<string, string> = {
  sku_list: 'Lista de SKUs',
  min_amount: 'Monto Mínimo',
  category: 'Por Categoría',
};

const REWARD_LABELS: Record<string, string> = {
  free_product: 'Producto Gratis',
  discount_percent: 'Descuento %',
  price_override: 'Precio Especial',
};

const ACCOUNTING_LABELS: Record<string, string> = {
  descuento_pie: 'Descuento Pie de Factura',
  bonificacion_precio_cero: 'Bonificación Precio Cero',
  nota_credito_posterior: 'Nota Crédito Posterior',
};

const SCOPE_LABELS: Record<string, string> = {
  all: 'Todos',
  products: 'Productos especificos',
  customers: 'Clientes especificos',
  product_filters: 'Linea / categoria / marca / especie',
  customer_segment: 'Segmento de clientes',
};

export function PromotionDetailsSheet({ 
  open, 
  onOpenChange, 
  promotion, 
  mechanic,
  labName 
}: PromotionDetailsSheetProps) {

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), "dd 'de' MMMM, yyyy", { locale: es });
    } catch {
      return date;
    }
  };

  if (!promotion) return null;

  const statusConfig = STATUS_CONFIG[promotion.status] || STATUS_CONFIG.borrador;
  const targetSegment = promotion.target_segment as {
    type?: string;
    scope?: string;
    product_skus?: string[];
    customer_ids?: string[];
    product_filters?: Record<string, string>;
    customer_filters?: Record<string, string>;
  } | null;
  const conditionConfig = mechanic?.condition_config as Record<string, unknown> | null;
  const rewardConfig = mechanic?.reward_config as Record<string, unknown> | null;
  const scope = targetSegment?.scope || (targetSegment?.type && targetSegment.type !== 'todo' ? 'customer_segment' : 'all');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="text-xl">{promotion.title}</SheetTitle>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            {labName && (
              <Badge variant="outline">{labName}</Badge>
            )}
          </div>
          <SheetDescription className="mt-2">
            {promotion.description || 'Sin descripción'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Dates */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Vigencia</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(promotion.start_date)} — {formatDate(promotion.end_date)}
              </p>
            </div>
          </div>

          {/* Scope */}
          {targetSegment && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Aplica a</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {SCOPE_LABELS[scope] || scope}
                  </p>
                </div>
              </div>
              {Array.isArray(targetSegment.product_skus) && targetSegment.product_skus.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {targetSegment.product_skus.map((sku) => <Badge key={sku} variant="outline">{sku}</Badge>)}
                </div>
              )}
              {Array.isArray(targetSegment.customer_ids) && targetSegment.customer_ids.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {targetSegment.customer_ids.map((id) => <Badge key={id} variant="outline">Cliente {id}</Badge>)}
                </div>
              )}
              {targetSegment.product_filters && (
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {Object.entries(targetSegment.product_filters).filter(([, value]) => value).map(([key, value]) => (
                    <p key={key}><span className="font-medium text-foreground">{key}:</span> {value}</p>
                  ))}
                </div>
              )}
              {targetSegment.customer_filters && (
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {Object.entries(targetSegment.customer_filters).filter(([, value]) => value).map(([key, value]) => (
                    <p key={key}><span className="font-medium text-foreground">{key}:</span> {value}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Mechanic Details */}
          {mechanic && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Mecánica
              </h3>

              {/* Condition */}
              <div className="p-4 border rounded-lg space-y-2">
                <p className="text-xs text-muted-foreground uppercase">Condición</p>
                <p className="font-medium">
                  {CONDITION_LABELS[mechanic.condition_type || ''] || mechanic.condition_type}
                </p>
                {conditionConfig && (
                  <div className="text-sm text-muted-foreground">
                    {conditionConfig.skus && (
                      <p>SKUs: {String(conditionConfig.skus)}</p>
                    )}
                    {conditionConfig.min_qty && (
                      <p>Cantidad mínima: {String(conditionConfig.min_qty)}</p>
                    )}
                    {conditionConfig.min_amount && (
                      <p>Monto mínimo: {formatCurrency(Number(conditionConfig.min_amount))}</p>
                    )}
                    {conditionConfig.category && (
                      <p>Categoría: {String(conditionConfig.category)}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Reward */}
              <div className="p-4 border border-green-500/30 bg-green-500/5 rounded-lg space-y-2">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <Gift className="h-3 w-3" /> Beneficio
                </p>
                <p className="font-medium">
                  {REWARD_LABELS[mechanic.reward_type || ''] || mechanic.reward_type}
                </p>
                {rewardConfig && (
                  <div className="text-sm text-muted-foreground">
                    {rewardConfig.free_qty && (
                      <p>Cantidad gratis: {String(rewardConfig.free_qty)}</p>
                    )}
                    {rewardConfig.discount_percent && (
                      <p>Descuento: {String(rewardConfig.discount_percent)}%</p>
                    )}
                    {rewardConfig.special_price && (
                      <p>Precio especial: {formatCurrency(Number(rewardConfig.special_price))}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Accounting */}
              {mechanic.accounting_treatment && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Tratamiento Contable</p>
                  <p className="text-sm font-medium mt-1">
                    {ACCOUNTING_LABELS[mechanic.accounting_treatment] || mechanic.accounting_treatment}
                  </p>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Financial */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              Control Financiero
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">Costo Estimado</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(promotion.estimated_cost || 0)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Redenciones</p>
                <p className="text-lg font-bold text-foreground">
                  {promotion.current_redemptions} / {promotion.max_redemptions || '∞'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
