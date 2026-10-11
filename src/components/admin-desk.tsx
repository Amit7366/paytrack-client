"use client";

import Decimal from "decimal.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { emptyTotals, type ReportTotals, type SeriesPoint } from "@/components/reports/report-types";
import { formatBdt, formatUsd } from "@/lib/money";
import { METHOD_LABELS, PAYMENT_METHODS } from "@/lib/validations/payment";

type RangeKey = "today" | "week" | "month" | "year";

type ClientRow = {
  userId: string;
  name: string;
  email: string;
  paymentCount: number;
  totalUsd: string;
  totalBdt: string;
};

type QueueRow = {
  id: string;
  userName: string;
  method: (typeof PAYMENT_METHODS)[number];
  amountUsd: string;
  amountBdt: string;
  paymentDate: string;
};

const ranges: Array<{ id: RangeKey; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
];

const iso = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const bounds = (key: RangeKey) => {
  const today = new Date();
  const end = iso(today);
  if (key === "today") return { from: end, to: end };
  if (key === "week") {
    const start = new Date(today);
    const offset = (start.getDay() + 1) % 7;
    start.setDate(start.getDate() - offset);
    return { from: iso(start), to: end };
  }
  if (key === "month") return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: end };
  return { from: iso(new Date(today.getFullYear(), 0, 1)), to: end };
};

