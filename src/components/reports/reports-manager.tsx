"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronDown, Download } from "lucide-react";
import { emptyTotals, reportQuery, type Period, type ReportFilters, type ReportTotals, type SeriesPoint } from "@/components/reports/report-types";
import { Button } from "@/components/ui/button";
import { datePresets } from "@/lib/date-presets";
import { formatBdt, formatRate, formatUsd } from "@/lib/money";
import { METHOD_LABELS, PAYMENT_METHODS } from "@/lib/validations/payment";

type Tab = "overview" | "users" | "paid" | "unpaid";

type UserOption = { id: string; name: string };

type UserRow = {
  userId: string;
  name: string;
  paymentCount: number;
  totalUsd: number;
  totalBdt: number;
  paidBdt: number;
  unpaidBdt: number;
};

type PaymentRow = {
  id: string;
  userName: string;
  method: (typeof PAYMENT_METHODS)[number];
  amountUsd: number;
  rateBdt: number;
  amountBdt: number;
  paymentDate: string;
  status: "paid" | "unpaid";
};

type PaymentTotals = { totalUsd: string; totalBdt: string; count: number };

const periods: Array<{ id: Period; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "By User" },
  { id: "paid", label: "Paid" },
  { id: "unpaid", label: "Unpaid" },
];

const blankFilters = (): ReportFilters => ({ period: "monthly", from: "", to: "", userId: "" });

const readError = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || "Request failed";
};

