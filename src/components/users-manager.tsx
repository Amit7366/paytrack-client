"use client";

import Decimal from "decimal.js";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { emptyTotals, type ReportTotals } from "@/components/reports/report-types";
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
import { formatBdt, formatMoney, formatUsd } from "@/lib/money";
import { createManagedUserSchema } from "@/lib/validations/managed-user";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt?: string;
  totalUsd: number;
  totalBdt: number;
  paidUsd: number;
  paidBdt: number;
  unpaidUsd: number;
  unpaidBdt: number;
};

type ListResponse = {
  users: ManagedUser[];
  page: number;
  total: number;
  totalPages: number;
};

type DialogState =
  | { type: "create" }
  | { type: "edit"; user: ManagedUser }
  | { type: "password"; user: ManagedUser }
  | { type: "status"; user: ManagedUser }
  | null;

const money = formatMoney;

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : "—");

const readError = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || "Request failed";
};

export function UsersManager() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [portfolio, setPortfolio] = useState<ReportTotals>(emptyTotals());
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [sortKey, setSortKey] = useState<"name" | "usd">("usd");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      search: submittedSearch,
      status,
      page: String(page),
      limit: "8",
    });
    const response = await fetch(`/api/admin/users?${params.toString()}`);
    if (!response.ok) {
      toast.error(await readError(response));
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as { data: ListResponse };
    setData(payload.data);
    const [summaryRes, activeRes, inactiveRes] = await Promise.all([
      fetch("/api/reports/summary?period=monthly"),
      fetch("/api/admin/users?status=active&limit=1"),
      fetch("/api/admin/users?status=inactive&limit=1"),
    ]);
    const summary = (await summaryRes.json().catch(() => null)) as { data?: { totals: ReportTotals } } | null;
    const active = (await activeRes.json().catch(() => null)) as { data?: { total: number } } | null;
    const inactive = (await inactiveRes.json().catch(() => null)) as { data?: { total: number } } | null;
    if (summary?.data?.totals) setPortfolio(summary.data.totals);
    setActiveCount(active?.data?.total ?? 0);
    setInactiveCount(inactive?.data?.total ?? 0);
    setLoading(false);
  }, [page, status, submittedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const closeDialog = () => {
    setDialog(null);
    setFormError("");
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = createManagedUserSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setPending(true);
    const response = await fetch("/api/admin/users", {
      method: "POST",
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
    toast.success("User created");
    closeDialog();
    setPage(1);
    await load();
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dialog?.type !== "edit") return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    const response = await fetch(`/api/admin/users/${dialog.user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
      }),
    });
    setPending(false);
    if (!response.ok) {
      const message = await readError(response);
      setFormError(message);
      toast.error(message);
      return;
    }
    toast.success("User updated");
    closeDialog();
    await load();
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dialog?.type !== "password") return;
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }
    setPending(true);
    const response = await fetch(`/api/admin/users/${dialog.user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setPending(false);
    if (!response.ok) {
      const message = await readError(response);
      setFormError(message);
      toast.error(message);
      return;
    }
    toast.success("Password reset");
    closeDialog();
  };

  const confirmStatus = async () => {
    if (dialog?.type !== "status") return;
    setPending(true);
    const response = await fetch(`/api/admin/users/${dialog.user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !dialog.user.isActive }),
    });
    setPending(false);
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    toast.success(dialog.user.isActive ? "User deactivated" : "User activated");
    closeDialog();
    await load();
  };

  const rows = useMemo(() => {
    const users = [...(data?.users ?? [])];
    users.sort((left, right) => {
      if (sortKey === "name") return left.name.localeCompare(right.name);
      return new Decimal(right.totalUsd || 0).comparedTo(left.totalUsd || 0);
    });
    return users;
  }, [data?.users, sortKey]);
  const settledShare = (() => {
    const total = new Decimal(portfolio.totalBdt || 0);
    if (total.isZero()) return "0.0";
    return new Decimal(portfolio.paidBdt || 0).div(total).mul(100).toFixed(1);
  })();
  const queueShare = (() => {
    const total = new Decimal(portfolio.totalBdt || 0);
    if (total.isZero()) return "0.0";
    return new Decimal(portfolio.unpaidBdt || 0).div(total).mul(100).toFixed(1);
  })();
  const initials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  const exportCsv = async () => {
    const response = await fetch("/api/reports/export?type=by-user&format=csv");
    if (!response.ok) {
      toast.error("Export failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "users.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="-mx-4 -my-6 min-h-full bg-[#faf8ff] px-4 py-6 text-[#131b2e] md:-mx-8 md:px-8">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#464555] uppercase">Counterparty accounts / US-BD corridor</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-[32px] leading-10 font-bold tracking-tight">Assigned Users Management</h1>
            <span className="rounded-full bg-[#eaedff] px-2 py-0.5 text-[11px] font-bold text-[#3525cd]">YOUR DESK</span>
          </div>
          <p className="mt-2 max-w-3xl text-[13px] text-[#464555]">
            Direct institutional oversight of high-frequency remittance counterparties, settlement thresholds, dual-currency volume ledgers, and automated clearing routes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-lg bg-[#4f46e5] px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-[#3525cd]" onClick={() => setDialog({ type: "create" })}>
            + Add User
          </button>
          <button type="button" className="rounded-lg bg-white px-4 py-2 text-[13px] font-medium shadow-sm" onClick={() => void exportCsv()}>
            Export CSV
          </button>
          <button type="button" className="rounded-lg bg-white px-3 py-2 text-[13px] shadow-sm" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-lg bg-[#f2f3ff] text-[#3525cd]">Users</span>
            <span className="rounded-full bg-[#eaedff] px-2 py-0.5 text-[11px] font-semibold text-[#3525cd]">{activeCount} Active</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[#464555] uppercase">Total Assigned Users</p>
            <p className="text-2xl font-semibold">{(activeCount + inactiveCount).toLocaleString()} <span className="text-xs font-normal text-[#464555]">portfolio seats</span></p>
          </div>
          <div className="flex justify-between text-xs text-[#464555]">
            <span>Pending Activation</span>
            <span className="font-medium text-[#684000]">{inactiveCount} counterparties</span>
          </div>
        </article>
        <article className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-lg bg-[#f2f3ff] text-[#3525cd]">USD</span>
            <span className="rounded-full bg-[#e2e7ff] px-2 py-0.5 text-xs">US-BD Corridor</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[#464555] uppercase">Total Portfolio USD</p>
            <p className="text-2xl font-semibold tabular">{formatUsd(portfolio.totalUsd)}</p>
          </div>
          <div className="flex justify-between text-xs text-[#464555]">
            <span>Spot Aggregate Rate</span>
            <span className="font-semibold text-[#006e2d]">1 USD = ৳{new Decimal(portfolio.averageRate || 0).toFixed(2)}</span>
          </div>
        </article>
        <article className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-lg bg-[#f2f3ff] text-[#006e2d]">Paid</span>
            <span className="rounded-full bg-[#7ffc97]/50 px-2 py-0.5 text-[11px] font-semibold text-[#005320]">{settledShare}% Settled</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[#464555] uppercase">Total Settled (Paid BDT)</p>
            <p className="text-xl font-bold text-[#006e2d] tabular">{formatBdt(portfolio.paidBdt)}</p>
          </div>
          <div className="flex justify-between text-xs text-[#464555]">
            <span>Clearing Rails</span>
            <span>BEFTN / RTGS</span>
          </div>
        </article>
        <article className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-lg bg-[#f2f3ff] text-[#684000]">Hold</span>
            <span className="rounded-full bg-[#ffddb8] px-2 py-0.5 text-[11px] font-semibold text-[#2a1700]">{queueShare}% In Queue</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[#464555] uppercase">Pending Pipeline (Unpaid BDT)</p>
            <p className="text-xl font-bold text-[#684000] tabular">{formatBdt(portfolio.unpaidBdt)}</p>
          </div>
          <div className="flex justify-between text-xs text-[#464555]">
            <span>Desk SLA Window</span>
            <span>&lt; 90 min remaining</span>
          </div>
        </article>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSubmittedSearch(search.trim());
        }}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-2 shadow-sm"
      >
        <div className="flex gap-1 rounded-lg bg-[#f2f3ff] p-1">
          <span className="rounded-md bg-white px-4 py-1.5 text-[13px] font-semibold text-[#3525cd] shadow-sm">Table View (Default)</span>
          <button type="button" className="rounded-md px-4 py-1.5 text-[13px] text-[#464555]" onClick={() => setDialog({ type: "create" })}>
            + Add User Modal
          </button>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users by name or email"
            aria-label="Search users"
            className="h-9 max-w-md border-0 bg-[#f2f3ff]"
          />
          <select
            value={status}
            aria-label="Status"
            className="h-9 rounded-lg bg-[#f2f3ff] px-3 text-[13px]"
            onChange={(event) => {
              setStatus(event.target.value as "all" | "active" | "inactive");
              setPage(1);
            }}
          >
            <option value="all">Status: All ({activeCount + inactiveCount})</option>
            <option value="active">Active Only ({activeCount})</option>
            <option value="inactive">Inactive / Pending ({inactiveCount})</option>
          </select>
          <select aria-label="Corridor" className="h-9 rounded-lg bg-[#f2f3ff] px-3 text-[13px]" defaultValue="us-bd">
            <option value="us-bd">US &gt; BD Tech & Trade</option>
          </select>
          <Button type="submit" variant="outline">Search</Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#f2f3ff] hover:bg-[#f2f3ff]">
              <TableHead>
                <button type="button" onClick={() => setSortKey("name")}>Counterparty / Entity</button>
              </TableHead>
              <TableHead>Email contact</TableHead>
              <TableHead className="text-right">
                <button type="button" onClick={() => setSortKey("usd")}>Total USD</button>
              </TableHead>
              <TableHead className="text-right">Total BDT</TableHead>
              <TableHead className="text-right">Paid BDT</TableHead>
              <TableHead className="text-right">Unpaid BDT</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  Loading users...
                </TableCell>
              </TableRow>
            )}
            {!loading && data?.users.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  No users match this search.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              rows.map((user) => (
                <TableRow
                  key={user.id}
                  className="h-14 cursor-pointer"
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-[#e2e7ff] text-[13px] font-bold text-[#3525cd]">{initials(user.name)}</span>
                      <span>
                        <span className="block font-semibold">{user.name}</span>
                        <span className="block text-xs text-[#464555]">US-BD Tech & Trade</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-right font-semibold tabular">{money(user.totalUsd, "USD")}</TableCell>
                  <TableCell className="text-right tabular text-[#464555]">{money(user.totalBdt, "BDT")}</TableCell>
                  <TableCell className="text-right font-semibold tabular text-[#006e2d]">{formatBdt(user.paidBdt)}</TableCell>
                  <TableCell className="text-right tabular text-[#684000]">{formatBdt(user.unpaidBdt)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={user.isActive ? "secondary" : "destructive"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "edit", user })}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "password", user })}>
                        Reset password
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "status", user })}>
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">{data ? `${data.total} user${data.total === 1 ? "" : "s"}` : ""}</p>
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
      </div>

      <Dialog open={dialog?.type === "create"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>The new account is a user linked to you.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="user-name">Name</FieldLabel>
                <Input id="user-name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="user-email">Email</FieldLabel>
                <Input id="user-email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="user-password">Password</FieldLabel>
                <Input id="user-password" name="password" type="password" minLength={8} required />
              </Field>
              <FieldError>{formError}</FieldError>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating..." : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.type === "edit"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Update the name or email.</DialogDescription>
          </DialogHeader>
          {dialog?.type === "edit" && (
            <form onSubmit={submitEdit} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="edit-user-name">Name</FieldLabel>
                  <Input id="edit-user-name" name="name" defaultValue={dialog.user.name} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-user-email">Email</FieldLabel>
                  <Input id="edit-user-email" name="email" type="email" defaultValue={dialog.user.email} required />
                </Field>
                <FieldError>{formError}</FieldError>
              </FieldGroup>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.type === "password"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {dialog?.type === "password" ? `Set a new password for ${dialog.user.name}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPassword} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="user-reset-password">New password</FieldLabel>
              <Input id="user-reset-password" name="password" type="password" minLength={8} required />
              <FieldError>{formError}</FieldError>
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Reset password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.type === "status"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.type === "status" && dialog.user.isActive ? "Deactivate user" : "Activate user"}</DialogTitle>
            <DialogDescription>
              {dialog?.type === "status"
                ? dialog.user.isActive
                  ? `${dialog.user.name} will not be able to sign in until you activate them again.`
                  : `${dialog.user.name} will be able to sign in again.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button variant={dialog?.type === "status" && dialog.user.isActive ? "destructive" : "default"} disabled={pending} onClick={confirmStatus}>
              {pending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
