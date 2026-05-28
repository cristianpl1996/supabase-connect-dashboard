import { useEffect, useState } from "react";
import { Promotion, PromoMechanic } from "@/types/database";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Megaphone, Package, Users, WalletCards, Zap } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { listProducts, getCustomersPage } from "@/lib/api";

const EMPTY_STRING_ARRAY: string[] = [];
const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface PromotionDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion: Promotion | null;
  mechanic?: PromoMechanic;
  labName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  borrador:   { label: "Borrador",   variant: "outline" },
  activa:     { label: "Activa",     variant: "default" },
  finalizada: { label: "Finalizada", variant: "secondary" },
  cancelada:  { label: "Cancelada",  variant: "destructive" },
};

const ACCOUNTING_LABELS: Record<string, string> = {
  descuento_pie:          "Descuento pie de factura",
  bonificacion_precio_cero: "Bonificacion precio cero",
  nota_credito_posterior: "Nota credito posterior",
};

const AUDIENCE_SCOPE_LABELS: Record<string, string> = {
  all:              "Toda la base comercial",
  customers:        "Clientes especificos",
  customer_segment: "Segmento de clientes",
};

const PRODUCT_MODE_LABELS: Record<string, string> = {
  specific: "Productos especificos",
  filters:  "Por filtros",
};

const CUSTOMER_FILTER_LABELS: Record<string, string> = {
  business_type:                 "Tipo de negocio",
  city:                          "Ciudad",
  state:                         "Departamento",
  has_sales_representative:      "Con representante",
  sales_representative_id:       "Representante ID",
  has_location:                  "Con ubicacion",
  min_purchases:                 "Min. compras",
  max_purchases:                 "Max. compras",
  min_days_since_last_purchase:  "Min. dias sin compra",
  max_days_since_last_purchase:  "Max. dias sin compra",
  customer_clv_segment:          "Segmento CLV",
  customer_rfm_segment:          "Segmento RFM",
  segment_preset:                "Preset de segmento",
};

