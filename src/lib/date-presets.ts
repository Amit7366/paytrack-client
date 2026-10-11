const iso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const shift = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const datePresets = () => {
  const today = new Date();
  const start = iso(today);
  return [
    { id: "today", label: "Today", from: start, to: start },
    { id: "7d", label: "7D", from: iso(shift(today, -6)), to: start },
    { id: "30d", label: "30D", from: iso(shift(today, -29)), to: start },
    { id: "mtd", label: "MTD", from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: start },
  ];
};

export const previousWindow = (from: string, to: string) => {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = shift(start, -1);
  return { from: iso(shift(previousEnd, -(days - 1))), to: iso(previousEnd) };
};
