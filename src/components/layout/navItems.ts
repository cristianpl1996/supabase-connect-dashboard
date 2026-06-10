import {
  ArrowRightLeft,
  CalendarDays,
  FileText,
  Image,
  LayoutDashboard,
  LineChart,
  Map,
  Package,
  PackageX,
  ReceiptText,
  Settings,
  Tag,
  Users,
  Wallet,
} from "lucide-react";

export const mainNavItems = [
  { title: "Inicio", shortTitle: "Inicio", url: "/home", icon: LayoutDashboard },
  { title: "Planes y Negociaciones", shortTitle: "Planes", url: "/plans", icon: FileText },
  { title: "Promociones", shortTitle: "Promos", url: "/promotions", icon: Tag },
  { title: "Ordenes", shortTitle: "Ordenes", url: "/orders", icon: ReceiptText },
  { title: "Productos", shortTitle: "Productos", url: "/products", icon: Package },
  { title: "Clientes", shortTitle: "Clientes", url: "/customers", icon: Users },
  { title: "Análisis de Clientes", shortTitle: "Análisis", url: "/customer-bi", icon: LineChart },
  { title: "Calendario Comercial", shortTitle: "Calendario", url: "/calendar", icon: CalendarDays },
  { title: "Marketing Kit", shortTitle: "Marketing", url: "/marketing", icon: Image },
  { title: "Billetera & Conciliacion", shortTitle: "Billetera", url: "/wallet", icon: Wallet },
  { title: "Mapa de Clientes", shortTitle: "Mapa", url: "/map", icon: Map },
  { title: "Agotados", shortTitle: "Agotados", url: "/stockouts", icon: PackageX },
  { title: "Transferencias", shortTitle: "Transferencias", url: "/transfers", icon: ArrowRightLeft },
] as const;

export const stockoutsNavItem = {
  title: "Agotados",
  shortTitle: "Agotados",
  url: "/stockouts",
  icon: PackageX,
} as const;

export const transfersNavItem = {
  title: "Transferencias",
  shortTitle: "Transferencias",
  url: "/transfers",
  icon: ArrowRightLeft,
} as const;

export const salesRepMoreNavItems = [stockoutsNavItem, transfersNavItem] as const;

export const settingsNavItem = {
  title: "Configuracion",
  shortTitle: "Configuracion",
  url: "/settings",
  icon: Settings,
} as const;

export const mobilePrimaryNavItems = [
  mainNavItems[0],
  mainNavItems[2],
  mainNavItems[3],
  mainNavItems[4],
] as const;

export const mobileMoreNavItems = [
  mainNavItems[1],
  mainNavItems[5],
  mainNavItems[6],
  mainNavItems[7],
  mainNavItems[8],
  mainNavItems[9],
  mainNavItems[10],
  mainNavItems[11],
  mainNavItems[12],
] as const;
