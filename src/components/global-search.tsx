"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { formatBdt, formatUsd } from "@/lib/money";
import { homeForRole } from "@/lib/roles";
import type { SessionRole } from "@/lib/session";

type Results = {
  users: Array<{ id: string; name: string; email: string }>;
  admins: Array<{ id: string; name: string; email: string }>;
  payments: Array<{ id: string; userName: string; note: string; status: string; amountUsd: string; amountBdt: string }>;
};

export function GlobalSearch({ role }: { role: SessionRole }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setResults(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(value)}`)
        .then((response) => response.json())
        .then((payload: { data?: Results }) => setResults(payload.data ?? null))
        .catch(() => setResults(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const userHref = (id: string) => (role === "user" ? "/user/payments" : `/admin/users/${id}`);
  const paymentHref = role === "user" ? "/user/payments" : "/admin/payments";

  return (
    <div className="relative hidden min-w-0 flex-1 md:block md:max-w-md">
      <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search users, payments"
        aria-label="Search"
        className="h-9 w-full rounded-lg border bg-card pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary"
      />
      {open && results && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border bg-popover p-2 shadow-lg">
          {results.users.length === 0 && results.admins.length === 0 && results.payments.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">No matches</p>
          )}
          {results.users.map((user) => (
            <button key={user.id} type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => go(userHref(user.id))}>
              <span className="font-medium">{user.name}</span>
              <span className="ml-2 text-muted-foreground">{user.email}</span>
            </button>
          ))}
          {results.admins.map((admin) => (
            <button key={admin.id} type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => go("/super-admin/admins")}>
              <span className="font-medium">{admin.name}</span>
              <span className="ml-2 text-muted-foreground">Admin</span>
            </button>
          ))}
          {results.payments.map((payment) => (
            <button key={payment.id} type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => go(paymentHref)}>
              <span className="font-medium">{payment.userName}</span>
              <span className="ml-2 tabular text-muted-foreground">{formatUsd(payment.amountUsd)} · {formatBdt(payment.amountBdt)}</span>
            </button>
          ))}
          <button type="button" className="mt-1 w-full px-2 py-1 text-left text-xs text-muted-foreground" onClick={() => go(homeForRole(role))}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
