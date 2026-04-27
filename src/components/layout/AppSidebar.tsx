import logoIco from "@/assets/logoico.png";
import logo from "@/assets/logo.png";
import { Link, useLocation } from "react-router-dom";
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
import { mainNavItems, settingsNavItem } from "./navItems";

function getInitials(name?: string, username?: string): string {
  const source = name ?? username ?? "U";
  return source
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface NavItemProps {
  item: (typeof mainNavItems)[number] | typeof settingsNavItem;
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
              ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          {isActive && !isCollapsed && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
          )}
          <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
          <span className="truncate">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user } = useAuth();

  const initials = getInitials(user?.full_name, user?.username);
  const displayName = user?.full_name ?? user?.username ?? "Usuario";
  const displayRole = user?.role ?? "Administrador";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-sidebar shadow-sm">
      <SidebarHeader className="flex items-center justify-center p-4 pb-3">
        <Link to="/home" className="flex items-center justify-center" aria-label="Ir a inicio">
          {isCollapsed ? (
            <img src={logo} alt="Ivanagro" className="h-8 w-auto" />
          ) : (
            <img src={logoIco} alt="Ivanagro" className="h-16 w-auto object-contain" />
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
              {mainNavItems.map((item) => (
                <NavItem key={item.url} item={item} isCollapsed={isCollapsed} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4">
        <Separator className="opacity-40" />
        <SidebarMenu>
          <NavItem item={settingsNavItem} isCollapsed={isCollapsed} />
        </SidebarMenu>

        <Separator className="opacity-40" />

        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center py-1">
                <Avatar className="h-7 w-7 ring-2 ring-border/30">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-medium">{displayName}</p>
              <p className="text-xs capitalize text-muted-foreground">{displayRole}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/40 px-0.5 py-2.5">
            <Avatar className="h-7 w-7 shrink-0 ring-2 ring-border/30">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight text-sidebar-foreground">{displayName}</p>
              <p className="truncate text-xs capitalize leading-tight text-muted-foreground">{displayRole}</p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
