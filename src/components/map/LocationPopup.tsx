import { Mail, MapPin, Phone, ShoppingCart, Wallet } from "lucide-react";
import { formatCOP, parseRFM } from "@/utils/mapUtils";
import type { Customer } from "@/types/map";

interface LocationPopupProps {
  customer: Customer;
  repColor: string;
}

function RFMBadge({ code }: { code: number }) {
  const { r, f, m } = parseRFM(code);
  const cls =
    r >= 4 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    r >= 2 ? "bg-amber-50 text-amber-700 border-amber-200" :
             "bg-red-50 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      RFM {code} <span className="opacity-50 font-normal">R{r}·F{f}·M{m}</span>
    </span>
  );
}

export function LocationPopup({ customer: c, repColor }: LocationPopupProps) {
  const dayColor =
    c.customer_days_since_last_purchase > 365 ? "#DC2626" :
    c.customer_days_since_last_purchase > 180 ? "#D97706" :
    c.customer_days_since_last_purchase > 90  ? "#CA8A04" : "#16A34A";

  return (
    <div className="w-[280px] font-sans text-xs text-gray-700">

      {/* Header */}
      <div className="px-3 py-2 text-white rounded-t-xl" style={{ backgroundColor: repColor }}>
        <p className="font-bold text-[12px] leading-tight">{c.customer_full_name}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="opacity-70 text-[10px] font-mono">{c.customer_government_id}</span>
          <span className="text-[9px] bg-white/20 rounded px-1.5 py-0.5">{c.customer_business_type}</span>
        </div>
      </div>

      <div className="p-2.5 space-y-2">

        {/* Sales rep */}
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 border" style={{ borderColor: `${repColor}30`, backgroundColor: `${repColor}08` }}>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: repColor }}>
            {c.sales_rep_full_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[11px] text-gray-800 truncate leading-tight">{c.sales_rep_full_name}</p>
            <p className="text-[10px] text-gray-500 truncate">{c.sales_rep_coverage_area}</p>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-1 text-[10px] text-gray-600">
          {c.customer_business_address && (
            <div className="flex gap-1.5 items-start">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
              <span className="leading-tight">{c.customer_business_address}</span>
            </div>
          )}
          {c.customer_cellphone && (
            <div className="flex gap-1.5 items-center">
              <Phone className="h-3 w-3 shrink-0 text-gray-400" />
              <span>{c.customer_cellphone}</span>
            </div>
          )}
          {c.customer_emails.length > 0 && (
            <div className="flex gap-1.5 items-start">
              <Mail className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
              <div>
                {c.customer_emails.map((email, i) => (
                  <p key={i} className="truncate max-w-[230px]">{email}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Metrics — compact inline rows */}
        <div className="rounded-md border border-gray-100 bg-gray-50 divide-y divide-gray-100">
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="flex items-center justify-between px-2 py-1 gap-2">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide">LTV</span>
              <span className="text-[11px] font-bold text-gray-800">{formatCOP(c.customer_total_lifetime_revenue)}</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1 gap-2">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide">Ticket</span>
              <span className="text-[11px] font-bold text-gray-800">{formatCOP(c.customer_average_purchase_ticket_amount)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="flex items-center justify-between px-2 py-1 gap-2">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide">Sin comprar</span>
              <span className="text-[11px] font-bold" style={{ color: dayColor }}>{c.customer_days_since_last_purchase}d</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1 gap-2">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide">Compras</span>
              <span className="text-[11px] font-bold text-gray-800">{c.customer_total_number_of_purchases}</span>
            </div>
          </div>
        </div>

        {/* RFM + wallet */}
        <div className="flex items-center justify-between">
          <RFMBadge code={c.customer_rfm_segment} />
          <span className={`flex items-center gap-1 text-[10px] ${c.customer_has_confirmed_digital_wallet ? "text-emerald-600" : "text-gray-400"}`}>
            <Wallet className="h-3 w-3" />
            {c.customer_has_confirmed_digital_wallet ? "Billetera activa" : "Sin billetera"}
          </span>
        </div>

        {/* Top products */}
        {c.customer_top_purchased_products_snapshot.length > 0 && (
          <div className="border-t border-gray-100 pt-1.5">
            <p className="flex items-center gap-1 text-[9px] text-gray-400 uppercase tracking-wider mb-1">
              <ShoppingCart className="h-3 w-3" /> Top productos
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {c.customer_top_purchased_products_snapshot.slice(0, 6).map((p, i) => (
                <div key={i} className="flex justify-between gap-1 text-[10px]">
                  <span className="text-gray-600 truncate leading-tight">{p.product}</span>
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
