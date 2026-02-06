import {
  LayoutDashboard,
  FileText,
  Tag,
  CalendarDays,
  Image,
  Wallet,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import logoIco from "@/assets/logoico.png";
import { NavLink } from "@/components/NavLink";
import { useSidebar } from "@/components/ui/sidebar";
import { usePromoter } from "@/contexts/PromoterContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const allMainNavItems = [
  { title: "Inicio", url: "/", icon: LayoutDashboard, promoterVisible: false },
  { title: "Planes y Negociaciones", url: "/plans", icon: FileText, promoterVisible: false },
  { title: "Promociones", url: "/promotions", icon: Tag, promoterVisible: true },
  { title: "Calendario Comercial", url: "/calendar", icon: CalendarDays, promoterVisible: false },
  { title: "Marketing Kit", url: "/marketing", icon: Image, promoterVisible: true },
  { title: "Billetera & Conciliación", url: "/wallet", icon: Wallet, promoterVisible: false },
];

const allFooterNavItems = [
  { title: "Configuración", url: "/settings", icon: Settings, promoterVisible: false },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { isPromoter } = usePromoter();
  const isCollapsed = state === "collapsed";

  const mainNavItems = isPromoter
    ? allMainNavItems.filter((item) => item.promoterVisible)
    : allMainNavItems;

  const footerNavItems = isPromoter
    ? allFooterNavItems.filter((item) => item.promoterVisible)
    : allFooterNavItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className={isCollapsed ? "h-16 flex items-center justify-center" : "h-20 px-4 flex items-center"}>
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} flex-nowrap`}>
          {/* Isotipo */}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg shrink-0 font-serif">
            I
          </div>

          {/* Logo */}
          {!isCollapsed && (
            <img src={logoIco} alt="IVANagro" className="h-7 max-w-[140px] w-auto shrink-0 object-contain block" />
          )}
        </div>
      </SidebarHeader>

      <Separator className="mx-4 w-auto" />

      <SidebarContent className={isCollapsed ? "px-1 py-4" : "px-2 py-4"}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={`flex items-center rounded-lg py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${isCollapsed ? "justify-center" : "gap-3 px-3"}`}
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={isCollapsed ? "p-1" : "p-2"}>
        <Separator className="mb-2" />
        <SidebarMenu>
          {footerNavItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <NavLink
                  to={item.url}
                  className={`flex items-center rounded-lg py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${isCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Cerrar Sesión">
              <button
                className={`flex w-full items-center rounded-lg py-2 text-destructive transition-colors hover:bg-destructive/10 ${isCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}
                onClick={() => console.log("Logout clicked")}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>Cerrar Sesión</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
