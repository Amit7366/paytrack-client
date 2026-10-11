"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { GlobalSearch } from "@/components/global-search";
import { LogoutButton } from "@/components/logout-button";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth";
import { navForRole, ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function DashboardShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("paytrack-sidebar") === "collapsed");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      window.localStorage.setItem("paytrack-sidebar", current ? "expanded" : "collapsed");
      return !current;
    });
  };

  return (
    <div className="flex min-h-full flex-1 bg-background">
      {open && (
        <button type="button" className="fixed inset-0 z-30 bg-slate-900/45 md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] shrink-0 flex-col border-r bg-sidebar px-3 py-5 transition-all md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed && "md:w-[72px]",
        )}
      >
        <div className={cn("flex items-center gap-2 px-2", collapsed && "md:justify-center md:px-0")}>
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">PT</span>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-foreground">PayTrack</p>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">USD · BDT</p>
            </div>
          )}
        </div>
        <div className="mt-6 flex-1">
          <SidebarNav items={navForRole(user.role)} collapsed={collapsed} />
        </div>
        <Button type="button" variant="ghost" className="hidden md:inline-flex" onClick={toggleCollapsed}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed && "Collapse"}
        </Button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur md:px-6">
          <Button type="button" variant="outline" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu />
          </Button>
          <GlobalSearch role={user.role} />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