const PRODUCT_FILTER_LABELS: Record<string, string> = {
  brand_name:      "Marca",
  industry_sector: "Sector",
  category:        "Categoria",
  target_species:  "Especie",
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
  const [nameState, setNameState] = useState({ productMap: {} as Record<string, string>, customerMap: {} as Record<string, string>, loading: false });
  const { productMap: productNameMap, customerMap: customerNameMap, loading: loadingNames } = nameState;

  useEffect(() => {
    if (!open || !promotion) return;
    setNameState({ productMap: {}, customerMap: {}, loading: true });

    const skus = Array.isArray(promotion.product_skus) ? promotion.product_skus : [];
    const nits = Array.isArray(promotion.customer_ids) ? promotion.customer_ids : [];
    const pf = (promotion.product_filters || {}) as Record<string, string>;
    const cf = (promotion.customer_filters || {}) as Record<string, unknown>;

    const fetchProducts = skus.length > 0
      ? listProducts({ brand_name: pf.brand_name || undefined, limit: 500 })
          .then((rows) => {
            const map: Record<string, string> = {};
            for (const p of rows) {
              if (p.product_sku && p.product_commercial_name) {
                map[p.product_sku] = p.product_commercial_name;
              }
            }
            setNameState((s) => ({ ...s, productMap: map }));
          })
          .catch(() => {})
      : Promise.resolve();

    const repId = cf.sales_representative_id;
    const fetchCustomers = nits.length > 0
      ? getCustomersPage({ ...(repId ? { sales_representative_id: Number(repId) } : {}), limit: 2000 })
          .then((res) => {
            const map: Record<string, string> = {};
            for (const c of res.data ?? []) {
              const nit = String(c['customer_government_id'] ?? '');
              const name = String(c['customer_full_name'] ?? c['customer_commercial_name'] ?? c['customer_name'] ?? '');
              if (nit && name) map[nit] = name;
            }
            setNameState((s) => ({ ...s, customerMap: map }));
          })
          .catch(() => {})
      : Promise.resolve();

    Promise.all([fetchProducts, fetchCustomers]).finally(() => setNameState((s) => ({ ...s, loading: false })));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-fetch when promotion id changes, not on every prop update
  }, [open, promotion?.id]);

  const formatCurrency = (value: number) => COP_FORMATTER.format(value);

  const formatDate = (date: string) => {
    try { return format(new Date(date), "dd MMM yyyy", { locale: es }); }
    catch { return date; }
  };

  if (!promotion) return null;

  const statusConfig = STATUS_CONFIG[promotion.status] || STATUS_CONFIG.borrador;
  const productMode    = String(promotion.product_mode || "specific");
  const productSkus    = Array.isArray(promotion.product_skus) ? promotion.product_skus : [];
  const productFilters = (promotion.product_filters || {}) as Record<string, unknown>;
  const audienceScope  = String(promotion.audience_scope || "all");
  const customerIds    = Array.isArray(promotion.customer_ids) ? promotion.customer_ids : [];
  const audienceFilters = (promotion.customer_filters || {}) as Record<string, unknown>;

  const maxRedemptions  = promotion.max_redemptions || 0;
  const redemptionPercent = maxRedemptions > 0 ? Math.min((promotion.current_redemptions / maxRedemptions) * 100, 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-4xl">

        {/* ── Header ── */}
        <div className="border-b bg-background px-4 pb-4 pt-5 sm:px-6">
          <SheetHeader className="text-left">
            <div className="pr-8">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                {(labName || promotion.laboratory_name) && (
                  <Badge variant="outline">{labName || promotion.laboratory_name}</Badge>
                )}
                {promotion.origin && (
                  <Badge variant="secondary">{promotion.origin}</Badge>
                )}
              </div>
              <SheetTitle className="text-xl font-bold sm:text-2xl">{promotion.title}</SheetTitle>
              {promotion.description && (
                <SheetDescription className="mt-1 line-clamp-2 text-sm">{promotion.description}</SheetDescription>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Creado por {promotion.created_by_responsible || promotion.created_by_role} · {formatDate(promotion.created_at)}
              </p>
            </div>
          </SheetHeader>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-6">

          {/* ── Métricas ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PromoMetric
              icon={Calendar}
              label="Vigencia"
              value={`${formatDate(promotion.start_date)} — ${formatDate(promotion.end_date)}`}
              note={(() => {
                try {
                  const diff = Math.ceil((new Date(promotion.end_date).getTime() - new Date(promotion.start_date).getTime()) / 86400000) + 1;
                  return `${diff} ${diff === 1 ? 'dia' : 'dias'}`;
                } catch { return ''; }
              })()}
            />
            <PromoMetric
              icon={DollarSign}
              label="Costo estimado"
              value={promotion.estimated_cost ? formatCurrency(promotion.estimated_cost) : "Sin definir"}
              note="Presupuesto promocional"
            />
            <PromoMetric
              icon={WalletCards}
              label="Redenciones"
              value={`${promotion.current_redemptions}${promotion.max_redemptions ? ` / ${promotion.max_redemptions}` : ""}`}
              note={promotion.max_redemptions ? `${redemptionPercent.toFixed(0)}% usado` : "Sin limite configurado"}
            />
          </div>

          {/* ── Productos ── */}
          <SectionCard
            icon={<Package className="size-4 text-primary" />}
            title="Productos"
            subtitle={PRODUCT_MODE_LABELS[productMode]}
            count={productSkus.length}
          >
            {productMode === 'filters' && (
              <FilterPills
                filters={productFilters}
                labels={PRODUCT_FILTER_LABELS}
                exclude={['excluded_product_skus']}
              />
            )}
            {productSkus.length > 0 && (
              loadingNames
                ? <LoadingSkeleton />
                : <ScrollList>
                    {productSkus.map((sku) => (
                      <ListRow
                        key={sku}
                        primary={productNameMap[sku] || sku}
                        secondary={productNameMap[sku] ? sku : undefined}
                      />
                    ))}
                  </ScrollList>
            )}
            {productSkus.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">Sin productos configurados</p>
            )}
          </SectionCard>

          {/* ── Alcance ── */}
          <SectionCard
            icon={<Users className="size-4 text-primary" />}
            title="Alcance"
            subtitle={AUDIENCE_SCOPE_LABELS[audienceScope]}
            count={audienceScope !== 'all' ? customerIds.length : undefined}
          >
            {audienceScope === 'customer_segment' && (
              <FilterPills
                filters={audienceFilters}
                labels={CUSTOMER_FILTER_LABELS}
                exclude={['excluded_customer_ids']}
                booleanKeys={['has_sales_representative', 'has_location']}
              />
            )}
            {customerIds.length > 0 && (
              loadingNames
                ? <LoadingSkeleton />
                : <ScrollList>
                    {customerIds.map((nit) => (
                      <ListRow
                        key={nit}
                        primary={customerNameMap[nit] || nit}
                        secondary={customerNameMap[nit] ? nit : undefined}
                      />
                    ))}
                  </ScrollList>
            )}
            {audienceScope === 'all' && (
              <p className="py-1 text-sm text-muted-foreground">Aplica a toda la base de clientes activos</p>
            )}
          </SectionCard>

          {/* ── Regla comercial ── */}
          {mechanic ? (
            <SectionCard
              icon={<Zap className="size-4 text-primary" />}
              title="Regla comercial"
              subtitle={mechanic.promotion_type_label || mechanic.promotion_type || undefined}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <PromoFact label="Tipo"      value={mechanic.promotion_type_label  || mechanic.promotion_type} />
                <PromoFact label="Condicion" value={mechanic.condition_type_label  || mechanic.condition_type} />
                <PromoFact label="Beneficio" value={mechanic.benefit_type_label    || mechanic.benefit_type} />
              </div>
              <div className="rounded-md bg-muted/40 px-4 py-3 text-sm leading-6">
                {mechanic.summary || "Promocion comercial configurada."}
              </div>
              {mechanic.accounting_treatment && (
                <PromoFact label="Tratamiento contable" value={ACCOUNTING_LABELS[mechanic.accounting_treatment] || mechanic.accounting_treatment} />
              )}
            </SectionCard>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 p-5 text-center text-sm text-muted-foreground">
              Esta promocion no tiene mecanica configurada.
            </div>
          )}

          {/* ── Control financiero ── */}
          <SectionCard
            icon={<DollarSign className="size-4 text-primary" />}
            title="Control financiero"
          >
            <FinancialProgress percent={redemptionPercent} current={promotion.current_redemptions} max={promotion.max_redemptions} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <PromoFact label="Costo estimado"      value={promotion.estimated_cost ? formatCurrency(promotion.estimated_cost) : "N/A"} />
              <PromoFact label="Redenciones actuales" value={promotion.current_redemptions} />
              <PromoFact label="Maximo redenciones"   value={promotion.max_redemptions || "Sin limite"} />
            </div>
          </SectionCard>

          {/* ── SAP info ── */}
          {(promotion.sap_campaign_number || promotion.sap_sync_error) && (
            <SectionCard
              icon={<Megaphone className="size-4 text-primary" />}
              title="Sincronizacion SAP"
            >
              {promotion.sap_campaign_number && (
                <PromoFact label="Numero de campana SAP" value={promotion.sap_campaign_number} />
              )}
              {promotion.sap_sync_error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {promotion.sap_sync_error}
                </div>
              )}
            </SectionCard>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function SectionCard({
  icon, title, subtitle, count, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        {icon}
        <span className="text-sm font-semibold">{title}</span>
        {subtitle && <span className="text-xs text-muted-foreground">· {subtitle}</span>}
        {count != null && (
          <span className="ml-auto rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2.5 p-3">{children}</div>
    </div>
  );
}

function FilterPills({
  filters, labels, exclude = EMPTY_STRING_ARRAY, booleanKeys = EMPTY_STRING_ARRAY,
}: {
  filters: Record<string, unknown>;
  labels: Record<string, string>;
  exclude?: string[];
  booleanKeys?: string[];
}) {
  const entries = Object.entries(filters).filter(
    ([k, v]) => v != null && v !== '' && !exclude.includes(k)
  );
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => {
        const display = booleanKeys.includes(k) ? (v ? 'Si' : 'No') : String(v);
        return (
          <span key={k} className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-0.5 text-xs text-primary">
            {labels[k] ?? k}: {display}
          </span>
        );
      })}
    </div>
  );
}

function ScrollList({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
      {children}
    </div>
  );
}

function ListRow({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="min-w-0 truncate">{primary}</span>
      {secondary && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{secondary}</span>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <style>{`
        @keyframes iv-shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        .iv-shimmer { animation: iv-shimmer 1.4s ease-in-out infinite; }
      `}</style>
      <div className="relative h-10 overflow-hidden rounded-md bg-muted/35">
        <div className="iv-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>
    </>
  );
}

function PromoMetric({ icon: Icon, label, value, note }: { icon: React.ElementType; label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 break-words text-base font-bold leading-tight">{value}</p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function PromoFact({ label, value }: { label: string; value: unknown }) {
  const display = value === null || value === undefined || value === "" ? "N/A" : String(value);
  return (
    <div className="rounded-md bg-muted/35 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium">{display}</p>
    </div>
  );
}

function FinancialProgress({ percent, current, max }: { percent: number; current: number; max?: number | null }) {
  const hasLimit = Boolean(max && max > 0);
  const width    = hasLimit ? `${Math.max(4, Math.min(percent, 100))}%` : "100%";
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium">Uso de redenciones</span>
        <span className="text-muted-foreground">
          {hasLimit ? `${current} de ${max} (${percent.toFixed(0)}%)` : `${current} redenciones / sin limite`}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full bg-primary transition-[width] duration-700 ease-out ${hasLimit ? STRIPED_BAR_CLASS : "opacity-40"}`}
          style={{ width }}
        />
      </div>
    </div>
  );
}
