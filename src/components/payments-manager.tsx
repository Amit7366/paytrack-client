"use client";

import Decimal from "decimal.js";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

const previewBdt = (amountUsd: string, rateBdt: string) => {
  try {
    const amount = new Decimal(amountUsd);
    const rate = new Decimal(rateBdt);
    if (!amount.gt(0) || !rate.gt(0)) return "—";
    return bdt(amount.toDecimalPlaces(2).mul(rate.toDecimalPlaces(2)).toDecimalPlaces(2).toFixed(2));
  } catch {
    return "—";
  }
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
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"create" | PaymentRow | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [draftUsd, setDraftUsd] = useState("");
  const [draftRate, setDraftRate] = useState("");

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
      limit: "8",
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
  }, [dateFrom, dateTo, page, sortBy, sortDir, status, submittedSearch, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setFormError("");
    setDraftUsd("");
    setDraftRate("");
    setDialog("create");
  };

  const openEdit = (payment: PaymentRow) => {
    setFormError("");
    setDraftUsd(String(payment.amountUsd));
    setDraftRate(String(payment.rateBdt));
    setDialog(payment);
  };

  const closeDialog = () => {
    setDialog(null);
    setFormError("");
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editing = dialog !== "create" && dialog !== null ? dialog : null;
    const parsed = paymentFieldsSchema.safeParse({
      userId: form.get("userId"),
      method: form.get("method"),
      amountUsd: form.get("amountUsd"),
      rateBdt: form.get("rateBdt"),
      paymentDate: form.get("paymentDate"),
      note: form.get("note") ?? "",
    });
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
    setDateFrom(range.from.toISOString());
    setDateTo(range.to.toISOString());
    setPage(1);
  };

  const pageIds = data?.payments.map((payment) => payment.id) ?? [];
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const editing = dialog && dialog !== "create" ? dialog : null;
  const lockedMoney = editing?.status === "paid";
  const totals = data?.totals;
  const footer = useMemo(() => totals, [totals]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">BDT is calculated on the server from the USD amount and that payment’s rate.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={selected.length === 0} onClick={bulkPaid}>
            Mark selected as paid
          </Button>
          <Button onClick={openCreate}>Add payment</Button>
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSubmittedSearch(search.trim());
        }}
      >
        <select
          aria-label="User"
          value={userId}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          onChange={(event) => {
            setUserId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All users</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={status}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          onChange={(event) => {
            setStatus(event.target.value as "all" | "paid" | "unpaid");
            setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <Input
          type="date"
          aria-label="From"
          value={dateFrom ? dayValue(dateFrom) : ""}
          onChange={(event) => {
            setDateFrom(event.target.value ? startOfDay(new Date(`${event.target.value}T12:00:00`)).toISOString() : "");
            setPage(1);
          }}
          className="w-40"
        />
        <Input
          type="date"
          aria-label="To"
          value={dateTo ? dayValue(dateTo) : ""}
          onChange={(event) => {
            setDateTo(event.target.value ? endOfDay(new Date(`${event.target.value}T12:00:00`)).toISOString() : "");
            setPage(1);
          }}
          className="w-40"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search note or user"
          aria-label="Search payments"
          className="w-48"
        />
        <select
          aria-label="Sort"
          value={sortBy}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="paymentDate">Date</option>
          <option value="amountUsd">USD</option>
          <option value="amountBdt">BDT</option>
          <option value="status">Status</option>
        </select>
        <Button type="submit" variant="outline">
          Search
        </Button>
        <Button type="button" variant="ghost" onClick={() => applyRange("7d")}>
          7D
        </Button>
        <Button type="button" variant="ghost" onClick={() => applyRange("30d")}>
          30D
        </Button>
        <Button type="button" variant="ghost" onClick={() => applyRange("today")}>
          Today
        </Button>
        <Button type="button" variant="ghost" onClick={() => applyRange("week")}>
          This week
        </Button>
        <Button type="button" variant="ghost" onClick={() => applyRange("month")}>
          This month
        </Button>
        <Button type="button" variant="ghost" onClick={() => applyRange("year")}>
          This year
        </Button>
      </form>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all payments on this page"
                  checked={allSelected}
                  onChange={(event) => setSelected(event.target.checked ? pageIds : [])}
                />
              </TableHead>
              {(
                [
                  ["userName", "User"],
                  ["paymentDate", "Date"],
                  ["method", "Method"],
                  ["amountUsd", "USD"],
                  ["rateBdt", "Rate"],
                  ["amountBdt", "BDT"],
                  ["status", "Status"],
                ] as const
              ).map(([key, label]) => (
                <TableHead key={key}>
                  <button
                    type="button"
                    className="font-medium"
                    onClick={() => {
                      if (!["paymentDate", "amountUsd", "amountBdt", "status"].includes(key)) return;
                      setSortDir(sortBy === key && sortDir === "desc" ? "asc" : "desc");
                      setSortBy(key);
                      setPage(1);
                    }}
                  >
                    {label}
                    {sortBy === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </TableHead>
              ))}
              <TableHead>Paid by</TableHead>
              <TableHead>Paid at</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground">
                  Loading payments...
                </TableCell>
              </TableRow>
            )}
            {!loading && data?.payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground">
                  No payments match these filters.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              data?.payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select payment for ${payment.userName}`}
                      checked={selected.includes(payment.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked ? [...current, payment.id] : current.filter((id) => id !== payment.id),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>{payment.userName}</TableCell>
                  <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                  <TableCell>{METHOD_LABELS[payment.method]}</TableCell>
                  <TableCell>{usd(payment.amountUsd)}</TableCell>
                  <TableCell>{payment.rateBdt}</TableCell>
                  <TableCell>{bdt(payment.amountBdt)}</TableCell>
                  <TableCell>
                    <Badge variant={payment.status === "paid" ? "secondary" : "outline"}>
                      {payment.status === "paid" ? "Paid" : "Unpaid"}
                    </Badge>
                  </TableCell>
                  <TableCell>{payment.paidByName ?? "—"}</TableCell>
                  <TableCell>{when(payment.paidAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(payment)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => mark(payment.id, payment.status !== "paid")}>
                        {payment.status === "paid" ? "Mark unpaid" : "Mark paid"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(payment)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {footer && (
        <div className="grid gap-3 text-sm sm:grid-cols-4">
          <p>Total USD <span className="block font-medium">{usd(footer.totalUsd)}</span></p>
          <p>Total BDT <span className="block font-medium">{bdt(footer.totalBdt)}</span></p>
          <p>
            Paid <span className="block font-medium">{usd(footer.paidUsd)} · {bdt(footer.paidBdt)}</span>
          </p>
          <p>
            Unpaid <span className="block font-medium">{usd(footer.unpaidUsd)} · {bdt(footer.unpaidBdt)}</span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">{data ? `${data.total} payment${data.total === 1 ? "" : "s"}` : ""}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </Button>
          <span>
            Page {data?.page ?? page} of {data?.totalPages ?? 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data || page >= data.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit payment" : "Add payment"}</DialogTitle>
            <DialogDescription>
              {lockedMoney
                ? "This payment is paid. Mark it unpaid before changing the USD amount or rate."
                : "The BDT amount is calculated when the payment is saved."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPayment} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="pay-user">User</FieldLabel>
                <select
                  id="pay-user"
                  name="userId"
                  defaultValue={editing?.userId ?? ""}
                  className="h-8 rounded-lg border bg-background px-2 text-sm"
                  required
                >
                  <option value="">Choose a user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="pay-method">Method</FieldLabel>
                <select
                  id="pay-method"
                  name="method"
                  defaultValue={editing?.method ?? "cashapp"}
                  className="h-8 rounded-lg border bg-background px-2 text-sm"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="pay-usd">USD</FieldLabel>
                <Input
                  id="pay-usd"
                  name="amountUsd"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={editing?.amountUsd}
                  disabled={lockedMoney}
                  onChange={(event) => setDraftUsd(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pay-rate">BDT rate</FieldLabel>
                <Input
                  id="pay-rate"
                  name="rateBdt"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={editing?.rateBdt}
                  disabled={lockedMoney}
                  onChange={(event) => setDraftRate(event.target.value)}
                  required
                />
              </Field>
              <p className="text-sm text-muted-foreground">BDT preview {previewBdt(draftUsd, draftRate)}</p>
              <Field>
                <FieldLabel htmlFor="pay-date">Payment date</FieldLabel>
                <Input
                  id="pay-date"
                  name="paymentDate"
                  type="date"
                  defaultValue={editing ? dayValue(editing.paymentDate) : dayValue(new Date().toISOString())}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pay-note">Note</FieldLabel>
                <Input id="pay-note" name="note" defaultValue={editing?.note ?? ""} />
              </Field>
              <FieldError>{formError}</FieldError>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : editing ? "Save changes" : "Add payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