export function ReportsManager() {
  const [tab, setTab] = useState<Tab>("overview");
  const [filters, setFilters] = useState<Record<Tab, ReportFilters>>({
    overview: blankFilters(),
    users: blankFilters(),
    paid: blankFilters(),
    unpaid: blankFilters(),
  });
  const [pages, setPages] = useState<Record<Tab, number>>({ overview: 1, users: 1, paid: 1, unpaid: 1 });
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [totals, setTotals] = useState<ReportTotals>(emptyTotals());
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentTotals, setPaymentTotals] = useState<PaymentTotals>({ totalUsd: "0.00", totalBdt: "0.00", count: 0 });
  const [paymentTotalPages, setPaymentTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const current = filters[tab];
  const page = pages[tab];

  useEffect(() => {
    void fetch("/api/admin/users?limit=50&status=all")
      .then((response) => response.json())
      .then((payload: { data?: { users?: UserOption[] } }) => setUsers(payload.data?.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const summaryResponse = await fetch(`/api/reports/summary?${reportQuery(current).toString()}`);
    if (!summaryResponse.ok) {
      toast.error(await readError(summaryResponse));
      setLoading(false);
      return;
    }
    const summary = (await summaryResponse.json()) as { data: { totals: ReportTotals; series: SeriesPoint[] } };
    setTotals(summary.data.totals);
    setSeries(summary.data.series);
    if (tab === "users") {
      const params = reportQuery(current, { page: String(page), limit: "8", sortBy: "bdt", sortDir: "desc" });
      const response = await fetch(`/api/reports/by-user?${params.toString()}`);
      if (!response.ok) {
        toast.error(await readError(response));
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as { data: { users: UserRow[]; totalPages: number } };
      setUserRows(payload.data.users);
      setUserTotalPages(payload.data.totalPages);
    }
    if (tab === "paid" || tab === "unpaid") {
      const params = new URLSearchParams({
        status: tab,
        userId: current.userId,
        page: String(page),
        limit: "8",
        sortBy: "paymentDate",
        sortDir: "desc",
      });
      if (current.from) params.set("dateFrom", new Date(`${current.from}T00:00:00+06:00`).toISOString());
      if (current.to) params.set("dateTo", new Date(`${current.to}T23:59:59.999+06:00`).toISOString());
      const response = await fetch(`/api/payments?${params.toString()}`);
      if (!response.ok) {
        toast.error(await readError(response));
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as {
        data: { payments: PaymentRow[]; totals: PaymentTotals; totalPages: number };
      };
      setPayments(payload.data.payments);
      setPaymentTotals(payload.data.totals);
      setPaymentTotalPages(payload.data.totalPages);
      setSelected([]);
    }
    setLoading(false);
  }, [current, page, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const updateFilter = (patch: Partial<ReportFilters>) => {
    setFilters((state) => ({ ...state, [tab]: { ...state[tab], ...patch } }));
    setPages((state) => ({ ...state, [tab]: 1 }));
  };

  const exportCsv = async () => {
    const type = tab === "overview" ? "summary" : tab === "users" ? "by-user" : "payments";
    const params = reportQuery(current, { type, format: "csv" });
    if (tab === "paid" || tab === "unpaid") params.set("status", tab);
    setExporting(true);
    const response = await fetch(`/api/reports/export?${params.toString()}`);
    setExporting(false);
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = tab === "users" ? userTotalPages : tab === "overview" ? 1 : paymentTotalPages;
  const settled = new Decimal(totals.totalBdt || 0).gt(0) ? new Decimal(totals.paidBdt || 0).div(totals.totalBdt).mul(100).toFixed(1) : "0.0";
  const queued = new Decimal(totals.totalBdt || 0).gt(0) ? new Decimal(totals.unpaidBdt || 0).div(totals.totalBdt).mul(100).toFixed(1) : "0.0";
  const averageTicket = totals.paymentCount ? formatUsd(new Decimal(totals.totalUsd || 0).div(totals.paymentCount).toFixed(2)) : "$0.00";
  const bars = series.slice(-6);
  const maxBar = Math.max(...bars.map((point) => Number(point.bdt) || 0), 1);
  const rangeLabel = current.from && current.to ? `${current.from} – ${current.to}` : "All dates";
  const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";

  const markPaid = async (ids: string[]) => {
    const response = await fetch(ids.length === 1 ? `/api/payments/${ids[0]}/mark-paid` : "/api/payments/bulk-mark-paid", {
      method: "POST",
      headers: ids.length === 1 ? undefined : { "content-type": "application/json" },
      body: ids.length === 1 ? undefined : JSON.stringify({ ids }),
    });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    toast.success(ids.length === 1 ? "Payment marked paid" : "Selected payments marked paid");
    await load();
  };

  const ratio = (paid: number | string, total: number | string) => {
    const whole = new Decimal(total || 0);
    if (whole.isZero()) return "0.0";
    return new Decimal(paid || 0).div(whole).mul(100).toFixed(1);
  };

  return (
    <div className="-mx-4 -my-6 min-h-full bg-[#faf8ff] px-4 py-6 text-[#131b2e] md:-mx-8 md:-my-8 md:px-8">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-[#464555] uppercase">Institutional clearing • Ledger</p>
            <h1 className="mt-1 text-[32px] font-bold tracking-tight">Financial Reports & Corridor Analytics</h1>
            <p className="mt-1 max-w-3xl text-[13px] text-[#464555]">Executive reconciliation, periodic settlement velocity, FX weighted average rate tracking, and counterparty clearance reporting for the US-BD corridor.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#4f46e5] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#3525cd] disabled:opacity-60" disabled={exporting} onClick={() => void exportCsv()}>
              <Download className="size-4" /> {exporting ? "Exporting..." : "Export CSV"}
            </button>
            <div className="relative">
              <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-[#eaedff] px-3 py-2 text-[13px] font-medium" onClick={() => setStatementOpen((open) => !open)}>
                Statement options <ChevronDown className="size-4" />
              </button>
              {statementOpen && (
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl bg-white p-1 text-[13px] shadow-xl">
                  <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#faf8ff]" onClick={() => { setStatementOpen(false); toast.message("Executive PDF is not on this ledger yet."); }}>Executive PDF statement</button>
                  <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#faf8ff]" onClick={() => { setStatementOpen(false); toast.message("MT940 export is not on this ledger yet."); }}>MT940 standard file</button>
                  <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#faf8ff]" onClick={() => { setStatementOpen(false); toast.message("BEFTN schema export is not on this ledger yet."); }}>BEFTN clearing schema</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-[#eaedff] p-1">
              {periods.map((item) => (
                <button key={item.id} type="button" className={`rounded px-3 py-1 text-[12px] font-semibold ${current.period === item.id ? "bg-white text-[#3525cd] shadow-sm" : "text-[#464555]"}`} onClick={() => updateFilter({ period: item.id })}>
                  {item.label}
                </button>
              ))}
            </div>
            {datePresets().map((preset) => (
              <button key={preset.id} type="button" className="rounded-full bg-[#eaedff] px-3 py-1 text-[12px] font-semibold text-[#464555]" onClick={() => updateFilter({ from: preset.from, to: preset.to })}>
                {preset.label}
              </button>
            ))}
            <span className="rounded-lg bg-[#eaedff] px-3 py-2 text-[13px] text-[#464555]">{rangeLabel}</span>
            <input aria-label="From" type="date" value={current.from} className="h-9 rounded-lg bg-[#eaedff] px-2 text-[13px]" onChange={(event) => updateFilter({ from: event.target.value })} />
            <input aria-label="To" type="date" value={current.to} className="h-9 rounded-lg bg-[#eaedff] px-2 text-[13px]" onChange={(event) => updateFilter({ to: event.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="User" value={current.userId} className="h-10 rounded-lg bg-[#eaedff] px-3 text-[13px]" onChange={(event) => updateFilter({ userId: event.target.value })}>
              <option value="">{`All counterparties (${users.length})`}</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <span className="rounded-full bg-[#e2e7ff] px-3 py-1 text-[12px] font-semibold text-[#3525cd]">US-BD corridor • Spot uses each payment rate</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[#eeeaf4]">
          {([
            ["overview", "Overview", String(totals.paymentCount)],
            ["users", "By user", String(users.length)],
            ["paid", "Paid settlements", String(totals.paidCount)],
            ["unpaid", "Unpaid pipeline", String(totals.unpaidCount)],
          ] as const).map(([id, label, count]) => (
            <button key={id} type="button" className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-[13px] font-semibold ${tab === id ? "bg-white text-[#3525cd] shadow-sm" : "text-[#464555]"}`} onClick={() => setTab(id)}>
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${tab === id ? "bg-[#4f46e5]/10 text-[#3525cd]" : "bg-[#eaedff] text-[#464555]"}`}>{count}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Total USD volume" value={loading ? "…" : formatUsd(totals.totalUsd)} hint={`Avg ${averageTicket} per payment`} pill={`${totals.paymentCount} transferred`} />
          <Metric label="Gross BDT volume" value={loading ? "…" : formatBdt(totals.totalBdt)} hint="Aggregate gross" pill="100% notional" />
          <Metric label="Settled / paid BDT" value={loading ? "…" : formatBdt(totals.paidBdt)} hint={`${totals.paidCount} batches`} pill={`${settled}% settled`} tone="paid" />
          <Metric label="Unpaid / in pipeline" value={loading ? "…" : formatBdt(totals.unpaidBdt)} hint={`${totals.unpaidCount} pending`} pill={`${queued}% in transit`} tone="unpaid" />
          <Metric label="Weighted avg FX rate" value={loading ? "…" : `৳${new Decimal(totals.averageRate || 0).toFixed(4)}`} hint="BDT / 1 USD realized" pill="Per payment rate" />
        </div>

        {tab === "overview" && (
          <>
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Settlement volume & realized FX rate</h2>
                  <p className="text-xs text-[#464555]">Paid and unpaid BDT for each {current.period} bucket. Weighted rate ৳{new Decimal(totals.averageRate || 0).toFixed(4)} / $1</p>
                </div>
                <div className="flex gap-4 text-[11px] font-semibold text-[#464555]">
                  <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#006e2d]" /> Paid BDT</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#ffb95f]" /> Unpaid BDT</span>
                </div>
              </div>
              <div className="mt-4 flex h-52 items-end gap-3">
                {bars.length === 0 && <p className="text-sm text-[#464555]">No payments in this range.</p>}
                {bars.map((point) => {
                  const paid = Number(point.paidBdt) || 0;
                  const unpaid = Number(point.unpaidBdt) || 0;
                  const height = ((paid + unpaid) / maxBar) * 100;
                  const paidShare = paid + unpaid === 0 ? 0 : (paid / (paid + unpaid)) * 100;
                  return (
                    <div key={point.label} className="flex h-full flex-1 flex-col items-center justify-end">
                      <span className="mb-1 text-[10px] text-[#464555]">৳{new Decimal(point.averageRate || 0).toFixed(2)}</span>
                      <span className="flex w-8 flex-col justify-end overflow-hidden rounded-t-md sm:w-10" style={{ height: `${Math.max(height, paid + unpaid > 0 ? 8 : 0)}%` }}>
                        <span className="bg-[#ffb95f]" style={{ height: `${100 - paidShare}%` }} />
                        <span className="bg-[#006e2d]" style={{ height: `${paidShare}%` }} />
                      </span>
                      <span className="mt-2 truncate text-[11px] text-[#464555]">{point.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>
            <ReportTable title="Corridor settlement summary" hint="Each row is one period from the selected range.">
              <thead className="text-[11px] tracking-wide text-[#464555] uppercase">
                <tr className="border-b border-[#eeeaf4]">
                  {["Period", "Txn count", "USD volume", "Weighted FX", "Paid BDT", "Unpaid BDT", "Total BDT", "Settlement %"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {series.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-[#464555]">No payments in this range.</td></tr>}
                {series.map((row) => (
                  <tr key={row.label} className="border-b border-[#f3f0f6]">
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    <td className="px-4 py-3">{row.count}</td>
                    <td className="px-4 py-3 tabular-nums">{formatUsd(row.usd)}</td>
                    <td className="px-4 py-3 tabular-nums">৳{new Decimal(row.averageRate || 0).toFixed(4)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBdt(row.paidBdt)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBdt(row.unpaidBdt)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBdt(row.bdt)}</td>
                    <td className="px-4 py-3 font-semibold text-[#006e2d]">{ratio(row.paidBdt, row.bdt)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#faf8ff] font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3">{totals.paymentCount}</td>
                  <td className="px-4 py-3 tabular-nums">{formatUsd(totals.totalUsd)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatRate(totals.averageRate)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatBdt(totals.paidBdt)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatBdt(totals.unpaidBdt)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatBdt(totals.totalBdt)}</td>
                  <td className="px-4 py-3 text-[#006e2d]">{settled}%</td>
                </tr>
              </tfoot>
            </ReportTable>
          </>
        )}

        {tab === "users" && (
          <ReportTable title="Counterparty clearing breakdown" hint="Sorted by gross BDT. View detail opens the user ledger.">
            <thead className="text-[11px] tracking-wide text-[#464555] uppercase">
              <tr className="border-b border-[#eeeaf4]">
                {["Counterparty", "Txn count", "Total USD", "Total BDT", "Paid BDT", "Unpaid BDT", "Settlement", "Action"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {userRows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-[#464555]">No users have payments in this range.</td></tr>}
              {userRows.map((row) => (
                <tr key={row.userId} className="border-b border-[#f3f0f6]">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-[#e2e7ff] text-[12px] font-bold text-[#3525cd]">{initials(row.name)}</span>
                      <span className="font-medium">{row.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.paymentCount}</td>
                  <td className="px-4 py-3 tabular-nums">{formatUsd(row.totalUsd)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatBdt(row.totalBdt)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatBdt(row.paidBdt)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatBdt(row.unpaidBdt)}</td>
                  <td className="px-4 py-3 font-semibold text-[#006e2d]">{ratio(row.paidBdt, row.totalBdt)}% paid</td>
                  <td className="px-4 py-3"><Link href={`/admin/users/${row.userId}`} className="font-semibold text-[#3525cd]">View detail</Link></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#faf8ff] font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3">{totals.paymentCount}</td>
                <td className="px-4 py-3 tabular-nums">{formatUsd(totals.totalUsd)}</td>
                <td className="px-4 py-3 tabular-nums">{formatBdt(totals.totalBdt)}</td>
                <td className="px-4 py-3 tabular-nums">{formatBdt(totals.paidBdt)}</td>
                <td className="px-4 py-3 tabular-nums">{formatBdt(totals.unpaidBdt)}</td>
                <td className="px-4 py-3 text-[#006e2d]">{settled}%</td>
                <td />
              </tr>
            </tfoot>
          </ReportTable>
        )}

        {(tab === "paid" || tab === "unpaid") && (
          <ReportTable
            title={tab === "paid" ? "Cleared & disbursed settlements" : "Unpaid & pending clearance"}
            hint={tab === "paid" ? "Payments marked paid in this range." : "Payments still waiting to be marked paid."}
            action={tab === "unpaid" && selected.length > 0 ? <button type="button" className="rounded-lg bg-[#006e2d] px-3 py-1.5 text-[12px] font-semibold text-white" onClick={() => void markPaid(selected)}>Mark selected as paid</button> : null}
          >
            <thead className="text-[11px] tracking-wide text-[#464555] uppercase">
              <tr className="border-b border-[#eeeaf4]">
                {tab === "unpaid" && <th className="px-4 py-3"><input type="checkbox" aria-label="Select unpaid payments" checked={payments.length > 0 && payments.every((payment) => selected.includes(payment.id))} onChange={(event) => setSelected(event.target.checked ? payments.map((payment) => payment.id) : [])} /></th>}
                {["Date", "Reference", "Counterparty", "Channel", "USD", "Rate", "BDT", "Status"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}
                {tab === "unpaid" && <th className="px-4 py-3 text-right font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={tab === "unpaid" ? 10 : 8} className="px-4 py-8 text-[#464555]">No {tab} payments in this range.</td></tr>}
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-[#f3f0f6]">
                  {tab === "unpaid" && (
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Select ${payment.userName}`} checked={selected.includes(payment.id)} onChange={(event) => setSelected((currentIds) => event.target.checked ? [...currentIds, payment.id] : currentIds.filter((id) => id !== payment.id))} />
                    </td>
                  )}
                  <td className="px-4 py-3">{new Date(payment.paymentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-4 py-3 font-medium">TXN-{payment.id.slice(-6).toUpperCase()}</td>
                  <td className="px-4 py-3">{payment.userName}</td>
                  <td className="px-4 py-3 text-[#464555]">{METHOD_LABELS[payment.method]}</td>
                  <td className="px-4 py-3 tabular-nums">{formatUsd(payment.amountUsd)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatRate(payment.rateBdt)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatBdt(payment.amountBdt)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${payment.status === "paid" ? "bg-[#7cf994]/40 text-[#006e2d]" : "bg-[#ffddb8] text-[#684000]"}`}>{payment.status}</span></td>
                  {tab === "unpaid" && <td className="px-4 py-3 text-right"><button type="button" className="rounded bg-[#006e2d] px-2 py-1 text-[12px] font-semibold text-white" onClick={() => void markPaid([payment.id])}>Mark paid</button></td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#faf8ff] font-semibold">
                <td className="px-4 py-3" colSpan={tab === "unpaid" ? 5 : 4}>Total {paymentTotals.count} payments</td>
                <td className="px-4 py-3 tabular-nums">{formatUsd(paymentTotals.totalUsd)}</td>
                <td />
                <td className="px-4 py-3 tabular-nums">{formatBdt(paymentTotals.totalBdt)}</td>
                <td colSpan={tab === "unpaid" ? 2 : 1} />
              </tr>
            </tfoot>
          </ReportTable>
        )}

        {tab !== "overview" && (
          <div className="flex items-center justify-end gap-2 text-[13px] text-[#464555]">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPages((state) => ({ ...state, [tab]: page - 1 }))}>Prev</Button>
            <span>Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPages((state) => ({ ...state, [tab]: page + 1 }))}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, hint, pill, tone = "plain" }: { label: string; value: string; hint: string; pill: string; tone?: "plain" | "paid" | "unpaid" }) {
  const valueClass = tone === "paid" ? "text-[#006e2d]" : tone === "unpaid" ? "text-[#684000]" : "text-[#131b2e]";
  return (
    <article className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-wide text-[#464555] uppercase">{label}</p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-1 text-[12px] text-[#464555]">{hint}</p>
      <p className="text-[12px] font-semibold text-[#3525cd]">{pill}</p>
    </article>
  );
}

function ReportTable({ title, hint, action, children }: { title: string; hint: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-xs text-[#464555]">{hint}</p>
        </div>
        {action}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-[13px]">{children}</table>
      </div>
    </section>
  );
}
