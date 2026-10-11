import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function UserPage() {
  const user = await requireRole("user");
  return (
    <section className="max-w-2xl rounded-2xl border bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-primary uppercase">Your workspace</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{user.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {user.email}. Open Payments to see the USD and BDT records on this account.
      </p>
    </section>
  );
}
