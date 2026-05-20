import type { EcommerceMyOrder } from "@/lib/api";

export type OrderStateFilter = "all" | "open" | "closed";

export function getEcommerceOrderStateLabel(status: string) {
  const normalized = status.toLowerCase();
  return ["cancelled", "closed", "completed"].includes(normalized) ? "Cerrado" : "Abierto";
}

function getEcommerceOrderState(status: string): Exclude<OrderStateFilter, "all"> {
  return getEcommerceOrderStateLabel(status) === "Cerrado" ? "closed" : "open";
}

export function getItemCountLabel(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

export function filterEcommerceOrders(
  orders: EcommerceMyOrder[],
  filters: { state: OrderStateFilter; dateFrom: string; dateTo: string },
) {
  return orders.filter((order) => {
    const matchesState = filters.state === "all" || getEcommerceOrderState(order.status) === filters.state;
    const orderDate = order.created_at.slice(0, 10);
    const matchesFrom = !filters.dateFrom || orderDate >= filters.dateFrom;
    const matchesTo = !filters.dateTo || orderDate <= filters.dateTo;
    return matchesState && matchesFrom && matchesTo;
  });
}