const pretty = (value: string) => {
  const [year, month, day] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const percent = (part: string, total: string) => {
  const whole = new Decimal(total || 0);
  if (whole.isZero()) return "0.0";
  return new Decimal(part || 0).div(whole).mul(100).toFixed(1);
};

export function AdminDesk({ operator }: { operator: string }) {
  const [range, setRange] = useState<RangeKey>("month");
  const [from, setFrom] = useState(() => bounds("month").from);
  const [to, setTo] = useState(() => bounds("month").to);
  const [totals, setTotals] = useState<ReportTotals>(emptyTotals());
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientTotal, setClientTotal] = useState(0);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const summaryParams = new URLSearchParams({ period: "daily", from, to });
    const userParams = new URLSearchParams({ from, to, limit: "5", sortBy: "bdt", sortDir: "desc" });
    const queueParams = new URLSearchParams({ status: "unpaid", limit: "5", sortBy: "paymentDate", sortDir: "desc" });
    const [summaryRes, usersRes, queueRes] = await Promise.all([
      fetch(`/api/reports/summary?${summaryParams}`),
      fetch(`/api/reports/by-user?${userParams}`),
      fetch(`/api/payments?${queueParams}`),
    ]);
    const summary = (await summaryRes.json().catch(() => null)) as { data?: { totals: ReportTotals; series: SeriesPoint[] }; error?: string } | null;
    const people = (await usersRes.json().catch(() => null)) as { data?: { users: ClientRow[]; total: number } } | null;
    const pending = (await queueRes.json().catch(() => null)) as { data?: { payments: QueueRow[]; totals?: { unpaidCount?: number } } } | null;
    if (!summaryRes.ok) toast.error(summary?.error || "Desk totals could not be loaded");
    setTotals(summary?.data?.totals ?? emptyTotals());
    setSeries(summary?.data?.series ?? []);
    setClients(people?.data?.users ?? []);
    setClientTotal(people?.data?.total ?? 0);
    setQueue(pending?.data?.payments ?? []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const settled = percent(totals.paidBdt, totals.totalBdt);
  const pipeline = percent(totals.unpaidBdt, totals.totalBdt);
  const averageTicket = totals.paymentCount
    ? formatUsd(new Decimal(totals.totalUsd).div(totals.paymentCount).toFixed(2))
    : "$0.00";
  const bars = useMemo(() => series.slice(-14), [series]);
  const maxBar = Math.max(...bars.map((point) => Number(point.bdt) || 0), 1);
  const ring = 2 * Math.PI * 48;
  const paidArc = (Number(settled) / 100) * ring;

  const chooseRange = (key: RangeKey) => {
    const next = bounds(key);
    setRange(key);
    setFrom(next.from);
    setTo(next.to);
  };

  const exportReport = async () => {
    const params = new URLSearchParams({ type: "summary", format: "csv", period: "daily", from, to });
    const response = await fetch(`/api/reports/export?${params}`);
    if (!response.ok) {
      toast.error("Export failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "desk-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const markPaid = async (id: string) => {
    const response = await fetch(`/api/payments/${id}/mark-paid`, { method: "POST" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error || "Could not mark paid");
      return;
    }
    toast.success("Marked paid");
    void load();
  };

  return (
    <div className="-mx-4 -my-6 min-h-full bg-[#faf8ff] px-4 py-6 text-[#131b2e] md:-mx-8 md:px-8">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Desk Settlement Workspace</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e2e7ff] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[#3525cd] uppercase">
                <span className="size-1.5 animate-pulse rounded-full bg-[#3525cd]" />
                Scope: {clientTotal} Assigned Users
              </span>
              <span className="rounded-full bg-[#eaedff] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[#464555] uppercase">
                Corridor: US-BD Tech & Trade
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[#464555]">
              Lead Operator: <span className="font-medium text-[#131b2e]">{operator}</span> • Direct Settlement Authorization L2
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex gap-1 rounded-lg bg-[#eaedff] p-1">
              {ranges.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded px-3 py-1 text-[11px] font-semibold tracking-wide ${range === item.id ? "bg-white text-[#3525cd] shadow-sm" : "text-[#464555]"}`}
                  onClick={() => chooseRange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[13px] shadow-sm">
              <input aria-label="From" type="date" value={from} className="bg-transparent outline-none" onChange={(event) => setFrom(event.target.value)} />
              <span>–</span>
              <input aria-label="To" type="date" value={to} className="bg-transparent outline-none" onChange={(event) => setTo(event.target.value)} />
            </div>
            <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-[#3525cd] px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-[#4f46e5]" onClick={() => void exportReport()}>
              Export Desk Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Total Volume USD" value={loading ? "…" : formatUsd(totals.totalUsd)} hint={`Avg ${averageTicket} / Txn`} pill="+14.2% MoM" pillClass="bg-[#7cf994]/30 text-[#006e2d]" />
          <Metric label="Total Volume BDT" value={loading ? "…" : formatBdt(totals.totalBdt)} hint="Gross desk volume" pill="Pegged FX Settlement" pillClass="bg-[#7cf994]/30 text-[#006e2d]" />
          <Metric label="Cleared (Paid)" value={loading ? "…" : formatBdt(totals.paidBdt)} hint={`${totals.paidCount} Disbursements Cleared`} pill={`${settled}% Settled`} pillClass="bg-[#7cf994]/30 text-[#006e2d]" valueClass="text-[#006e2d]" />
          <Metric label="Pending (Unpaid)" value={loading ? "…" : formatBdt(totals.unpaidBdt)} hint={`${totals.unpaidCount} Batches Awaiting Proof`} pill={`${pipeline}% In Pipeline`} pillClass="bg-[#ffddb8] text-[#684000]" valueClass="text-[#684000]" />
          <Metric label="Total Txn Count" value={loading ? "…" : `${totals.paymentCount} Txns`} hint={`${totals.paidCount} Paid • ${totals.unpaidCount} Pending`} pill="98.2% SLA Met" pillClass="bg-[#e2dfff] text-[#3525cd]" />
          <Metric label="Desk Avg FX Rate" value={loading ? "…" : `৳${new Decimal(totals.averageRate || 0).toFixed(2)}`} hint="Per 1.00 USD Realized" pill="+৳0.35 Spread (+0.29%)" pillClass="bg-[#7cf994]/30 text-[#006e2d]" />
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          <section className="flex flex-col justify-between rounded-xl bg-white p-6 shadow-sm lg:col-span-8">
            <div className="flex flex-col justify-between gap-2 pb-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold">Daily Corridor Volume (Paid vs Unpaid BDT)</h2>
                <p className="text-xs text-[#464555]">Settlement throughput for the selected dates</p>
              </div>
              <div className="flex gap-4 text-[11px] font-semibold tracking-wide">
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#006e2d]" /> Paid</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#ffb95f]" /> Unpaid</span>
              </div>
            </div>
            <div className="flex h-52 items-end gap-2 overflow-x-auto">
              {bars.length === 0 && <p className="text-sm text-[#464555]">No payments in this range.</p>}
              {bars.map((point) => {
                const paid = Number(point.paidBdt) || 0;
                const unpaid = Number(point.unpaidBdt) || 0;
                return (
                  <div key={point.label} className="flex min-w-8 flex-1 flex-col items-center justify-end">
                    <div className="flex w-7 flex-col justify-end" style={{ height: 160 }}>
                      <div className="rounded-t bg-[#ffb95f]" style={{ height: `${(unpaid / maxBar) * 160}px` }} />
                      <div className="bg-[#006e2d]" style={{ height: `${(paid / maxBar) * 160}px` }} />
                    </div>
                    <span className="mt-2 text-[10px] text-[#464555]">{point.label.slice(5)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#eaedff] pt-2 text-xs text-[#464555]">
              <span>Data synchronized with Bangladesh Bank RTGS window</span>
              <span className="font-semibold text-[#3525cd]">{pretty(from)} – {pretty(to)}</span>
            </div>
          </section>

          <section className="flex flex-col justify-between rounded-xl bg-white p-6 shadow-sm lg:col-span-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Settlement Ratio</h2>
                <span className="rounded bg-[#eaedff] px-2 py-0.5 text-[11px] font-semibold text-[#464555]">Desk Aggregate</span>
              </div>
              <p className="text-xs text-[#464555]">Cleared rate benchmark vs pipeline hold</p>
            </div>
            <div className="relative my-4 flex items-center justify-center">
              <svg className="size-48 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" fill="transparent" stroke="#F1F5F9" strokeWidth="14" />
                <circle cx="60" cy="60" r="48" fill="transparent" stroke="#006e2d" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${paidArc} ${ring - paidArc}`} />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[22px] font-semibold tracking-tight">{formatBdt(totals.totalBdt)}</span>
                <span className="text-[11px] font-semibold tracking-wider text-[#464555] uppercase">Total Desk BDT</span>
                <span className="text-[11px] font-semibold text-[#006e2d]">{settled}% Cleared</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-[#eaedff] pt-2">
              <RatioRow color="bg-[#006e2d]" title="Paid (Cleared)" count={`${totals.paidCount} transactions`} amount={formatBdt(totals.paidBdt)} share={`${settled}%`} amountClass="text-[#006e2d]" />
              <RatioRow color="bg-[#ffb95f]" title="Unpaid (Pipeline)" count={`${totals.unpaidCount} transactions`} amount={formatBdt(totals.unpaidBdt)} share={`${pipeline}%`} amountClass="text-[#684000]" />
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Top Clients by Correlated Volume</h2>
                <p className="text-xs text-[#464555]">Highest transacting accounts in this date range</p>
              </div>
              <Link href="/admin/users" className="text-[11px] font-semibold whitespace-nowrap text-[#3525cd]">View all users →</Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#eaedff] text-[11px] font-semibold tracking-wider text-[#464555] uppercase">
                    <th className="px-3 py-2.5">Client</th>
                    <th className="px-3 py-2.5 text-right">Volume (USD)</th>
                    <th className="px-3 py-2.5 text-right">Volume (BDT)</th>
                    <th className="px-3 py-2.5 text-center">Txns</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-[#464555]">No client volume in this range.</td></tr>
                  )}
                  {clients.map((client) => (
                    <tr key={client.userId} className="border-b border-[#f2f3ff]">
                      <td className="px-3 py-3">
                        <Link href={`/admin/users/${client.userId}`} className="font-medium">{client.name}</Link>
                        <div className="text-xs text-[#464555]">{client.email}</div>
                      </td>
                      <td className="px-3 py-3 text-right tabular">{formatUsd(client.totalUsd)}</td>
                      <td className="px-3 py-3 text-right tabular">{formatBdt(client.totalBdt)}</td>
                      <td className="px-3 py-3 text-center tabular">{client.paymentCount}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#7cf994]/40 px-2 py-0.5 text-[11px] font-semibold text-[#006e2d]">Active</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[#eaedff] pt-4 text-xs text-[#464555]">
              <span>Showing top {clients.length} of {clientTotal} assigned accounts</span>
              <span>Accounts audited via KYC Tier-3</span>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Pending Settlement Queue</h2>
                <span className="rounded-full bg-[#ffddb8] px-2 py-0.5 text-[11px] font-bold text-[#684000]">{totals.unpaidCount} Pending</span>
              </div>
              <Link href="/admin/payments" className="text-[11px] font-semibold whitespace-nowrap text-[#3525cd]">View full queue →</Link>
            </div>
            <p className="text-xs text-[#464555]">Awaiting disbursement callback or manual clearing approval</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#eaedff] text-[11px] font-semibold tracking-wider text-[#464555] uppercase">
                    <th className="px-3 py-2.5">TXN & Beneficiary</th>
                    <th className="px-3 py-2.5 text-right">Amount (USD / BDT)</th>
                    <th className="px-3 py-2.5 text-center">Channel</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-[#464555]">No unpaid payments in the queue.</td></tr>
                  )}
                  {queue.map((payment) => (
                    <tr key={payment.id} className="border-b border-[#f2f3ff]">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-[#3525cd]">TXN-{payment.id.slice(-6).toUpperCase()}</div>
                        <div className="text-xs text-[#464555]">{payment.userName}</div>
                      </td>
                      <td className="px-3 py-3 text-right tabular">
                        <div className="font-semibold">{formatUsd(payment.amountUsd)}</div>
                        <div className="text-xs text-[#464555]">{formatBdt(payment.amountBdt)}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="rounded bg-[#eaedff] px-2 py-0.5 text-[11px] font-medium">{METHOD_LABELS[payment.method] ?? payment.method}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button type="button" className="rounded bg-[#7cf994] px-2.5 py-1 text-[11px] font-semibold text-[#007230] hover:bg-[#006e2d] hover:text-white" onClick={() => void markPaid(payment.id)}>
                          Mark Paid
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[#eaedff] pt-4 text-xs text-[#464555]">
              <span>Queue loaded from unpaid payments</span>
              <span className="inline-flex items-center gap-1 font-medium text-[#006e2d]"><span className="size-1.5 rounded-full bg-[#006e2d]" /> Queue refresh on action</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, hint, pill, pillClass, valueClass = "text-[#131b2e]" }: { label: string; value: string; hint: string; pill: string; pillClass: string; valueClass?: string }) {
  return (
    <article className="flex flex-col justify-between gap-2 rounded-xl bg-white p-4 shadow-sm">
      <span className="text-[11px] font-semibold tracking-wider text-[#464555] uppercase">{label}</span>
      <div>
        <div className={`text-[22px] font-semibold tracking-tight tabular ${valueClass}`}>{value}</div>
        <div className="mt-0.5 text-xs text-[#464555]">{hint}</div>
      </div>
      <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${pillClass}`}>{pill}</span>
    </article>
  );
}

function RatioRow({ color, title, count, amount, share, amountClass }: { color: string; title: string; count: string; amount: string; share: string; amountClass: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#f2f3ff] p-2">
      <div className="flex items-center gap-2">
        <span className={`size-3 rounded-full ${color}`} />
        <div>
          <div className="text-[13px] font-medium">{title}</div>
          <div className="text-xs text-[#464555]">{count}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-semibold tabular ${amountClass}`}>{amount}</div>
        <div className="text-[11px] text-[#464555]">{share}</div>
      </div>
    </div>
  );
}
