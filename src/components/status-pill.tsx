import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: "paid" | "unpaid" | "active" | "inactive" }) {
  const paid = status === "paid" || status === "active";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
        status === "inactive" && "bg-red-100 text-red-700",
      )}
    >
      {status}
    </span>
  );
}
