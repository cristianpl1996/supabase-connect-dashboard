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

const mobileNavItemClass =
  "h-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11px] font-medium leading-none transition-colors";

const mobileNavItemActiveClass =
  "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30 hover:bg-primary/15 hover:text-primary dark:bg-sidebar-accent dark:text-sidebar-accent-foreground dark:ring-sidebar-border dark:hover:bg-sidebar-accent dark:hover:text-sidebar-accent-foreground";

const mobileNavItemInactiveClass =
  "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground";

const mobileDrawerItemActiveClass =
  "border-primary/30 bg-primary/10 text-primary shadow-sm hover:bg-primary/15 hover:text-primary dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-accent-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-accent-foreground";

const mobileDrawerItemInactiveClass =
  "border-sidebar-border bg-sidebar text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground";

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
                mobileNavItemClass,
                active ? mobileNavItemActiveClass : mobileNavItemInactiveClass,
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
                mobileNavItemClass,
                moreActive || open ? mobileNavItemActiveClass : mobileNavItemInactiveClass,
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
                      active ? mobileDrawerItemActiveClass : mobileDrawerItemInactiveClass,
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
