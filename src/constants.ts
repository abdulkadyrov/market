import type { QuickButtonType } from "./types";
import { formatQuickButtonLabel, makeId, nowIso } from "./utils";

export const expenseCategories = [
  "fuel",
  "repair",
  "oil",
  "road",
  "loading",
  "unloading",
  "market_place",
  "rent",
  "packaging",
  "boxes_bags",
  "lunch",
  "water_tea",
  "helper_salary",
  "workers",
  "fine",
  "other"
] as const;

export const writeOffReasons = [
  "Испортилось",
  "Помялось",
  "Сгнило",
  "Отдали бесплатно",
  "На пробу",
  "Себе",
  "Ошибка учета",
  "Другое"
] as const;

export const receiptSources = ["Астрахань", "Поставщик", "Купили на базаре", "Самопривоз", "Другое"] as const;

export const quickButtonDefaults = (
  [
    ["weight", [0.5, 1, 2, 3, 5, 10, 25]],
    ["amount", [100, 200, 500, 1000, 2000, 5000]],
    ["price", [50, 60, 70, 80, 100, 120]]
  ] as const
).flatMap(([type, values]) =>
  values.map((value, order) => ({
    id: makeId("qb"),
    type: type as QuickButtonType,
    value,
    label: formatQuickButtonLabel(type, value),
    order,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }))
);

export const buyerTypeLabels: Record<string, string> = {
  wholesaler: "Оптовик",
  regular: "Постоянный",
  shop: "Магазин",
  reseller: "Перекупщик",
  retail: "Розница",
  other: "Другое"
};

export const saleModeLabels = {
  by_quantity: "По количеству",
  by_amount: "По сумме",
  manual: "Ручной"
} as const;

export const paymentLabels = {
  paid: "Оплачено",
  partial: "Частично",
  debt: "В долг"
} as const;
