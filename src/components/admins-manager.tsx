"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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
import { createAdminSchema } from "@/lib/validations/admin";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  userCount: number;
  volumeUsd: string;
  volumeBdt: string;
};

type ListResponse = {
  admins: AdminRow[];
  page: number;
  total: number;
  totalPages: number;
};

type DialogState =
  | { type: "create" }
  | { type: "edit"; admin: AdminRow }
  | { type: "password"; admin: AdminRow }
  | { type: "delete"; admin: AdminRow }
  | null;

const readError = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || "Request failed";
};

export function AdminsManager() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      search: submittedSearch,
      page: String(page),
      limit: "8",
    });
    const response = await fetch(`/api/super-admin/admins?${params.toString()}`);
    if (!response.ok) {
      toast.error(await readError(response));
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as { data: ListResponse };
    setData(payload.data);
    setLoading(false);
  }, [page, submittedSearch]);

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
    const parsed = createAdminSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setPending(true);
    const response = await fetch("/api/super-admin/admins", {
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
    toast.success("Admin created");
    closeDialog();
    setPage(1);
    await load();
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dialog?.type !== "edit") return;
    const form = new FormData(event.currentTarget);
    const body = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
    setPending(true);
    const response = await fetch(`/api/super-admin/admins/${dialog.admin.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!response.ok) {
      const message = await readError(response);
      setFormError(message);
      toast.error(message);
      return;
    }
    toast.success("Admin updated");
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
    const response = await fetch(`/api/super-admin/admins/${dialog.admin.id}`, {
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

  const toggleActive = async (admin: AdminRow) => {
    const response = await fetch(`/api/super-admin/admins/${admin.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !admin.isActive }),
    });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    toast.success(admin.isActive ? "Admin deactivated" : "Admin activated");
    await load();
  };

  const confirmDelete = async () => {
    if (dialog?.type !== "delete") return;
    setPending(true);
    const response = await fetch(`/api/super-admin/admins/${dialog.admin.id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    setPending(false);
    if (!response.ok) {
      toast.error(payload?.error || "Unable to delete this admin");
      return;
    }
    toast.success(payload?.message || "Admin removed");
    closeDialog();
    await load();
  };

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Admins</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create admins and manage their access.</p>
        </div>
        <Button onClick={() => setDialog({ type: "create" })}>Create admin</Button>
      </div>

      <form onSubmit={onSearch} className="flex max-w-md gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or email"
          aria-label="Search admins"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Loading admins...
                </TableCell>
              </TableRow>
            )}
            {!loading && data?.admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No admins match this search.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              data?.admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>
                    <Badge variant={admin.isActive ? "secondary" : "destructive"}>
                      {admin.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{admin.userCount}</TableCell>
                  <TableCell className="tabular">
                    <div>{formatUsd(admin.volumeUsd ?? "0.00")}</div>
                    <div className="text-xs text-muted-foreground">{formatBdt(admin.volumeBdt ?? "0.00")}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "edit", admin })}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "password", admin })}>
                        Reset password
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(admin)}>
                        {admin.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "delete", admin })}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          {data ? `${data.total} admin${data.total === 1 ? "" : "s"}` : ""}
        </p>
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

      <Dialog open={dialog?.type === "create"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create admin</DialogTitle>
            <DialogDescription>This account can sign in as an admin.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="create-name">Name</FieldLabel>
                <Input id="create-name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="create-email">Email</FieldLabel>
                <Input id="create-email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="create-password">Password</FieldLabel>
                <Input id="create-password" name="password" type="password" minLength={8} required />
              </Field>
              <FieldError>{formError}</FieldError>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating..." : "Create admin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.type === "edit"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit admin</DialogTitle>
            <DialogDescription>Update the name or email for this admin.</DialogDescription>
          </DialogHeader>
          {dialog?.type === "edit" && (
            <form onSubmit={submitEdit} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="edit-name">Name</FieldLabel>
                  <Input id="edit-name" name="name" defaultValue={dialog.admin.name} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-email">Email</FieldLabel>
                  <Input id="edit-email" name="email" type="email" defaultValue={dialog.admin.email} required />
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
              {dialog?.type === "password" ? `Set a new password for ${dialog.admin.name}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPassword} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="reset-password">New password</FieldLabel>
              <Input id="reset-password" name="password" type="password" minLength={8} required />
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

      <Dialog open={dialog?.type === "delete"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete admin</DialogTitle>
            <DialogDescription>
              {dialog?.type === "delete" && dialog.admin.userCount > 0
                ? `${dialog.admin.name} has created ${dialog.admin.userCount} account${dialog.admin.userCount === 1 ? "" : "s"}, so this will deactivate them instead of removing the record.`
                : `Remove ${dialog?.type === "delete" ? dialog.admin.name : "this admin"} permanently.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirmDelete}>
              {pending ? "Working..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
