"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons: Record<string, typeof LayoutDashboard> = {
  Overview: LayoutDashboard,
  Admins: Shield,
  "Audit logs": ClipboardList,
  Users,
  Payments: CreditCard,
  Reports: ClipboardList,
  Accounts: Users,
  Settings,
};

export function SidebarNav({ items, collapsed }: { items: { href: string; label: string }[]; collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = icons[item.label] ?? LayoutDashboard;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800",
              active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-primary" />}
            <Icon className="size-4 shrink-0" />
            {!collapsed && item.label}
          </Link>
        );
      })}
    </nav>
  );
}
