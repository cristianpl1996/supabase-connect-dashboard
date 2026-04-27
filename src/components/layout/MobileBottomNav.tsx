import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { mobileMoreNavItems, mobilePrimaryNavItems } from "./navItems";

function isRouteActive(pathname: string, url: string) {
  return pathname === url || (url !== "/home" && pathname.startsWith(url));
}

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const moreActive = mobileMoreNavItems.some((item) => isRouteActive(pathname, item.url));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 text-sidebar-foreground shadow-[0_-8px_24px_rgba(15,23,42,0.14)] md:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-stretch gap-1">
        {mobilePrimaryNavItems.map((item) => {
          const active = isRouteActive(pathname, item.url);
          return (
            <Button
              key={item.url}
              variant="ghost"
              asChild
              className={cn(
                "h-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11px] font-medium leading-none",
                active ? "bg-primary/10 text-primary" : "text-sidebar-foreground/70",
              )}
            >
              <Link to={item.url} aria-current={active ? "page" : undefined}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="w-full truncate leading-none">{item.shortTitle}</span>
              </Link>
            </Button>
          );
        })}

        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "h-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11px] font-medium leading-none",
                moreActive || open ? "bg-primary/10 text-primary" : "text-sidebar-foreground/70",
              )}
            >
              <MoreHorizontal className="h-5 w-5 shrink-0" />
              <span className="w-full truncate leading-none">Mas</span>
            </Button>
          </DrawerTrigger>
          <DrawerContent className="border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
            <div className="mt-2 grid grid-cols-3 gap-2 bg-sidebar px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
              {mobileMoreNavItems.map((item) => {
                const active = isRouteActive(pathname, item.url);
                return (
                  <Button
                    key={item.url}
                    variant="outline"
                    asChild
                    className={cn(
                      "relative h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-xl px-2 text-center text-xs",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                        : "bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Link to={item.url} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}>
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="w-full truncate">{item.shortTitle}</span>
                    </Link>
                  </Button>
                );
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </nav>
  );
}
