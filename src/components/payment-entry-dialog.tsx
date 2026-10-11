"use client";

import Decimal from "decimal.js";
import { FormEvent, useEffect, useState } from "react";
import { Lock, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatBdt } from "@/lib/money";
import { METHOD_LABELS, PAYMENT_METHODS } from "@/lib/validations/payment";

export type PaymentEntryValues = {
  userId: string;
  method: (typeof PAYMENT_METHODS)[number];
  amountUsd: string;
  rateBdt: string;
  paymentDate: string;
  note: string;
  initialStatus?: "paid" | "unpaid";
};

type EditingPayment = {
  id: string;
  userId: string;
  userName?: string;
  method: (typeof PAYMENT_METHODS)[number];
  amountUsd: string | number;
  rateBdt: string | number;
  amountBdt?: string | number;
  paymentDate: string;
  note: string;
  status: "paid" | "unpaid";
};

const day = (value?: string) => (value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

const preview = (usd: string, rate: string) => {
  try {
    const amount = new Decimal(usd);
    const fx = new Decimal(rate);
    if (!amount.gt(0) || !fx.gt(0)) return null;
    const bdt = amount.toDecimalPlaces(2).mul(fx.toDecimalPlaces(2)).toDecimalPlaces(2);
    return { usd: amount.toDecimalPlaces(2).toFixed(2), rate: fx.toDecimalPlaces(2).toFixed(4), bdt: formatBdt(bdt.toFixed(2)) };
  } catch {
    return null;
  }
};

const fieldClass = "h-11 w-full rounded-lg bg-[#eaedff] px-3 text-[14px] text-[#131b2e] outline-none focus:ring-2 focus:ring-[#4f46e5]";

export function PaymentEntryDialog({
  open,
  users,
  editing,
  fixedUser,
  allowInitialStatus = false,
  pending,
  formError,
  onClose,
  onSubmit,
  onMarkUnpaid,
}: {
  open: boolean;
  users: Array<{ id: string; name: string }>;
  editing: EditingPayment | null;
  fixedUser?: { id: string; name: string };
  allowInitialStatus?: boolean;
  pending: boolean;
  formError: string;
  onClose: () => void;
  onSubmit: (values: PaymentEntryValues) => void;
  onMarkUnpaid?: () => void;
}) {
  const locked = editing?.status === "paid";
  const [usd, setUsd] = useState("");
  const [rate, setRate] = useState("");
  const [paymentDate, setPaymentDate] = useState(day());

  useEffect(() => {
    if (!open) return;
    setUsd(editing ? String(editing.amountUsd) : "");
    setRate(editing ? String(editing.rateBdt) : "");
    setPaymentDate(editing ? day(editing.paymentDate) : day());
  }, [editing, open]);

  const quote = preview(usd, rate);
  const counterparty = fixedUser?.name ?? users.find((user) => user.id === editing?.userId)?.name ?? editing?.userName ?? "Counterparty";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      userId: fixedUser?.id ?? editing?.userId ?? String(form.get("userId") ?? ""),
      method: String(form.get("method") ?? "cashapp") as PaymentEntryValues["method"],
      amountUsd: usd,
      rateBdt: rate,
      paymentDate,
      note: String(form.get("note") ?? ""),
      initialStatus: allowInitialStatus && !editing ? (String(form.get("initialStatus") ?? "unpaid") as "paid" | "unpaid") : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white p-0 text-[#131b2e] sm:max-w-xl" showCloseButton={false}>
        <form key={editing?.id ?? "create"} onSubmit={submit} className="flex flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[#eeeaf4] px-6 py-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl font-bold">{editing ? "Edit payment" : "New cross-border payment"}</DialogTitle>
                <span className="rounded-full bg-[#e2e7ff] px-2 py-0.5 text-[11px] font-semibold text-[#3525cd]">USD → BDT</span>
                {locked && <span className="rounded-full bg-[#7cf994]/40 px-2 py-0.5 text-[11px] font-semibold text-[#006e2d]">Paid & cleared</span>}
              </div>
              <DialogDescription className="mt-1 text-[13px] text-[#464555]">
                {locked
                  ? `TXN-${editing.id.slice(-6).toUpperCase()} is paid. Amount and rate stay locked until it is marked unpaid.`
                  : "Record a payment and lock the settlement rate for this counterparty."}
              </DialogDescription>
            </div>
            <button type="button" aria-label="Close" className="rounded-lg p-1.5 text-[#464555] hover:bg-[#eaedff]" onClick={onClose}>
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 px-6 py-5">
            {locked && (
              <div className="flex flex-col gap-3 rounded-xl bg-[#e2e7ff] px-4 py-3 text-[13px] text-[#3525cd]">
                <p className="inline-flex items-center gap-2 font-semibold"><Lock className="size-4" /> Ledger lock is active. Mark unpaid to change USD or the rate.</p>
                {onMarkUnpaid && (
                  <button type="button" className="w-fit rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-[#3525cd]" onClick={onMarkUnpaid}>
                    Mark as unpaid
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-[#faf8ff] px-3 py-2 text-[12px] text-[#464555]">
              <span>Live entry rate {quote ? `1 USD = ৳${quote.rate}` : "Enter USD and a rate"}</span>
              <span>{counterparty}</span>
            </div>

            {fixedUser || locked ? (
              <div className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#464555]">
                Beneficiary / user
                <p className={`${fieldClass} flex items-center`}>{counterparty}</p>
              </div>
            ) : (
              <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#464555]">
                <span>Beneficiary / user <span className="text-[#3525cd]">*</span></span>
                <select name="userId" defaultValue={editing?.userId ?? ""} className={fieldClass} required>
                  <option value="">Choose a user</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#464555]">
              <span>Payment method <span className="text-[#3525cd]">*</span></span>
              <select name="method" defaultValue={editing?.method ?? "cashapp"} className={fieldClass} required>
                {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{METHOD_LABELS[method]}</option>)}
              </select>
              <span className="font-normal">Required to record how this payment was sent.</span>
            </label>

            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#464555]">
              <span className="flex items-center justify-between">
                <span>Payment date <span className="text-[#3525cd]">*</span></span>
                <button type="button" className="font-semibold text-[#3525cd]" onClick={() => setPaymentDate(day())} disabled={locked}>Today</button>
              </span>
              <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className={fieldClass} required readOnly={locked} />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#464555]">
                <span>Amount in USD <span className="text-[#3525cd]">*</span></span>
                <span className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#464555]">$</span>
                  <input value={usd} onChange={(event) => setUsd(event.target.value)} inputMode="decimal" className={`${fieldClass} pl-7`} required readOnly={locked} />
                </span>
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#464555]">
                <span>Rate USD → BDT <span className="text-[#3525cd]">*</span></span>
                <span className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#464555]">৳</span>
                  <input value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" className={`${fieldClass} pl-7`} required readOnly={locked} />
                </span>
              </label>
            </div>

            <div className="rounded-xl bg-[#eaedff] px-4 py-3">
              <p className="text-[11px] font-semibold tracking-wide text-[#464555] uppercase">Calculated amount in BDT</p>
              <p className="mt-1 text-2xl font-bold text-[#006e2d] tabular-nums">{quote?.bdt ?? "৳0.00"}</p>
              <p className="mt-1 text-[12px] text-[#464555]">{quote ? `Formula: USD ${quote.usd} × ৳${quote.rate}` : "BDT is calculated when the payment is saved."}</p>
            </div>

            {allowInitialStatus && !editing && (
              <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#464555]">
                Initial status
                <select name="initialStatus" defaultValue="unpaid" className={fieldClass}>
                  <option value="unpaid">Queue as unpaid</option>
                  <option value="paid">Mark paid immediately</option>
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#464555]">
              Commercial note <span className="font-normal text-[#464555]">(optional)</span>
              <input name="note" defaultValue={editing?.note ?? ""} className={fieldClass} />
            </label>
            <p className="text-[12px] text-[#006e2d]">SLA: T+0 same day settlement is a desk label. The saved rate is the one on this payment.</p>
            {formError && <p className="text-[13px] text-red-600">{formError}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-[#eeeaf4] px-6 py-4">
            <button type="button" className="rounded-lg bg-[#eaedff] px-4 py-2 text-[13px] font-medium" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-[#4f46e5] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#3525cd] disabled:opacity-60">
              {pending ? "Saving..." : editing ? "Save changes" : "Save & lock payment"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
