export type Period = "daily" | "weekly" | "monthly" | "yearly";

export type ReportTotals = {
  totalUsd: string;
  totalBdt: string;
  paidUsd: string;
  paidBdt: string;
  unpaidUsd: string;
  unpaidBdt: string;
  paymentCount: number;
  paidCount: number;
  unpaidCount: number;
  averageRate: string;
};

export type SeriesPoint = {
  label: string;
  usd: string;
  bdt: string;
  paidBdt: string;
  unpaidBdt: string;
  count: number;
  averageRate: string;
};

export type ReportFilters = {
  period: Period;
  from: string;
  to: string;
  userId: string;
};

export const emptyTotals = (): ReportTotals => ({
  totalUsd: "0.00",
  totalBdt: "0.00",
  paidUsd: "0.00",
  paidBdt: "0.00",
  unpaidUsd: "0.00",
  unpaidBdt: "0.00",
  paymentCount: 0,
  paidCount: 0,
  unpaidCount: 0,
  averageRate: "0.0000",
});

export const reportQuery = (filters: ReportFilters, extra?: Record<string, string>) => {
  const params = new URLSearchParams({ period: filters.period, ...extra });
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.userId) params.set("userId", filters.userId);
  return params;
};
