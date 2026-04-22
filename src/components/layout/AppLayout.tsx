import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu } from "lucide-react";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { getNotifications, type NotificationItem } from "@/lib/api";

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const initials = getInitials(user?.full_name, user?.username);
  const displayName = user?.full_name ?? user?.username ?? "Usuario";
  const displayRole = user?.role ?? "Administrador";

  useEffect(() => {
    let mounted = true;

    const loadNotifications = async () => {
      try {
        const response = await getNotifications();
        if (!mounted) return;
        setNotifications(response.items);
        setUnreadCount(response.unread_count);
      } catch (error) {
        console.error("Error loading notifications:", error);
        if (!mounted) return;
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    navigate(notification.route);
  };

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
            <SidebarTrigger className="-ml-1 h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Toggle menu</span>
            </SidebarTrigger>

            <div className="flex-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Notificaciones"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-96">
                <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <DropdownMenuItem disabled>No hay notificaciones nuevas</DropdownMenuItem>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="cursor-pointer items-start gap-3 py-3"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${
                          notification.level === "critical"
                            ? "bg-red-500"
                            : notification.level === "warning"
                              ? "bg-amber-500"
                              : "bg-sky-500"
                        }`}
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{notification.title}</p>
                        <p className="text-xs leading-5 text-muted-foreground">{notification.message}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-border/40">
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
                    <p className="mt-0.5 text-xs capitalize leading-none text-muted-foreground">
                      {displayRole}
                    </p>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 p-6 md:p-10">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
