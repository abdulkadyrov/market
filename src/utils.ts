import type { QuickButtonType } from "./types";

export const currency = (value: number, code = "RUB") =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);

export const number = (value: number, digits = 2) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);

export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));

export const dateOnly = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium"
  }).format(new Date(value));

export const nowIso = () => new Date().toISOString();

export const makeId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

export const clampMoney = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export const parseNumberInput = (raw: string) => {
  const normalized = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
};

export const formatQuickButtonLabel = (type: QuickButtonType, value: number) => {
  if (type === "weight") {
    return `${number(value)} кг`;
  }

  return `${number(value, 0)} ₽`;
};

export const seasonRangeStart = () => {
  const current = new Date();
  return new Date(current.getFullYear(), 2, 1).toISOString();
};

export const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const evaluateExpression = (expression: string) => {
  const normalized = expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/[^0-9+\-*/%.() ]/g, "");
  if (!normalized.trim()) {
    return 0;
  }

  const value = Function(`"use strict"; return (${normalized});`)();
  return clampMoney(Number(value));
};
