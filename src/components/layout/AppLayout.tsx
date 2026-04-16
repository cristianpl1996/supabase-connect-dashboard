import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Bell, LogOut, User, Menu } from "lucide-react";
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
import { useNavigate } from "react-router-dom";

function getInitials(name?: string, username?: string): string {
  const source = name ?? username ?? "U";
  return source
    .split(" ")
    .map((w) => w[0])
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

  const initials = getInitials(user?.full_name, user?.username);
  const displayName = user?.full_name ?? user?.username ?? "Usuario";
  const displayRole = user?.role ?? "Administrador";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
            <SidebarTrigger className="-ml-1 h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Toggle menu</span>
            </SidebarTrigger>

            <div className="flex-1" />

            {/* Notifications bell */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Notificaciones"
            >
              <Bell className="h-4 w-4" />
              {/* Badge — remove when there are no notifications */}
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
            </Button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-9 w-9 ring-2 ring-border/40">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold" style={{ fontSize: "16px", cursor: "pointer" }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5 mt-1 mb-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    {user?.email && (
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    )}
                    <p className="text-xs leading-none text-muted-foreground capitalize mt-0.5">
                      {displayRole}
                    </p>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 p-6 md:p-10">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
