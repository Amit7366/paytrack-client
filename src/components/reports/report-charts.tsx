"use client";

import Decimal from "decimal.js";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBdt, formatRate } from "@/lib/money";
import type { ReportTotals, SeriesPoint } from "./report-types";

const paidColor = "#2f6f4e";
const unpaidColor = "#c48a12";
const rateColor = "#315fbd";

const tipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

export function ReportCharts({
  series,
  totals,
  layout = "full",
}: {
  series: SeriesPoint[];
  totals: ReportTotals;
  layout?: "full" | "period";
}) {
  const slices = [
    { name: "Paid", value: totals.paidBdt, fill: paidColor },
    { name: "Unpaid", value: totals.unpaidBdt, fill: unpaidColor },
  ]
    .filter((slice) => new Decimal(slice.value).gt(0))
    .map((slice) => ({ ...slice, value: new Decimal(slice.value).toNumber() }));
  const bars = series.map((row) => ({
    label: row.label,
    paidBdt: new Decimal(row.paidBdt).toNumber(),
    unpaidBdt: new Decimal(row.unpaidBdt).toNumber(),
    averageRate: new Decimal(row.averageRate).toNumber(),
  }));
  const hasSeries = bars.length > 0;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className={layout === "full" ? "xl:col-span-2" : "xl:col-span-3"}>
        <CardHeader>
          <CardTitle>BDT by period</CardTitle>
          <CardDescription>Paid and unpaid amounts in each bucket.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {hasSeries ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value: number) => formatBdt(value)} width={88} />
                <Tooltip formatter={(value) => formatBdt(Number(value))} contentStyle={tipStyle} />
                <Legend />
                <Bar dataKey="paidBdt" name="Paid" stackId="bdt" fill={paidColor} />
                <Bar dataKey="unpaidBdt" name="Unpaid" stackId="bdt" fill={unpaidColor} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No payments in this range." />
          )}
        </CardContent>
      </Card>
      {layout === "full" && <Card>
        <CardHeader>
          <CardTitle>Paid vs unpaid</CardTitle>
          <CardDescription>Share of BDT.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {slices.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2}>
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatBdt(Number(value))} contentStyle={tipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Nothing paid or unpaid in this range." />
          )}
        </CardContent>
      </Card>}
      {layout === "full" && <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Average rate</CardTitle>
          <CardDescription>Weighted BDT per USD for each period.</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          {hasSeries ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bars}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={64} />
                <Tooltip formatter={(value) => formatRate(Number(value))} contentStyle={tipStyle} />
                <Line type="monotone" dataKey="averageRate" name="Average rate" stroke={rateColor} strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No rate to plot in this range." />
          )}
        </CardContent>
      </Card>}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{label}</div>;
}
