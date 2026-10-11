"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { emptyTotals, reportQuery, type Period, type ReportFilters, type ReportTotals, type SeriesPoint } from "@/components/reports/report-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    if (tab === "overview" || tab === "users") {
      const summaryResponse = await fetch(`/api/reports/summary?${reportQuery(current).toString()}`);
      if (!summaryResponse.ok) {
        toast.error(await readError(summaryResponse));
        setLoading(false);
        return;
      }
      const summary = (await summaryResponse.json()) as { data: { totals: ReportTotals; series: SeriesPoint[] } };
      setTotals(summary.data.totals);
      setSeries(summary.data.series);
    }
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

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Totals come from the server for the filters on this tab.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={exporting}>
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button key={item.id} size="sm" variant={tab === item.id ? "default" : "outline"} onClick={() => setTab(item.id)}>
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {periods.map((item) => (
          <Button key={item.id} size="sm" variant={current.period === item.id ? "secondary" : "ghost"} onClick={() => updateFilter({ period: item.id })}>
            {item.label}
          </Button>
        ))}
        {datePresets().map((preset) => (
          <Button key={preset.id} size="sm" variant="outline" onClick={() => updateFilter({ from: preset.from, to: preset.to })}>
            {preset.label}
          </Button>
        ))}
        <Input type="date" aria-label="From" value={current.from} onChange={(event) => updateFilter({ from: event.target.value })} className="w-40" />
        <Input type="date" aria-label="To" value={current.to} onChange={(event) => updateFilter({ to: event.target.value })} className="w-40" />
        <select
          aria-label="User"
          value={current.userId}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          onChange={(event) => updateFilter({ userId: event.target.value })}
        >
          <option value="">All users</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <div className="rounded-xl border">
          {tab === "overview" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>USD</TableHead>
                  <TableHead>BDT</TableHead>
                  <TableHead>Paid BDT</TableHead>
                  <TableHead>Unpaid BDT</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No payments in this range.
                    </TableCell>
                  </TableRow>
                )}
                {series.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell>{formatUsd(row.usd)}</TableCell>
                    <TableCell>{formatBdt(row.bdt)}</TableCell>
                    <TableCell>{formatBdt(row.paidBdt)}</TableCell>
                    <TableCell>{formatBdt(row.unpaidBdt)}</TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell>{formatRate(row.averageRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell>{formatUsd(totals.totalUsd)}</TableCell>
                  <TableCell>{formatBdt(totals.totalBdt)}</TableCell>
                  <TableCell>{formatBdt(totals.paidBdt)}</TableCell>
                  <TableCell>{formatBdt(totals.unpaidBdt)}</TableCell>
                  <TableCell>{totals.paymentCount}</TableCell>
                  <TableCell>{formatRate(totals.averageRate)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
          {tab === "users" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Payments</TableHead>
                  <TableHead>USD</TableHead>
                  <TableHead>BDT</TableHead>
                  <TableHead>Paid BDT</TableHead>
                  <TableHead>Unpaid BDT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No users have payments in this range.
                    </TableCell>
                  </TableRow>
                )}
                {userRows.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.paymentCount}</TableCell>
                    <TableCell>{formatUsd(row.totalUsd)}</TableCell>
                    <TableCell>{formatBdt(row.totalBdt)}</TableCell>
                    <TableCell>{formatBdt(row.paidBdt)}</TableCell>
                    <TableCell>{formatBdt(row.unpaidBdt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell>{totals.paymentCount}</TableCell>
                  <TableCell>{formatUsd(totals.totalUsd)}</TableCell>
                  <TableCell>{formatBdt(totals.totalBdt)}</TableCell>
                  <TableCell>{formatBdt(totals.paidBdt)}</TableCell>
                  <TableCell>{formatBdt(totals.unpaidBdt)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
          {(tab === "paid" || tab === "unpaid") && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>USD</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>BDT</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No {tab} payments in this range.
                    </TableCell>
                  </TableRow>
                )}
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.userName}</TableCell>
                    <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                    <TableCell>{METHOD_LABELS[payment.method]}</TableCell>
                    <TableCell>{formatUsd(payment.amountUsd)}</TableCell>
                    <TableCell>{formatRate(payment.rateBdt)}</TableCell>
                    <TableCell>{formatBdt(payment.amountBdt)}</TableCell>
                    <TableCell>
                      <Badge variant={payment.status === "paid" ? "secondary" : "outline"}>
                        {payment.status === "paid" ? "Paid" : "Unpaid"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell>{formatUsd(paymentTotals.totalUsd)}</TableCell>
                  <TableCell />
                  <TableCell>{formatBdt(paymentTotals.totalBdt)}</TableCell>
                  <TableCell>{paymentTotals.count}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </div>
      )}

      {tab !== "overview" && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPages((state) => ({ ...state, [tab]: page - 1 }))}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPages((state) => ({ ...state, [tab]: page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
