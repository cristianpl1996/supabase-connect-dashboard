import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUp, Bell, LogOut, Menu, Moon, Settings, Sun } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";

import logo from "@/assets/logo.png";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem, type NotificationsSummary } from "@/lib/api";

const currentYear = new Date().getFullYear();

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `hace ${weeks}sem`;
  return new Date(isoString).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function getInitials(name?: string, username?: string): string {
  const source = name ?? username ?? "U";
  return source
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const showFooter = !isMobile && pathname !== "/map";
  const isDarkTheme = resolvedTheme === "dark";

  const initials = getInitials(user?.full_name, user?.username);
  const displayName = user?.full_name ?? user?.username ?? "Usuario";
  const ROLE_LABELS: Record<string, string> = {
    sales_rep: "Representante de ventas",
    superadmin: "Superadmin",
    admin: "Administrador",
  };
  const displayRole = ROLE_LABELS[user?.role ?? ""] ?? user?.role ?? "Administrador";

  const { data: notificationsSummary, refetch: refetchNotifications } = useQuery({
    queryKey: ["header-notifications"],
    queryFn: getNotifications,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const notifications = notificationsSummary?.items ?? [];
  const unreadCount = notificationsSummary?.unread_count ?? 0;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.is_read) {
      queryClient.setQueryData<NotificationsSummary>(["header-notifications"], (old) => {
        if (!old) return old;
        return {
          items: old.items.map((n) =>
            n.notification_key === notification.notification_key ? { ...n, is_read: true } : n
          ),
          unread_count: Math.max(0, old.unread_count - 1),
        };
      });
      void markNotificationRead(notification.notification_key).catch(() => {
        void refetchNotifications();
      });
    }
    navigate(notification.route);
  };

  const handleMarkAllAsRead = async () => {
    queryClient.setQueryData<NotificationsSummary>(["header-notifications"], (old) => {
      if (!old) return old;
      return {
        items: old.items.map((n) => ({ ...n, is_read: true })),
        unread_count: 0,
      };
    });
    try {
      await markAllNotificationsRead();
    } catch {
      void refetchNotifications();
    }
  };

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setShowBackToTop(window.scrollY > 520);
        ticking = false;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  const scrollToPageTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full overflow-clip">
        {!isMobile && <AppSidebar />}
        <SidebarInset className="min-w-0 flex-1">
          <header
            className={cn(
              "sticky top-0 z-20 flex h-14 min-w-0 items-center gap-3 border-b px-5 sm:px-5 lg:px-6",
              isMobile
                ? "border-sidebar-border bg-sidebar text-sidebar-foreground"
                : "border-border/60 bg-background",
            )}
          >
            {isMobile && (
              <button
                type="button"
                onClick={() => navigate("/home")}
                className="shrink-0 p-0"
                aria-label="Ir a inicio"
              >
                <img
                  src={logo}
                  alt="Ivanagro"
                  className="h-8 w-auto object-contain transition dark:brightness-0 dark:invert"
                />
              </button>
            )}

            {!isMobile && (
              <SidebarTrigger className="-ml-1 size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <Menu className="size-4" />
                <span className="sr-only">Toggle menu</span>
              </SidebarTrigger>
            )}

            <div className="flex-1" />

            <div
              className="flex h-9 items-center gap-2 rounded-full border border-border/60 bg-background/70 px-2 text-muted-foreground shadow-sm"
              title={isDarkTheme ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              <Sun
                className={cn(
                  "size-3.5 transition-colors",
                  !isDarkTheme && "text-primary",
                )}
              />
              <Switch
                checked={isDarkTheme}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                aria-label="Cambiar tema"
                className="h-5 w-9 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=checked]:bg-emerald-500 [&>span]:size-4 [&>span]:data-[state=checked]:translate-x-4"
              />
              <Moon
                className={cn(
                  "size-3.5 transition-colors",
                  isDarkTheme && "text-primary",
                )}
              />
            </div>

            <DropdownMenu
              open={isNotificationsOpen}
              onOpenChange={(open) => {
                setIsNotificationsOpen(open);
                if (open) {
                  void refetchNotifications();
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative size-8 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Notificaciones"
                >
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[calc(100vw-1.5rem)] max-w-96">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="px-0">Notificaciones</DropdownMenuLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={handleMarkAllAsRead}
                    disabled={unreadCount === 0}
                  >
                    Marcar todas como leidas
                  </Button>
                </div>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                    <Bell className="size-8 opacity-30" />
                    <p className="text-sm">Todo al día</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className={`cursor-pointer items-start gap-3 py-3 ${notification.is_read ? "opacity-60" : ""}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div
                        className={`mt-1.5 size-2 shrink-0 rounded-full transition-colors duration-150 ${
                          notification.is_read
                            ? "bg-muted-foreground/30"
                            : notification.level === "critical"
                            ? "bg-red-500"
                            : notification.level === "warning"
                              ? "bg-amber-500"
                              : "bg-sky-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${notification.is_read ? "font-normal" : "font-medium"}`}>
                            {notification.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground/70">
                            {formatRelativeTime(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-xs leading-4 text-muted-foreground">{notification.message}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="size-9 cursor-pointer ring-2 ring-border/40">
                  <AvatarFallback className="bg-primary/10 text-base font-bold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="mb-1 mt-1 flex flex-col gap-0.5">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    {user?.email && (
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    )}
                    <p className="mt-0.5 text-xs leading-none text-muted-foreground">
                      {displayRole}
                    </p>
                  </div>
                </DropdownMenuLabel>

                {user?.role !== 'sales_rep' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer gap-2">
                      <Link to="/settings">
                        <Settings className="size-4" />
                        Configuración
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer gap-2 font-medium text-destructive focus:bg-destructive/10 focus:text-destructive dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 dark:hover:text-red-200 dark:focus:bg-red-500/20 dark:focus:text-red-200"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4 text-current" />
                  Cerrar sesion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 md:px-8 md:pb-8 md:pt-8 xl:px-10">
            {children}
          </main>

          {showFooter && (
            <footer className="border-t border-border/60 bg-background/95 px-3 py-5 text-xs text-muted-foreground sm:px-5 md:px-8 xl:px-10">
              <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-center text-center">
                <p>&copy; {currentYear} Ivanagro S.A. Derechos reservados.</p>
              </div>
            </footer>
          )}

          {isMobile && <MobileBottomNav />}

          <div
            className={cn(
              "fixed right-4 z-50 transition-all duration-300 ease-out md:right-6",
              isMobile ? "bottom-[calc(5.9rem+env(safe-area-inset-bottom))]" : "bottom-6",
              showBackToTop ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-90 opacity-0",
            )}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-primary/30 motion-safe:animate-ping"
            />
            <Button
              type="button"
              size="icon"
              aria-label="Volver al inicio"
              title="Volver al inicio"
              onClick={scrollToPageTop}
              className={cn(
                "relative rounded-full border border-primary/20 bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform duration-200 hover:scale-105 hover:bg-primary/90 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isMobile ? "size-12" : "size-11",
              )}
            >
              <ArrowUp className={cn(isMobile ? "size-5" : "size-5")} />
            </Button>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
