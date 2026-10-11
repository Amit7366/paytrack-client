"use client";

import Decimal from "decimal.js";
import { ArrowLeft, BadgeCheck, CircleCheck, Clock3, Download, Landmark, Mail, MoreHorizontal, Pencil, Phone, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { emptyTotals, type Period, type ReportTotals, type SeriesPoint } from "@/components/reports/report-types";
import type { ManagedUser } from "@/components/users-manager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PaymentEntryDialog, type PaymentEntryValues } from "@/components/payment-entry-dialog";
import { formatBdt, formatUsd } from "@/lib/money";
import { METHOD_LABELS, PAYMENT_METHODS } from "@/lib/validations/payment";

type HistoryRow = {
  id: string;
  method: (typeof PAYMENT_METHODS)[number];
  amountUsd: string;
  rateBdt: string;
  amountBdt: string;
  paymentDate: string;
  status: "paid" | "unpaid";
  note: string;
  paidAt: string | null;
  paidByName: string | null;
};

const periods: Array<{ id: Period; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

const readError = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || "Request failed";
};

const iso = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const monthBounds = () => {
  const today = new Date();
  return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
};

const stamp = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

const shortId = (id: string) => id.slice(-6).toUpperCase();

const share = (part: string, total: string) => {
  const whole = new Decimal(total || 0);
  if (whole.isZero()) return "0.0";
  return new Decimal(part || 0).div(whole).mul(100).toFixed(1);
};

export function UserReport({ user }: { user: ManagedUser }) {
  const [profile, setProfile] = useState(user);
  const [period, setPeriod] = useState<Period>("monthly");
  const [range, setRange] = useState<"all" | "month" | "custom">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "unpaid">("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<ReportTotals>(emptyTotals());
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [payments, setPayments] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dialog, setDialog] = useState<"user" | "payment" | "export" | HistoryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HistoryRow | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ period, status, page: String(page), limit: String(limit) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const cardParams = new URLSearchParams(params);
    cardParams.set("status", "all");
    cardParams.set("page", "1");
    const [response, cardResponse] = await Promise.all([
      fetch(`/api/reports/user/${profile.id}?${params.toString()}`),
      status === "all" ? Promise.resolve(null) : fetch(`/api/reports/user/${profile.id}?${cardParams.toString()}`),
    ]);
    if (!response.ok) {
      toast.error(await readError(response));
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as {
      data: { totals: ReportTotals; series: SeriesPoint[]; payments: HistoryRow[]; total: number; totalPages: number };
    };
    const cards = cardResponse
      ? ((await cardResponse.json()) as { data?: { totals: ReportTotals; series: SeriesPoint[] } })
      : null;
    setTotals(cards?.data?.totals ?? payload.data.totals);
    setSeries(cards?.data?.series ?? payload.data.series);
    setPayments(payload.data.payments);
    setTotal(payload.data.total);
    setTotalPages(payload.data.totalPages);
    setLoading(false);
  }, [from, limit, page, period, profile.id, status, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return payments;
    return payments.filter((payment) =>
      [payment.note, payment.method, METHOD_LABELS[payment.method], payment.amountUsd, payment.id].join(" ").toLowerCase().includes(needle),
    );
  }, [payments, query]);

  const bars = useMemo(() => series.slice(-6), [series]);
  const maxBar = Math.max(...bars.map((point) => Number(point.bdt) || 0), 1);
  const peakIndex = bars.reduce((best, point, index) => (Number(point.bdt) > Number(bars[best]?.bdt ?? 0) ? index : best), 0);
  const settled = share(totals.paidBdt, totals.totalBdt);
  const queued = share(totals.unpaidBdt, totals.totalBdt);
  const averageTicket = totals.paymentCount ? formatUsd(new Decimal(totals.totalUsd).div(totals.paymentCount).toFixed(2)) : "$0.00";
  const editing = dialog && dialog !== "user" && dialog !== "payment" && dialog !== "export" ? dialog : null;
  const startRow = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRow = Math.min(page * limit, total);

  const chooseRange = (next: "all" | "month" | "custom") => {
    setRange(next);
    setPage(1);
    if (next === "all") {
      setFrom("");
      setTo("");
    }
    if (next === "month") {
      const bounds = monthBounds();
      setFrom(bounds.from);
      setTo(bounds.to);
    }
  };

  const exportCsv = async () => {
    const params = new URLSearchParams({ type: "payments", format: "csv", period, status, userId: profile.id });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const response = await fetch(`/api/reports/export?${params}`);
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${profile.name.replace(/\s+/g, "-").toLowerCase()}-ledger.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setDialog(null);
  };

  const mark = async (id: string, paid: boolean) => {
    const response = await fetch(`/api/payments/${id}/${paid ? "mark-paid" : "mark-unpaid"}`, { method: "POST" });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    toast.success(paid ? "Payment marked paid" : "Payment marked unpaid");
    setRowMenu(null);
    await load();
  };

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const response = await fetch(`/api/admin/users/${profile.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    setPending(false);
    if (!response.ok) {
      const message = await readError(response);
      setFormError(message);
      toast.error(message);
      return;
    }
    setProfile((current) => ({ ...current, name, email }));
    toast.success("User updated");
    setDialog(null);
  };

  const submitPayment = async (values: PaymentEntryValues) => {
    const markNow = !editing && values.initialStatus === "paid";
    setPending(true);
    const payload: Record<string, string> = {
      userId: profile.id,
      method: values.method,
      paymentDate: values.paymentDate,
      note: values.note,
      amountUsd: values.amountUsd,
      rateBdt: values.rateBdt,
    };
    const response = await fetch(editing ? `/api/payments/${editing.id}` : "/api/payments", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setPending(false);
      const message = await readError(response);
      setFormError(message);
      toast.error(message);
      return;
    }
    if (!editing && markNow) {
      const created = (await response.json()) as { data?: { id?: string } };
      if (created.data?.id) {
        const paid = await fetch(`/api/payments/${created.data.id}/mark-paid`, { method: "POST" });
        if (!paid.ok) toast.error(await readError(paid));
      }
    }
    setPending(false);
    toast.success(editing ? "Payment updated" : "Payment added");
    setDialog(null);
    await load();
  };

  const removePayment = async () => {
    if (!deleteTarget) return;
    setPending(true);
    const response = await fetch(`/api/payments/${deleteTarget.id}`, { method: "DELETE" });
    setPending(false);
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    toast.success("Payment deleted");
    setDeleteTarget(null);
    await load();
  };

  const freeze = async () => {
    setMenuOpen(false);
    const response = await fetch(`/api/admin/users/${profile.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !profile.isActive }),
    });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    setProfile((current) => ({ ...current, isActive: !current.isActive }));
    toast.success(profile.isActive ? "User deactivated" : "User activated");
  };

  const openPayment = (row?: HistoryRow) => {
    setFormError("");
    setRowMenu(null);
    setDialog(row ?? "payment");
  };

  return (
    <div className="-mx-4 -my-6 min-h-full bg-[#faf8ff] px-4 py-6 text-[#131b2e] md:-mx-8 md:-my-8 md:px-8">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#464555]">
          <Link href="/admin/users" className="inline-flex items-center gap-1.5 rounded-lg bg-[#eaedff] px-3 py-1.5 font-medium text-[#464555] hover:bg-[#e2e7ff]">
            <ArrowLeft className="size-4" />
            Back to Users
          </Link>
          <span>Counterparties</span>
          <span>/</span>
          <span className="font-medium text-[#131b2e]">{profile.name}</span>
          <span className="rounded bg-[#e6e1ec] px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-[#464555]">USR-{shortId(profile.id)}</span>
          <span className="inline-flex items-center gap-1.5 text-[12px]">
            <span className="size-1.5 rounded-full bg-[#006e2d]" />
            Audit synced with the ledger
          </span>
        </div>

        <section className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm">
          <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-[#4f46e5]/5 blur-3xl" />
          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex gap-4">
              <div className="relative shrink-0">
                <div className="flex size-20 items-center justify-center rounded-xl bg-[#e2e7ff] text-2xl font-bold text-[#3525cd] shadow-sm">
                  {initials(profile.name)}
                </div>
                <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-[#006e2d] text-white shadow-sm">
                  <BadgeCheck className="size-3.5" />
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[28px] leading-none font-bold tracking-tight">{profile.name}</h1>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${profile.isActive ? "bg-[#7cf994]/40 text-[#006e2d]" : "bg-[#ffddb8] text-[#684000]"}`}>
                    <span className={`size-1.5 rounded-full ${profile.isActive ? "bg-[#006e2d]" : "bg-[#684000]"}`} />
                    {profile.isActive ? "Active entity" : "Inactive"}
                  </span>
                  <span className="rounded bg-[#eaedff] px-2 py-0.5 text-[11px] font-semibold text-[#3525cd]">Tier-3 verified KYC</span>
                </div>
                <p className="mt-2 text-[13px] text-[#464555]">US-BD Tech & Trade corridor • Assigned counterparty</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#464555]">
                  <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" />{profile.email}</span>
                  <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" />Phone not linked</span>
                  <span className="inline-flex items-center gap-1.5"><Landmark className="size-3.5" />Bank profile not linked</span>
                  <span className="inline-flex items-center gap-1.5"><BadgeCheck className="size-3.5" />Tax ID not on file</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#eaedff] px-3 py-2 text-[13px] font-medium hover:bg-[#e2e7ff]" onClick={() => setDialog("export")}>
                <Download className="size-4" /> Statement CSV
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#eaedff] px-3 py-2 text-[13px] font-medium hover:bg-[#e2e7ff]" onClick={() => { setFormError(""); setDialog("user"); }}>
                <Pencil className="size-4" /> Edit User
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#4f46e5] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#3525cd]" onClick={() => openPayment()}>
                <Plus className="size-4" /> Add Payment
              </button>
              <div className="relative">
                <button type="button" aria-label="More actions" className="flex size-9 items-center justify-center rounded-lg bg-[#eaedff] hover:bg-[#e2e7ff]" onClick={() => setMenuOpen((open) => !open)}>
                  <MoreHorizontal className="size-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl bg-white py-1 text-[13px] shadow-xl">
                    <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#faf8ff]" onClick={() => { setMenuOpen(false); toast.message("Entity audit logs are not on this desk yet."); }}>View entity audit logs</button>
                    <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#faf8ff]" onClick={() => { setMenuOpen(false); toast.message("Custom FX spread is not connected yet."); }}>Adjust custom FX spread</button>
                    <button type="button" className="block w-full px-3 py-2 text-left text-[#684000] hover:bg-[#fff4e8]" onClick={() => void freeze()}>{profile.isActive ? "Freeze counterparty" : "Activate counterparty"}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-[#eaedff]/60 p-4 text-[12px] text-[#464555]">
            <p><span className="block text-[11px] font-semibold tracking-wide uppercase">Settlement SLA</span>T+0 same day BEFTN / RTGS</p>
            <p><span className="block text-[11px] font-semibold tracking-wide uppercase">Designated treasury desk</span>Dhaka Central Forex Desk</p>
            <p><span className="block text-[11px] font-semibold tracking-wide uppercase">Active FX contract</span>Spot pegged to each payment rate</p>
            <p className="text-[#006e2d]"><span className="block font-semibold tracking-wide uppercase">Corridor note</span>Bangladesh Bank form status not linked</p>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Wallet className="size-5" />} iconClass="bg-[#4f46e5]/10 text-[#3525cd]" label="Total USD volume" value={loading ? "…" : formatUsd(totals.totalUsd)} hint={`${totals.paymentCount} lifetime transfers · Avg ${averageTicket}`} />
          <Metric icon={<Landmark className="size-5" />} iconClass="bg-[#eaedff] text-[#131b2e]" label="Total BDT volume" value={loading ? "…" : formatBdt(totals.totalBdt)} hint="South Asian notation · Aggregate gross" pill="Gross" />
          <Metric icon={<CircleCheck className="size-5" />} iconClass="bg-[#7cf994]/40 text-[#006e2d]" label="Paid BDT" value={loading ? "…" : formatBdt(totals.paidBdt)} hint={`${totals.paidCount} disbursed`} pill={`${settled}% cleared`} pillClass="bg-[#7cf994]/40 text-[#006e2d]" valueClass="text-[#006e2d]" />
          <Metric icon={<Clock3 className="size-5" />} iconClass="bg-[#ffddb8] text-[#684000]" label="Unpaid BDT" value={loading ? "…" : formatBdt(totals.unpaidBdt)} hint={`${totals.unpaidCount} pending`} pill={`${queued}% in queue`} pillClass="bg-[#ffddb8] text-[#684000]" valueClass="text-[#684000]" />
        </div>

        <section className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
            <div>
              <h2 className="text-lg font-bold">
                Disbursement & volume velocity <span className="ml-1 rounded bg-[#eaedff] px-1.5 py-0.5 text-[11px] font-semibold text-[#464555]">USD/BDT</span>
              </h2>
              <p className="text-xs text-[#464555]">Historical settlement flow and clearing efficiency for {profile.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="rounded-lg bg-[#eaedff] px-3 py-1.5 text-[12px] text-[#464555]">Realized avg rate ৳{new Decimal(totals.averageRate || 0).toFixed(2)} / USD</p>
              <div className="inline-flex rounded-lg bg-[#eaedff] p-1">
                {periods.map((item) => (
                  <button key={item.id} type="button" className={`rounded px-2.5 py-1 text-[11px] font-semibold ${period === item.id ? "bg-white text-[#3525cd] shadow-sm" : "text-[#464555]"}`} onClick={() => { setPeriod(item.id); setPage(1); }}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="relative rounded-xl bg-[#eaedff]/40 p-5">
            <div className="mb-4 flex flex-wrap justify-between gap-3 text-[11px] font-semibold text-[#464555]">
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#006e2d]" /> Paid & cleared (BDT)</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#ffb95f]" /> Pending / in review (BDT)</span>
              <span>Scale: BDT volume</span>
            </div>
            <div className="flex h-52 items-end gap-3">
              {bars.length === 0 && <p className="text-sm text-[#464555]">No payments in this range.</p>}
              {bars.map((point, index) => {
                const paid = Number(point.paidBdt) || 0;
                const unpaid = Number(point.unpaidBdt) || 0;
                const height = ((paid + unpaid) / maxBar) * 100;
                const paidShare = paid + unpaid === 0 ? 0 : (paid / (paid + unpaid)) * 100;
                const showTip = hover === index || (hover === null && index === peakIndex && paid + unpaid > 0);
                return (
                  <button key={point.label} type="button" className="relative flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
                    {showTip && (
                      <span className="absolute bottom-[calc(100%-8px)] left-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-xl bg-[#1e1b4b] px-3 py-2 text-left text-[11px] text-white shadow-xl">
                        {point.label}{index === peakIndex ? " · Peak" : ""}
                        <span className="mt-1 block font-semibold">{formatUsd(point.usd)} · {formatBdt(point.bdt)}</span>
                        <span className="block text-white/80">{point.count} disbursements · ৳{new Decimal(point.averageRate || 0).toFixed(2)} effective</span>
                      </span>
                    )}
                    <span className="flex w-8 flex-col justify-end overflow-hidden rounded-t-md sm:w-10" style={{ height: `${Math.max(height, paid + unpaid > 0 ? 10 : 0)}%` }}>
                      <span className="bg-[#ffb95f]" style={{ height: `${100 - paidShare}%` }} />
                      <span className="bg-[#006e2d]" style={{ height: `${paidShare}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 grid text-center text-[11px] text-[#464555]" style={{ gridTemplateColumns: `repeat(${Math.max(bars.length, 1)}, minmax(0, 1fr))` }}>
              {bars.map((point) => <span key={point.label} className="truncate">{point.label}</span>)}
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#eeeaf4] px-2 pt-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap">
              {([
                ["all", "All payments", totals.paymentCount, "bg-[#4f46e5]/10 text-[#3525cd]"],
                ["paid", "Paid", totals.paidCount, "bg-[#7cf994]/40 text-[#006e2d]"],
                ["unpaid", "Unpaid", totals.unpaidCount, "bg-[#ffddb8] text-[#684000]"],
              ] as const).map(([item, label, count, badge]) => (
                <button key={item} type="button" className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-[13px] font-semibold ${status === item ? "bg-[#eaedff] text-[#3525cd]" : "text-[#464555] hover:bg-[#eaedff]/50"}`} onClick={() => { setStatus(item); setPage(1); }}>
                  {label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${badge}`}>{count}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <input aria-label="Search payments" value={query} placeholder="Search this page" className="h-9 rounded-lg bg-[#eaedff] px-3 text-[13px] outline-none" onChange={(event) => setQuery(event.target.value)} />
              <select aria-label="Date range" className="h-9 rounded-lg bg-white px-3 text-[13px] shadow-sm" value={range} onChange={(event) => chooseRange(event.target.value as "all" | "month" | "custom")}>
                <option value="all">All time ({totals.paymentCount} txns)</option>
                <option value="month">This month</option>
                <option value="custom">Custom date range</option>
              </select>
              {range === "custom" && (
                <>
                  <input aria-label="From" type="date" value={from} className="h-9 rounded-lg border border-[#c7c4d7] px-2 text-[13px]" onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
                  <input aria-label="To" type="date" value={to} className="h-9 rounded-lg border border-[#c7c4d7] px-2 text-[13px]" onChange={(event) => { setTo(event.target.value); setPage(1); }} />
                </>
              )}
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#eaedff] px-3 py-2 text-[13px] font-medium hover:bg-[#e2e7ff]" onClick={() => void exportCsv()}>
                <Download className="size-4" /> Download statement CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead className="text-[11px] tracking-wide text-[#464555] uppercase">
                <tr className="border-b border-[#eeeaf4]">
                  <th className="px-4 py-3 font-semibold">Date & txn</th>
                  <th className="px-4 py-3 font-semibold">USD amount</th>
                  <th className="px-4 py-3 font-semibold">FX rate</th>
                  <th className="px-4 py-3 font-semibold">BDT amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Paid by</th>
                  <th className="px-4 py-3 font-semibold">Paid at</th>
                  <th className="px-4 py-3 font-semibold">Note</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-[#464555]">No payments in this range.</td>
                  </tr>
                )}
                {visible.map((payment) => (
                  <tr key={payment.id} className="border-b border-[#f3f0f6]">
                    <td className="px-4 py-3">
                      <span className="block font-medium">{new Date(payment.paymentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span className="text-[11px] text-[#464555]">TXN-{shortId(payment.id)} · {METHOD_LABELS[payment.method]}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatUsd(payment.amountUsd)}</td>
                    <td className="px-4 py-3 tabular-nums">৳{new Decimal(payment.rateBdt || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBdt(payment.amountBdt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${payment.status === "paid" ? "bg-[#7cf994]/40 text-[#006e2d]" : "bg-[#ffddb8] text-[#684000]"}`}>
                        {payment.status === "paid" ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {payment.paidByName ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-[#4f46e5]/10 text-[11px] font-bold text-[#3525cd]">{initials(payment.paidByName)}</span>
                          {payment.paidByName}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#464555]">{payment.paidAt ? stamp(payment.paidAt) : "Awaiting dispatch"}</td>
                    <td className="max-w-48 px-4 py-3 text-[#464555]">{payment.note || "—"}</td>
                    <td className="relative px-4 py-3 text-right">
                      {payment.status === "unpaid" ? (
                        <button type="button" className="rounded bg-[#006e2d] px-2 py-1 text-[12px] font-semibold text-white" onClick={() => void mark(payment.id, true)}>
                          Mark paid
                        </button>
                      ) : null}
                      <button type="button" aria-label="Row actions" className="ml-1 rounded p-1 text-[#464555] hover:bg-[#eaedff]" onClick={() => setRowMenu(rowMenu === payment.id ? null : payment.id)}>
                        <MoreHorizontal className="size-4" />
                      </button>
                      {rowMenu === payment.id && (
                        <div className="absolute right-4 z-20 mt-1 w-40 rounded-xl border border-[#e6e0ec] bg-white p-1 text-left text-[13px] shadow-lg">
                          {payment.status === "paid" && (
                            <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#faf8ff]" onClick={() => { setRowMenu(null); void mark(payment.id, false); }}>Mark unpaid</button>
                          )}
                          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#faf8ff]" onClick={() => openPayment(payment)}>Edit entry</button>
                          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-[#684000] hover:bg-[#fff4e8]" onClick={() => { setRowMenu(null); setDeleteTarget(payment); }}>Delete record</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] text-[#464555]">
            <p>Showing {startRow} to {endRow} of {total} payments</p>
            <div className="flex items-center gap-2">
              <label className="text-[12px]">
                Rows
                <select aria-label="Rows per page" className="ml-2 h-8 rounded-lg border border-[#c7c4d7] bg-white px-2" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
                  {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Prev</Button>
              <span>Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={dialog === "user"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit counterparty</DialogTitle>
            <DialogDescription>Name and email are saved. Phone, bank, and tax ID are not on this ledger yet.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUser} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="entity-name">Name</FieldLabel>
                <Input id="entity-name" name="name" defaultValue={profile.name} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="entity-email">Email</FieldLabel>
                <Input id="entity-email" name="email" type="email" defaultValue={profile.email} required />
              </Field>
              <FieldError>{formError}</FieldError>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PaymentEntryDialog
        open={dialog === "payment" || editing !== null}
        users={[{ id: profile.id, name: profile.name }]}
        fixedUser={{ id: profile.id, name: profile.name }}
        editing={editing ? { ...editing, userId: profile.id, userName: profile.name } : null}
        allowInitialStatus
        pending={pending}
        formError={formError}
        onClose={() => setDialog(null)}
        onSubmit={(values) => void submitPayment(values)}
        onMarkUnpaid={editing ? () => { setDialog(null); void mark(editing.id, false); } : undefined}
      />

      <Dialog open={dialog === "export"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate ledger statement</DialogTitle>
            <DialogDescription>{profile.name}. This CSV includes the payments in the current date and status filters, with USD, rate, BDT, and notes.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="button" onClick={() => void exportCsv()}>Download CSV now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete record</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `${formatUsd(deleteTarget.amountUsd)} on ${new Date(deleteTarget.paymentDate).toLocaleDateString()}` : ""} will be removed from this counterparty.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={() => void removePayment()}>{pending ? "Deleting..." : "Delete record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon, iconClass, label, value, hint, pill, pillClass = "bg-[#eaedff] text-[#464555]", valueClass = "text-[#131b2e]" }: { icon: ReactNode; iconClass: string; label: string; value: string; hint: string; pill?: string; pillClass?: string; valueClass?: string }) {
  return (
    <article className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex size-10 items-center justify-center rounded-lg ${iconClass}`}>{icon}</div>
        {pill ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pillClass}`}>{pill}</span> : null}
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-wide text-[#464555] uppercase">{label}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
        <p className="mt-1 text-[12px] text-[#464555]">{hint}</p>
      </div>
    </article>
  );
}
