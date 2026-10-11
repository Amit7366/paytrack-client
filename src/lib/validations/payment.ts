import Decimal from "decimal.js";
import { z } from "zod";

export const PAYMENT_METHODS = [
  "cashapp",
  "venmo",
  "zelle",
  "giftcard",
  "apple_gift_card",
  "google_play_gift_card",
  "btc",
  "other",
] as const;

export const METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cashapp: "Cash App",
  venmo: "Venmo",
  zelle: "Zelle",
  giftcard: "Gift card",
  apple_gift_card: "Apple gift card",
  google_play_gift_card: "Google Play gift card",
  btc: "BTC",
  other: "Other",
};

export const paymentFieldsSchema = z.object({
  userId: z.string().min(1, "Choose a user"),
  method: z.enum(PAYMENT_METHODS),
  amountUsd: z.string().trim().refine((value) => {
    try {
      return new Decimal(value).gt(0);
    } catch {
      return false;
    }
  }, "Enter a USD amount"),
  rateBdt: z.string().trim().refine((value) => {
    try {
      return new Decimal(value).gt(0);
    } catch {
      return false;
    }
  }, "Enter a BDT rate"),
  paymentDate: z.string().min(1, "Choose a date"),
  note: z.string().trim().max(500).optional().default(""),
});
