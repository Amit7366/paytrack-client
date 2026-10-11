"use client";

import Decimal from "decimal.js";
import { Download, MoreHorizontal, Plus, Receipt, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PaymentEntryDialog, type PaymentEntryValues } from "@/components/payment-entry-dialog";
import { Button } from "@/components/ui/button";
import { formatBdt, formatUsd } from "@/lib/money";
import { METHOD_LABELS, PAYMENT_METHODS, paymentFieldsSchema } from "@/lib/validations/payment";

type PaymentRow = {
  id: string;
  userId: string;
  userName: string;
  method: (typeof PAYMENT_METHODS)[number];
  amountUsd: number;
  rateBdt: number;
  amountBdt: number;
  paymentDate: string;
  note: string;
  status: "paid" | "unpaid";
  paidAt: string | null;
  paidByName: string | null;
};

type Totals = {
  totalUsd: number;
  totalBdt: number;
  paidUsd: number;
  paidBdt: number;
  unpaidUsd: number;
  unpaidBdt: number;
};

type ListData = {
  payments: PaymentRow[];
  page: number;
  total: number;
  totalPages: number;
  totals: Totals;
};

type UserOption = { id: string; name: string; email: string };

const usd = formatUsd;
const bdt = formatBdt;
const when = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");
const dayValue = (value?: string) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const ranges = {
  "7d": () => {
    const to = endOfDay(new Date());
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - 6);
    return { from, to };
  },
  "30d": () => {
    const to = endOfDay(new Date());
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - 29);
    return { from, to };
  },
  today: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
  week: () => {
    const now = new Date();
    const start = startOfDay(now);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    return { from: start, to: endOfDay(now) };
  },
  month: () => {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  },
  year: () => {
    const now = new Date();
    return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
  },
};

const readError = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || "Request failed";
};

