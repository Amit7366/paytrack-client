import Decimal from "decimal.js";

const fixed = (amount: string | number, places: number) => new Decimal(amount).toFixed(places);

const groupWestern = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const groupSouthAsian = (digits: string) => {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
};

const parts = (amount: string | number, places: number) => {
  const [raw, fraction] = fixed(amount, places).split(".");
  const negative = raw.startsWith("-");
  return { negative, digits: negative ? raw.slice(1) : raw, fraction };
};

export const formatUsd = (amount: string | number) => {
  const { negative, digits, fraction } = parts(amount, 2);
  return `${negative ? "-" : ""}$${groupWestern(digits)}.${fraction}`;
};

export const formatBdt = (amount: string | number) => {
  const { negative, digits, fraction } = parts(amount, 2);
  return `${negative ? "-" : ""}৳${groupSouthAsian(digits)}.${fraction}`;
};

export const formatRate = (amount: string | number) => {
  const { negative, digits, fraction } = parts(amount, 4);
  return `${negative ? "-" : ""}${groupWestern(digits)}.${fraction}`;
};

export const formatMoney = (amount: string | number, currency: "USD" | "BDT") =>
  currency === "USD" ? formatUsd(amount) : formatBdt(amount);
