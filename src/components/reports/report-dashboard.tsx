"use client";

import Decimal from "decimal.js";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ReportCharts } from "@/components/reports/report-charts";
import { emptyTotals, reportQuery, type Period, type ReportTotals, type SeriesPoint } from "@/components/reports/report-types";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { datePresets, previousWindow } from "@/lib/date-presets";
import { formatBdt, formatRate, formatUsd } from "@/lib/money";

const periods: Array<{ id: Period; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

export function ReportDashboard({ title, description }: { title: string; description: string }) {
  const [period, setPeriod] = useState<Period>("monthly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [totals, setTotals] = useState<ReportTotals>(emptyTotals());
  const [previousBdt, setPreviousBdt] = useState<string | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/reports/summary?${reportQuery({ period, from, to, userId: "" }).toString()}`);
    const payload = (await response.json().catch(() => null)) as { error?: string; data?: { totals: ReportTotals; series: SeriesPoint[] } } | null;
    if (!response.ok || !payload?.data) {
      toast.error(payload?.error || "Report could not be loaded");
      setTotals(emptyTotals());
      setSeries([]);
      setLoading(false);
      return;
    }
    setTotals(payload.data.totals);
    setSeries(payload.data.series);
    if (from && to) {
      const previous = previousWindow(from, to);
      const compare = await fetch(`/api/reports/summary?${reportQuery({ period, from: previous.from, to: previous.to, userId: "" }).toString()}`);
      const compared = (await compare.json().catch(() => null)) as { data?: { totals: ReportTotals } } | null;
      setPreviousBdt(compare.ok && compared?.data ? compared.data.totals.totalBdt : null);
    } else {
      setPreviousBdt(null);
    }
    setLoading(false);
  }, [from, period, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const trend = (() => {
    if (!previousBdt) return null;
    const previous = new Decimal(previousBdt);
    if (previous.isZero()) return null;
    return new Decimal(totals.totalBdt).minus(previous).div(previous).mul(100).toFixed(1);
  })();

  const cards = [
    { label: "Total USD", value: formatUsd(totals.totalUsd), hint: null as string | null },
    { label: "Total BDT", value: formatBdt(totals.totalBdt), hint: trend ? `${Number(trend) > 0 ? "+" : ""}${trend}% vs previous` : null },
    { label: "Paid BDT", value: formatBdt(totals.paidBdt), hint: null },
    { label: "Unpaid BDT", value: formatBdt(totals.unpaidBdt), hint: null },
    { label: "Payments", value: String(totals.paymentCount), hint: null },
    { label: "Average rate", value: formatRate(totals.averageRate), hint: null },
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periods.map((item) => (
            <Button key={item.id} size="sm" variant={period === item.id ? "default" : "outline"} onClick={() => setPeriod(item.id)}>
              {item.label}
            </Button>
          ))}
          {datePresets().map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant="outline"
              onClick={() => {
                setFrom(preset.from);
                setTo(preset.to);
              }}
            >
              {preset.label}
            </Button>
          ))}
          <Input type="date" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40" />
          <Input type="date" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} className="w-40" />
        </div>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Skeleton key={card.label} className="h-24" />
          ))}
          <Skeleton className="h-80 xl:col-span-2" />
          <Skeleton className="h-80" />
          <Skeleton className="h-72 xl:col-span-3" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <Card key={card.label}>
                <CardHeader>
                  <CardDescription>{card.label}</CardDescription>
                  <CardTitle className="tabular text-2xl">{card.value}</CardTitle>
                  {card.hint && <p className="text-xs font-medium text-emerald-700">{card.hint}</p>}
                </CardHeader>
              </Card>
            ))}
          </div>
          <ReportCharts series={series} totals={totals} />
        </>
      )}
    </section>
  );
}
