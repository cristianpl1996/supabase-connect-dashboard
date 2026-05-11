import { Promotion, PromoMechanic } from "@/types/database";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Calendar, ClipboardCheck, DollarSign, Gift, Megaphone, Target, WalletCards, Zap } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PromotionDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion: Promotion | null;
  mechanic?: PromoMechanic;
  labName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  borrador: { label: "Borrador", variant: "outline" },
  revision: { label: "En revision", variant: "secondary" },
  aprobada: { label: "Aprobada", variant: "default" },
  activa: { label: "Activa", variant: "default" },
  pausada: { label: "Pausada", variant: "secondary" },
  finalizada: { label: "Finalizada", variant: "outline" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

const CONDITION_LABELS: Record<string, string> = {
  sku_list: "Lista de SKUs",
  min_amount: "Monto minimo",
  category: "Por categoria",
};

const REWARD_LABELS: Record<string, string> = {
  free_product: "Producto gratis",
  discount_percent: "Descuento %",
  price_override: "Precio especial",
};

const ACCOUNTING_LABELS: Record<string, string> = {
  descuento_pie: "Descuento pie de factura",
  bonificacion_precio_cero: "Bonificacion precio cero",
  nota_credito_posterior: "Nota credito posterior",
};

const SCOPE_LABELS: Record<string, string> = {
  all: "Todos los clientes",
  products: "Productos especificos",
  customers: "Clientes especificos",
  product_filters: "Linea / categoria / marca / especie",
  customer_segment: "Segmento de clientes",
};

const STRIPED_BAR_CLASS = [
  "bg-[length:1rem_1rem]",
  "bg-[linear-gradient(45deg,rgba(255,255,255,.24)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.24)_50%,rgba(255,255,255,.24)_75%,transparent_75%,transparent)]",
  "motion-safe:animate-[progress-stripes_1s_linear_infinite]",
].join(" ");

export function PromotionDetailsSheet({
  open,
  onOpenChange,
  promotion,
  mechanic,
  labName,
}: PromotionDetailsSheetProps) {
  const formatCurrency = (value: number) => new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), "dd MMM yyyy", { locale: es });
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
  const scope = targetSegment?.scope || (targetSegment?.type && targetSegment.type !== "todo" ? "customer_segment" : "all");
  const maxRedemptions = promotion.max_redemptions || 0;
  const redemptionPercent = maxRedemptions > 0 ? Math.min((promotion.current_redemptions / maxRedemptions) * 100, 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-4xl">
        <div className="bg-background px-4 pb-3 pt-5 sm:px-6">
          <SheetHeader className="text-left">
            <div className="pr-8">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                  {labName && <Badge variant="outline">{labName}</Badge>}
                  {promotion.created_by_role && <Badge variant="secondary">{promotion.created_by_role}</Badge>}
                </div>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl font-bold sm:text-2xl">{promotion.title}</SheetTitle>
                  <SheetDescription className="mt-1 line-clamp-2 text-sm">
                    {promotion.description || "Sin descripcion"}
                  </SheetDescription>
                </div>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="space-y-5 px-4 py-4 sm:px-6">
          <div className="grid gap-3 lg:grid-cols-3">
            <PromoMetric
              icon={DollarSign}
              label="Costo estimado"
              value={formatCurrency(promotion.estimated_cost || 0)}
              note="Presupuesto promocional"
            />
            <PromoMetric
              icon={Calendar}
              label="Vigencia"
              value={formatDate(promotion.start_date)}
              note={`Hasta ${formatDate(promotion.end_date)}`}
            />
            <PromoMetric
              icon={WalletCards}
              label="Redenciones"
              value={`${promotion.current_redemptions}${promotion.max_redemptions ? ` / ${promotion.max_redemptions}` : ""}`}
              note={promotion.max_redemptions ? `${redemptionPercent.toFixed(0)}% usado` : "Sin limite configurado"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PromoMetric
              icon={Target}
              label="Audiencia"
              value={SCOPE_LABELS[scope] || scope}
              note="Alcance configurado"
            />
            <PromoMetric
              icon={Megaphone}
              label="Marketing"
              value={promotion.flash_card_url ? "Con pieza" : "Pendiente"}
              note={promotion.marketing_copy ? "Copy disponible" : "Sin copy"}
            />
          </div>

          <section className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Segmentacion</h3>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <PromoFact label="Alcance" value={SCOPE_LABELS[scope] || scope} />
              <PromoFact label="Laboratorio" value={labName || promotion.laboratory_name} />
              <PromoFact label="Origen" value={promotion.created_by_responsible || promotion.created_by_identifier || promotion.created_by_role} />
            </div>
            {targetSegment && (
              <div className="mt-3 space-y-3">
                {Array.isArray(targetSegment.product_skus) && targetSegment.product_skus.length > 0 && (
                  <BadgeList title="SKUs" values={targetSegment.product_skus} />
                )}
                {Array.isArray(targetSegment.customer_ids) && targetSegment.customer_ids.length > 0 && (
                  <BadgeList title="Clientes" values={targetSegment.customer_ids.map((id) => `Cliente ${id}`)} />
                )}
                {targetSegment.product_filters && <KeyValueGrid values={targetSegment.product_filters} />}
                {targetSegment.customer_filters && <KeyValueGrid values={targetSegment.customer_filters} />}
              </div>
            )}
          </section>

          {mechanic ? (
            <div className="space-y-3">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Mecanica promocional</h3>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <section className="rounded-md border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Condicion</h3>
                  </div>
                  <PromoFact label="Tipo" value={CONDITION_LABELS[mechanic.condition_type || ""] || mechanic.condition_type} />
                  {conditionConfig && <KeyValueGrid values={conditionConfig} className="mt-3" currencyKeys={["min_amount"]} />}
                </section>

                <section className="rounded-md border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Beneficio</h3>
                  </div>
                  <PromoFact label="Tipo" value={REWARD_LABELS[mechanic.reward_type || ""] || mechanic.reward_type} />
                  {rewardConfig && <KeyValueGrid values={rewardConfig} className="mt-3" currencyKeys={["special_price"]} />}
                  {mechanic.accounting_treatment && (
                    <div className="mt-3">
                      <PromoFact label="Tratamiento contable" value={ACCOUNTING_LABELS[mechanic.accounting_treatment] || mechanic.accounting_treatment} />
                    </div>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Esta promocion no tiene mecanica configurada.
            </div>
          )}

          <section className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Control financiero</h3>
            </div>
            <FinancialProgress
              percent={redemptionPercent}
              current={promotion.current_redemptions}
              max={promotion.max_redemptions}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <PromoFact label="Costo estimado" value={formatCurrency(promotion.estimated_cost || 0)} />
              <PromoFact label="Redenciones actuales" value={promotion.current_redemptions} />
              <PromoFact label="Maximo redenciones" value={promotion.max_redemptions || "Sin limite"} />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PromoMetric({ icon: Icon, label, value, note }: { icon: React.ElementType; label: string; value: string; note: string }) {
  return (
    <div className="min-h-[7rem] rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight text-foreground">{value}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 break-words text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function PromoFact({ label, value }: { label: string; value: unknown }) {
  const display = value === null || value === undefined || value === "" ? "N/A" : String(value);
  return (
    <div className="min-h-[4rem] rounded-md bg-muted/35 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{display}</p>
    </div>
  );
}

function FinancialProgress({ percent, current, max }: { percent: number; current: number; max?: number | null }) {
  const hasLimit = Boolean(max && max > 0);
  const width = hasLimit ? `${Math.max(4, Math.min(percent, 100))}%` : "100%";

  return (
    <div className="mb-4 rounded-md border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">Uso de redenciones</span>
        <span className="text-muted-foreground">
          {hasLimit ? `${current} de ${max} (${percent.toFixed(0)}%)` : `${current} redenciones / sin limite`}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full bg-primary transition-[width] duration-700 ease-out ${hasLimit ? STRIPED_BAR_CLASS : "opacity-45"}`}
          style={{ width }}
        />
      </div>
    </div>
  );
}

function BadgeList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => <Badge key={value} variant="outline">{value}</Badge>)}
      </div>
    </div>
  );
}

function KeyValueGrid({
  values,
  className = "",
  currencyKeys = [],
}: {
  values: Record<string, unknown>;
  className?: string;
  currencyKeys?: string[];
}) {
  const entries = Object.entries(values).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (entries.length === 0) return null;
  const formatValue = (key: string, value: unknown) => {
    if (currencyKeys.includes(key)) {
      return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));
    }
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
      {entries.map(([key, value]) => (
        <PromoFact key={key} label={key.replace(/_/g, " ")} value={formatValue(key, value)} />
      ))}
    </div>
  );
}
