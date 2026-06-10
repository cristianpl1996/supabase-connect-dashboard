import type { CustomerBIProduct } from "@/lib/api";

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function addMonths(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const value = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodDelta(current: unknown, previous: unknown) {
  const currentValue = numeric(current);
  const previousValue = numeric(previous);
  if (!previousValue) return currentValue ? 1 : 0;
  return (currentValue - previousValue) / previousValue;
}

export function productShareData(products: CustomerBIProduct[], metric: "revenue" | "units") {
  const values = products.map((product) => ({
    name: product.product_commercial_name || product.product_sku || "Producto",
    value: metric === "revenue" ? numeric(product.total_revenue) : numeric(product.total_units),
  }));
  const top = values.slice(0, 5);
  const rest = values.slice(5).reduce((sum, item) => sum + item.value, 0);
  if (rest > 0) top.push({ name: "Otros", value: rest });
  const total = top.reduce((sum, item) => sum + item.value, 0);
  return top.map((item) => ({ ...item, share: total ? item.value / total : 0 }));
}