export function PaymentsManager() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "unpaid">("all");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("paymentDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [rangeKey, setRangeKey] = useState<"all" | "today" | "week" | "month" | "year" | "custom">("all");
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"create" | PaymentRow | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    void fetch("/api/admin/users?limit=50&status=all")
      .then((response) => response.json())
      .then((payload: { data?: { users?: UserOption[] } }) => setUsers(payload.data?.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      userId,
      status,
      search: submittedSearch,
      page: String(page),
      limit: String(limit),
      sortBy,
      sortDir,
    });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const response = await fetch(`/api/payments?${params.toString()}`);
    if (!response.ok) {
      toast.error(await readError(response));
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as { data: ListData };
    setData(payload.data);
    setSelected([]);
    setLoading(false);
  }, [dateFrom, dateTo, limit, page, sortBy, sortDir, status, submittedSearch, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setFormError("");
    setDialog("create");
  };

  const openEdit = (payment: PaymentRow) => {
    setFormError("");
    setDialog(payment);
  };

  const closeDialog = () => {
    setDialog(null);
    setFormError("");
  };

  const submitPayment = async (values: PaymentEntryValues) => {
    const editing = dialog !== "create" && dialog !== null ? dialog : null;
    const parsed = paymentFieldsSchema.safeParse(values);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setPending(true);
    const response = await fetch(editing ? `/api/payments/${editing.id}` : "/api/payments", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setPending(false);
    if (!response.ok) {
      const message = await readError(response);
      setFormError(message);
      toast.error(message);
      return;
    }
    toast.success(editing ? "Payment updated" : "Payment added");
    closeDialog();
    await load();
  };

  const mark = async (id: string, paid: boolean) => {
    const response = await fetch(`/api/payments/${id}/${paid ? "mark-paid" : "mark-unpaid"}`, { method: "POST" });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    toast.success(paid ? "Payment marked paid" : "Payment marked unpaid");
    await load();
  };

  const remove = async (payment: PaymentRow) => {
    if (!window.confirm(`Delete the ${usd(payment.amountUsd)} payment for ${payment.userName}?`)) return;
    const response = await fetch(`/api/payments/${payment.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    toast.success("Payment deleted");
    await load();
  };

  const bulkPaid = async () => {
    const response = await fetch("/api/payments/bulk-mark-paid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: selected }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string; data?: { updated?: number } } | null;
    if (!response.ok) {
      toast.error(payload?.error || "Unable to mark payments paid");
      return;
    }
    toast.success(`Marked ${payload?.data?.updated ?? 0} payment${payload?.data?.updated === 1 ? "" : "s"} as paid`);
    await load();
  };

  const applyRange = (key: keyof typeof ranges) => {
    const range = ranges[key]();
    setRangeKey(key === "7d" || key === "30d" ? "custom" : key);
    setDateFrom(range.from.toISOString());
    setDateTo(range.to.toISOString());
    setPage(1);
  };

  const clearRange = () => {
    setRangeKey("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const exportCsv = async () => {
    const params = new URLSearchParams({ type: "payments", format: "csv", status, userId });
    if (dateFrom) params.set("from", dateFrom.slice(0, 10));
    if (dateTo) params.set("to", dateTo.slice(0, 10));
    const response = await fetch(`/api/reports/export?${params.toString()}`);
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "payments-ledger.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const bulkUnpaid = async () => {
    const results = await Promise.all(selected.map((id) => fetch(`/api/payments/${id}/mark-unpaid`, { method: "POST" })));
    const failed = results.filter((response) => !response.ok).length;
    if (failed) toast.error(`${failed} payment${failed === 1 ? "" : "s"} could not be marked unpaid`);
    else toast.success(`Marked ${selected.length} payment${selected.length === 1 ? "" : "s"} as unpaid`);
    await load();
  };

  const pageIds = data?.payments.map((payment) => payment.id) ?? [];
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const editing = dialog && dialog !== "create" ? dialog : null;
  const footer = data?.totals;
  const selectedRows = data?.payments.filter((payment) => selected.includes(payment.id)) ?? [];
  const selectedUsd = selectedRows.reduce((sum, payment) => sum.plus(payment.amountUsd || 0), new Decimal(0));
  const selectedBdt = selectedRows.reduce((sum, payment) => sum.plus(payment.amountBdt || 0), new Decimal(0));
  const paidShare = footer && new Decimal(footer.totalBdt || 0).gt(0) ? new Decimal(footer.paidBdt || 0).div(footer.totalBdt).mul(100).toFixed(1) : "0.0";
  const unpaidShare = footer && new Decimal(footer.totalBdt || 0).gt(0) ? new Decimal(footer.unpaidBdt || 0).div(footer.totalBdt).mul(100).toFixed(1) : "0.0";
  const startRow = data && data.total > 0 ? (page - 1) * limit + 1 : 0;
  const endRow = data ? Math.min(page * limit, data.total) : 0;
  const rangeLabel = dateFrom && dateTo ? `${new Date(dateFrom).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${new Date(dateTo).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "All dates";
  const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";

  const sortHeader = (key: string) => {
    if (!["paymentDate", "amountUsd", "amountBdt", "status"].includes(key)) return;
    setSortDir(sortBy === key && sortDir === "desc" ? "asc" : "desc");
    setSortBy(key);
    setPage(1);
  };

  return (
    <div className="-mx-4 -my-6 min-h-full bg-[#faf8ff] px-4 py-6 text-[#131b2e] md:-mx-8 md:-my-8 md:px-8">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-[#464555] uppercase">
              Treasury & settlements <span className="text-[#006e2d]">• Real-time core ledger</span>
            </p>
            <h1 className="mt-1 text-[32px] font-bold tracking-tight">Payments Ledger</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-[#464555]">Institutional settlement records, cross-border clearance, and multi-currency payout reconciliation.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#eaedff] px-3 py-2 text-[13px] font-medium hover:bg-[#e2e7ff]" onClick={() => void exportCsv()}>
              <Download className="size-4" /> Export CSV
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#4f46e5] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#3525cd]" onClick={openCreate}>
              <Plus className="size-4" /> Add Payment
            </button>
          </div>
        </div>

        <form
          className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSubmittedSearch(search.trim());
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#464555]" />
              <input aria-label="Search payments" value={search} placeholder="Search note or user" className="h-10 w-full rounded-lg bg-[#eaedff] pr-3 pl-9 text-[13px] outline-none" onChange={(event) => setSearch(event.target.value)} />
            </label>
            <select aria-label="User" value={userId} className="h-10 rounded-lg bg-[#eaedff] px-3 text-[13px]" onChange={(event) => { setUserId(event.target.value); setPage(1); }}>
              <option value="">All users</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select aria-label="Status" value={status} className="h-10 rounded-lg bg-[#eaedff] px-3 text-[13px]" onChange={(event) => { setStatus(event.target.value as "all" | "paid" | "unpaid"); setPage(1); }}>
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <span className="rounded-lg bg-[#eaedff] px-3 py-2 text-[13px] text-[#464555]">{rangeLabel}</span>
            <button type="submit" className="rounded-lg bg-[#3525cd] px-3 py-2 text-[13px] font-medium text-white">Search</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["all", "All time"],
              ["today", "Today"],
              ["week", "This week"],
              ["month", "This month"],
              ["year", "This year"],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" className={`rounded-full px-3 py-1 text-[12px] font-semibold ${rangeKey === key ? "bg-[#3525cd] text-white" : "bg-[#eaedff] text-[#464555]"}`} onClick={() => (key === "all" ? clearRange() : applyRange(key))}>
                {label}
              </button>
            ))}
            <input aria-label="From" type="date" value={dateFrom ? dayValue(dateFrom) : ""} className="h-9 rounded-lg bg-[#eaedff] px-2 text-[13px]" onChange={(event) => { setRangeKey("custom"); setDateFrom(event.target.value ? startOfDay(new Date(`${event.target.value}T12:00:00`)).toISOString() : ""); setPage(1); }} />
            <input aria-label="To" type="date" value={dateTo ? dayValue(dateTo) : ""} className="h-9 rounded-lg bg-[#eaedff] px-2 text-[13px]" onChange={(event) => { setRangeKey("custom"); setDateTo(event.target.value ? endOfDay(new Date(`${event.target.value}T12:00:00`)).toISOString() : ""); setPage(1); }} />
          </div>
        </form>

        <section className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-[13px]">
              <thead className="text-[11px] tracking-wide text-[#464555] uppercase">
                <tr className="border-b border-[#eeeaf4]">
                  <th className="px-4 py-3">
                    <input type="checkbox" aria-label="Select all payments on this page" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? pageIds : [])} />
                  </th>
                  {([
                    ["userName", "Counterparty"],
                    ["paymentDate", "Txn & date"],
                    ["amountUsd", "USD amount"],
                    ["rate", "FX rate"],
                    ["amountBdt", "BDT settlement"],
                    ["status", "Status"],
                  ] as const).map(([key, label]) => (
                    <th key={key} className="px-4 py-3 font-semibold">
                      <button type="button" className="font-semibold" onClick={() => { if (key === "paymentDate" || key === "amountUsd" || key === "amountBdt" || key === "status") sortHeader(key); }}>{label}{sortBy === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</button>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Paid by</th>
                  <th className="px-4 py-3 font-semibold">Paid at</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={10} className="px-4 py-8 text-[#464555]">Loading payments...</td></tr>}
                {!loading && data?.payments.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-[#464555]">No payments match these filters.</td></tr>}
                {!loading && data?.payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-[#f3f0f6]">
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Select payment for ${payment.userName}`} checked={selected.includes(payment.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, payment.id] : current.filter((id) => id !== payment.id))} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-[#e2e7ff] text-[12px] font-bold text-[#3525cd]">{initials(payment.userName)}</span>
                        <span>
                          <span className="block font-medium">{payment.userName}</span>
                          <span className="text-[11px] text-[#464555]">US-BD • {METHOD_LABELS[payment.method]}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">TXN-{payment.id.slice(-6).toUpperCase()}</span>
                      <span className="text-[11px] text-[#464555]">{new Date(payment.paymentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{usd(payment.amountUsd)}</td>
                    <td className="px-4 py-3 tabular-nums">৳{new Decimal(payment.rateBdt || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 tabular-nums">{bdt(payment.amountBdt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${payment.status === "paid" ? "bg-[#7cf994]/40 text-[#006e2d]" : "bg-[#ffddb8] text-[#684000]"}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{payment.paidByName ?? "—"}</td>
                    <td className="px-4 py-3 text-[#464555]">{payment.paidAt ? when(payment.paidAt) : "Awaiting dispatch"}</td>
                    <td className="relative px-4 py-3 text-right">
                      <button type="button" aria-label="Payment note" className="rounded p-1 text-[#464555] hover:bg-[#eaedff]" onClick={() => toast.message(payment.note || "No settlement note")}>
                        <Receipt className="size-4" />
                      </button>
                      <button type="button" aria-label="Row actions" className="rounded p-1 text-[#464555] hover:bg-[#eaedff]" onClick={() => setRowMenu(rowMenu === payment.id ? null : payment.id)}>
                        <MoreHorizontal className="size-4" />
                      </button>
                      {rowMenu === payment.id && (
                        <div className="absolute right-4 z-20 mt-1 w-40 rounded-xl bg-white p-1 text-left text-[13px] shadow-xl">
                          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#faf8ff]" onClick={() => { setRowMenu(null); openEdit(payment); }}>Edit entry</button>
                          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#faf8ff]" onClick={() => { setRowMenu(null); void mark(payment.id, payment.status !== "paid"); }}>{payment.status === "paid" ? "Mark unpaid" : "Mark paid"}</button>
                          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-[#684000] hover:bg-[#fff4e8]" onClick={() => { setRowMenu(null); void remove(payment); }}>Delete record</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 border-t border-[#eeeaf4] bg-[#faf8ff] px-4 py-4 text-[12px] sm:grid-cols-2 xl:grid-cols-5">
            <p><span className="block text-[11px] font-semibold tracking-wide text-[#464555] uppercase">Filtered scope</span><span className="text-base font-semibold">{data?.total ?? 0} records</span></p>
            <p><span className="block text-[11px] font-semibold tracking-wide text-[#464555] uppercase">USD grand total</span><span className="text-base font-semibold tabular-nums">{footer ? usd(footer.totalUsd) : "—"}</span></p>
            <p><span className="block text-[11px] font-semibold tracking-wide text-[#464555] uppercase">BDT settlement total</span><span className="text-base font-semibold tabular-nums">{footer ? bdt(footer.totalBdt) : "—"}</span></p>
            <p><span className="block text-[11px] font-semibold tracking-wide text-[#006e2d] uppercase">Paid ({paidShare}%)</span><span className="text-base font-semibold text-[#006e2d] tabular-nums">{footer ? bdt(footer.paidBdt) : "—"}</span></p>
            <p><span className="block text-[11px] font-semibold tracking-wide text-[#684000] uppercase">Unpaid ({unpaidShare}%)</span><span className="text-base font-semibold text-[#684000] tabular-nums">{footer ? bdt(footer.unpaidBdt) : "—"}</span></p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] text-[#464555]">
            <p>Showing {startRow} to {endRow} of {data?.total ?? 0} payments</p>
            <div className="flex items-center gap-2">
              <label className="text-[12px]">
                Per page
                <select aria-label="Rows per page" className="ml-2 h-8 rounded-lg bg-[#eaedff] px-2" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
                  {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Prev</Button>
              <span>Page {data?.page ?? page} of {data?.totalPages ?? 1}</span>
              <Button variant="outline" size="sm" disabled={!data || page >= data.totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
            </div>
          </div>
        </section>
      </div>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-[min(920px,calc(100%-2rem))] flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#1e1b4b] px-4 py-3 text-[13px] text-white shadow-xl">
          <p><span className="font-semibold">{selected.length} payment{selected.length === 1 ? "" : "s"} selected</span><span className="ml-3 text-white/80">Aggregated {usd(selectedUsd.toFixed(2))} • {bdt(selectedBdt.toFixed(2))}</span></p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg bg-[#006e2d] px-3 py-1.5 font-semibold" onClick={() => void bulkPaid()}>Mark as paid</button>
            <button type="button" className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold" onClick={() => void bulkUnpaid()}>Mark as unpaid</button>
            <button type="button" className="rounded-lg bg-white/10 px-3 py-1.5" onClick={() => toast.message("Batch receipts are not on this ledger yet.")}>Batch receipt</button>
            <button type="button" className="rounded-lg px-3 py-1.5 text-white/80" onClick={() => setSelected([])}>Clear selection</button>
          </div>
        </div>
      )}

      <PaymentEntryDialog
        open={dialog !== null}
        users={users}
        editing={editing}
        pending={pending}
        formError={formError}
        onClose={closeDialog}
        onSubmit={(values) => void submitPayment(values)}
        onMarkUnpaid={editing ? () => { closeDialog(); void mark(editing.id, false); } : undefined}
      />
    </div>
  );
}
