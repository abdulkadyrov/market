export const nowIso = () => new Date().toISOString();

export const makeId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-6)}`;

export const toMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const toWeight = (value: number, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const parseNumber = (value: string) => {
  const normalized = value.replace(",", ".").trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const evaluateExpression = (value: string) => {
  const normalized = value.replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");

  if (!normalized) {
    return 0;
  }

  if (!/^[0-9+\-*/.()]+$/.test(normalized)) {
    return Number.NaN;
  }

  try {
    const result = Function(`"use strict"; return (${normalized});`)();
    return typeof result === "number" && Number.isFinite(result) ? result : Number.NaN;
  } catch {
    return Number.NaN;
  }
};

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(toMoney(value));

export const formatWeight = (value: number, precision = 2) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision
  }).format(toWeight(value, precision));

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

export const startOfDayIso = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

export const isToday = (value: string) => new Date(value).getTime() >= new Date(startOfDayIso()).getTime();

export const downloadTextFile = (filename: string, content: string, mime = "application/json") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
