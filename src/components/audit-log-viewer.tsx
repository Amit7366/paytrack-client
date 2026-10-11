"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { readApiError } from "@/lib/read-error";

type AuditRow = {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  meta: unknown;
};

export function AuditLogViewer() {
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ action, entity, search, page: String(page), limit: "20" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const response = await fetch(`/api/super-admin/audit-logs?${params.toString()}`);
    if (!response.ok) {
      toast.error(await readApiError(response));
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as { data: { logs: AuditRow[]; totalPages: number; total: number } };
    setLogs(payload.data.logs);
    setTotalPages(payload.data.totalPages);
    setTotal(payload.data.total);
    setLoading(false);
  }, [action, entity, from, page, search, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Who changed payments, and when. Dates use Asia/Dhaka.</p>
      </div>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action" aria-label="Action" className="w-40" />
        <Input value={entity} onChange={(event) => setEntity(event.target.value)} placeholder="Entity" aria-label="Entity" className="w-32" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search id or action" aria-label="Search" className="w-48" />
        <Input type="date" aria-label="From" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="w-40" />
        <Input type="date" aria-label="To" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="w-40" />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity id</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No audit entries match these filters.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {log.actorName}
                    <span className="block text-xs text-muted-foreground">{log.actorEmail}</span>
                  </TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.entity}</TableCell>
                  <TableCell>{log.entityId}</TableCell>
                  <TableCell className="max-w-xs truncate">{JSON.stringify(log.meta)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">{total} entries</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
