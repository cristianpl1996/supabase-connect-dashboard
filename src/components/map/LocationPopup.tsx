import { Mail, MapPin, Phone, ShoppingBag, Wallet } from "lucide-react";
import { formatCOP, parseRFM } from "@/utils/mapUtils";
import type { Customer } from "@/types/map";

interface LocationPopupProps {
  customer: Customer;
  repColor: string;
}

function RFMPills({ code }: { code: number }) {
  const { r, f, m } = parseRFM(code);
  const color = (v: number): [string, string] =>
    v >= 4 ? ["#DCFCE7", "#15803D"] :
    v >= 2 ? ["#FEF9C3", "#A16207"] :
             ["#FEE2E2", "#DC2626"];
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] font-bold text-gray-500 mr-0.5">RFM</span>
      {([["R", r], ["F", f], ["M", m]] as [string, number][]).map(([l, v]) => {
        const [bg, txt] = color(v);
        return (
          <span key={l} className="rounded text-[10px] font-bold px-1.5 py-px" style={{ backgroundColor: bg, color: txt }}>
            {l}{v}
          </span>
        );
      })}
    </div>
  );
}

export function LocationPopup({ customer: c, repColor }: LocationPopupProps) {
  const dayColor =
    c.customer_days_since_last_purchase > 365 ? "#DC2626" :
    c.customer_days_since_last_purchase > 180 ? "#D97706" :
    c.customer_days_since_last_purchase > 90  ? "#CA8A04" : "#16A34A";

  const initials = c.sales_rep_full_name
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="w-full font-sans">

      {/* ── Header ── */}
      <div className="px-3 py-2.5 text-white" style={{ backgroundColor: repColor }}>
        {/* Nombre */}
        <p className="font-bold text-[12px] leading-tight uppercase tracking-wide">{c.customer_full_name}</p>

        {/* CN + tag en misma fila */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] font-mono opacity-60">{c.customer_government_id}</span>
          <span className="text-[9px] font-semibold bg-white/20 border border-white/25 rounded px-1.5 py-px leading-tight whitespace-nowrap">
            {c.customer_business_type}
          </span>
        </div>

        {/* Rep — compacto dentro del header */}
        <div className="flex items-center gap-1.5 mt-1.5 bg-black/10 rounded px-2 py-1">
          <div className="h-5 w-5 shrink-0 rounded-full bg-white/30 flex items-center justify-center text-[9px] font-bold">
            {initials}
          </div>
          <div className="min-w-0 flex items-baseline gap-1.5">
            <p className="text-[10px] font-semibold leading-none truncate shrink-0">{c.sales_rep_full_name}</p>
            <p className="text-[9px] opacity-60 leading-none truncate">· {c.sales_rep_coverage_area}</p>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 space-y-1.5">

        {/* ── Contacto ── */}
        <div className="space-y-0.5 text-[10px] text-gray-600">
          {c.customer_business_address && (
            <div className="flex gap-1.5 items-start">
              <MapPin className="h-3 w-3 mt-px shrink-0 text-gray-400" />
              <span className="leading-tight">{c.customer_business_address}</span>
            </div>
          )}
          {c.customer_cellphone && (
            <div className="flex gap-1.5 items-center">
              <Phone className="h-3 w-3 shrink-0 text-gray-400" />
              <span>{c.customer_cellphone}</span>
            </div>
          )}
          {c.customer_emails[0] && (
            <div className="flex gap-1.5 items-center">
              <Mail className="h-3 w-3 shrink-0 text-gray-400" />
              <span className="truncate max-w-[220px]">{c.customer_emails[0]}</span>
            </div>
          )}
        </div>

        {/* ── Métricas — 2×2 ── */}
        <div className="grid grid-cols-2 gap-1">
          {[
            { label: "LTV",         value: formatCOP(c.customer_total_lifetime_revenue),         color: undefined  },
            { label: "Ticket",      value: formatCOP(c.customer_average_purchase_ticket_amount), color: undefined  },
            { label: "Sin comprar", value: `${c.customer_days_since_last_purchase}d`,            color: dayColor   },
            { label: "Compras",     value: String(c.customer_total_number_of_purchases),         color: undefined  },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">{label}</span>
              <span className="text-[11px] font-bold" style={{ color: color ?? "#111827" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* ── RFM + billetera ── */}
        <div className="flex items-center justify-between">
          <RFMPills code={c.customer_rfm_segment} />
          <span className={`flex items-center gap-1 text-[10px] ${c.customer_has_confirmed_digital_wallet ? "text-emerald-600" : "text-gray-400"}`}>
            <Wallet className="h-3 w-3" />
            {c.customer_has_confirmed_digital_wallet ? "Billetera activa" : "Sin billetera"}
          </span>
        </div>

        {/* ── Top productos ── */}
        {c.customer_top_purchased_products_snapshot.length > 0 && (
          <div className="border-t border-gray-100 pt-1">
            <p className="flex items-center gap-1 text-[9px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">
              <ShoppingBag className="h-3 w-3" /> Top productos
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {c.customer_top_purchased_products_snapshot.slice(0, 6).map((p, i) => (
                <div key={i} className="flex justify-between gap-1 text-[10px]">
                  <span className="text-gray-600 truncate">{p.product}</span>
                  <span className="shrink-0 font-semibold text-gray-700">×{p.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
