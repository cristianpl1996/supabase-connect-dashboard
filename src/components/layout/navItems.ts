import {
  CalendarDays,
  FileText,
  Image,
  LayoutDashboard,
  Map,
  Package,
  Settings,
  Tag,
  Users,
  Wallet,
} from "lucide-react";

export const mainNavItems = [
  { title: "Inicio", shortTitle: "Inicio", url: "/home", icon: LayoutDashboard },
  { title: "Planes y Negociaciones", shortTitle: "Planes", url: "/plans", icon: FileText },
  { title: "Promociones", shortTitle: "Promos", url: "/promotions", icon: Tag },
  { title: "Productos", shortTitle: "Productos", url: "/products", icon: Package },
  { title: "Clientes", shortTitle: "Clientes", url: "/customers", icon: Users },
  { title: "Calendario Comercial", shortTitle: "Calendario", url: "/calendar", icon: CalendarDays },
  { title: "Marketing Kit", shortTitle: "Marketing", url: "/marketing", icon: Image },
  { title: "Billetera & Conciliacion", shortTitle: "Billetera", url: "/wallet", icon: Wallet },
  { title: "Mapa de Clientes", shortTitle: "Mapa", url: "/map", icon: Map },
] as const;

export const settingsNavItem = {
  title: "Configuracion",
  shortTitle: "Configuracion",
  url: "/settings",
  icon: Settings,
} as const;

export const mobilePrimaryNavItems = [
  mainNavItems[2],
  mainNavItems[3],
  mainNavItems[0],
  mainNavItems[4],
] as const;

export const mobileMoreNavItems = [
  mainNavItems[1],
  mainNavItems[5],
  mainNavItems[6],
  mainNavItems[7],
  mainNavItems[8],
  settingsNavItem,
] as const;
