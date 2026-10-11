import { cookies } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { formatBdt, formatUsd } from "@/lib/money";
import { METHOD_LABELS, PAYMENT_METHODS } from "@/lib/validations/payment";

export const instant = false;

type PaymentRow = {
  id: string;
  method: (typeof PAYMENT_METHODS)[number];
  amountUsd: number;
  rateBdt: number;
  amountBdt: number;
  paymentDate: string;
  status: "paid" | "unpaid";
  note: string;
};

const usd = formatUsd;
const bdt = formatBdt;

export default async function UserPaymentsPage() {
  await requireRole("user");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const response = await fetch(
    `${process.env.API_URL ?? "http://localhost:4000/api"}/payments?limit=20&sortBy=paymentDate&sortDir=desc`,
    { headers: { cookie: `${SESSION_COOKIE}=${token ?? ""}` }, cache: "no-store" },
  );
  const payload = response.ok ? ((await response.json()) as { data?: { payments?: PaymentRow[] } }) : null;
  const payments = payload?.data?.payments ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Payments recorded for your account.</p>
      </div>
      {payments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
      <div className="flex flex-col gap-3">
        {payments.map((payment) => (
          <article key={payment.id} className="rounded-xl border px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{usd(payment.amountUsd)}</p>
              <Badge variant={payment.status === "paid" ? "secondary" : "outline"}>
                {payment.status === "paid" ? "Paid" : "Unpaid"}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              {new Date(payment.paymentDate).toLocaleDateString()} · {METHOD_LABELS[payment.method]} · rate {payment.rateBdt} · {bdt(payment.amountBdt)}
            </p>
            {payment.note && <p className="mt-1">{payment.note}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
