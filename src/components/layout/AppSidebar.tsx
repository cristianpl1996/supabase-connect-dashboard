import React from "react";
import logoIco from "@/assets/logoico.png";
import logo from "@/assets/logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { mainNavItems, settingsNavItem, transfersNavItem } from "./navItems";

function getInitials(name?: string, username?: string): string {
  const source = name ?? username ?? "U";
  return source
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type NavItemData = { title: string; shortTitle: string; url: string; icon: React.ElementType };

interface NavItemProps {
  item: NavItemData;
  isCollapsed: boolean;
}

function NavItem({ item, isCollapsed }: NavItemProps) {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const isActive = pathname === item.url || (item.url !== "/home" && pathname.startsWith(item.url));

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
        <Link
          to={item.url}
          onClick={closeMobileSidebar}
          className={cn(
            "relative overflow-hidden",
            isActive
              ? "bg-gradient-to-r from-primary/12 via-primary/8 to-transparent text-primary hover:from-primary/16 hover:via-primary/10 hover:text-primary"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <item.icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
          <span className="truncate">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate("/login"); };
  const isSalesRep = user?.role === 'sales_rep';
  // sales_rep sees Agotados + Transferencias; others see the full nav
  const visibleNavItems: NavItemData[] = isSalesRep
    ? [
        { ...mainNavItems[mainNavItems.length - 2], title: "Reportar Agotados", shortTitle: "Reportar" },
        { ...transfersNavItem },
      ]
    : [...mainNavItems];

  const initials = getInitials(user?.full_name, user?.username);
  const displayName = user?.full_name ?? user?.username ?? "Usuario";
  const ROLE_LABELS: Record<string, string> = {
    sales_rep: "Representante de ventas",
    superadmin: "Superadmin",
    admin: "Administrador",
  };
  const displayRole = ROLE_LABELS[user?.role ?? ""] ?? user?.role ?? "Administrador";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-sidebar shadow-sm">
      <SidebarHeader
        className={cn(
          "flex items-center justify-center",
          isCollapsed ? "px-1 py-3" : "p-4 pb-3",
        )}
      >
        <Link to="/home" className="flex items-center justify-center" aria-label="Ir a inicio">
          {isCollapsed ? (
            <img
              src={logo}
              alt="Ivanagro"
              className="h-11 w-auto max-w-none object-contain transition dark:brightness-0 dark:invert"
            />
          ) : (
            <img src={logoIco} alt="Ivanagro" className="h-16 w-auto object-contain transition dark:brightness-0 dark:invert" />
          )}
        </Link>
      </SidebarHeader>

      <Separator className="opacity-40" />

      <SidebarContent className="px-2 py-3">
        <SidebarGroup className="p-0">
          {!isCollapsed && (
            <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Menu Principal
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {visibleNavItems.map((item) => (
                <NavItem key={item.url} item={item} isCollapsed={isCollapsed} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4">
        <Separator className="opacity-40" />
        {!isSalesRep && (
          <>
            <SidebarMenu>
              <NavItem item={settingsNavItem} isCollapsed={isCollapsed} />
            </SidebarMenu>
            <Separator className="opacity-40" />
          </>
        )}

        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center py-1">
                <Avatar className="size-7 ring-2 ring-border/30">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{displayRole}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/40 px-0.5 py-2.5 dark:bg-transparent">
            <Avatar className="size-7 shrink-0 ring-2 ring-border/30">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight text-sidebar-foreground">{displayName}</p>
              <p className="truncate text-xs leading-tight text-muted-foreground">{displayRole}</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={handleLogout} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <LogOut className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Cerrar sesión</p></TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
