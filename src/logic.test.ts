import { describe, expect, it } from "vitest";
import {
  applyDiscount,
  calculatePriceDiscount,
  calculateWriteOffQuantity,
  createEmptySaleEditor,
  editActualTotal,
  editPieceAmount,
  editTotal,
  editWeight,
  setReceivedAmount
} from "./logic";
import type { ProductView } from "./types";

const product: ProductView = {
  id: "product_tomato",
  profileId: "profile_test",
  name: "Помидоры",
  variant: "",
  displayName: "Помидоры",
  category: "Овощи",
  unit: "kg",
  currentStock: 25,
  availableStock: 25,
  averageCost: 90,
  defaultSalePrice: 180,
  notes: "",
  isArchived: false,
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z"
};

describe("расчет продажи", () => {
  it("помечает снижение ручной цены как скидку по цене", () => {
    expect(calculatePriceDiscount(55, 50, 2)).toBe(10);
    expect(calculatePriceDiscount(55, 60, 2)).toBe(0);
  });

  it("считает сумму по введенному весу", () => {
    const result = editWeight(createEmptySaleEditor(product), 2.35, 2);

    expect(result.mode).toBe("by_weight");
    expect(result.requestedQuantity).toBe(2.35);
    expect(result.requestedAmount).toBe(423);
    expect(result.differenceAmount).toBe(0);
    expect(result.quantity).toBe(2.35);
    expect(result.totalAmount).toBe(423);
    expect(result.finalTotalAmount).toBe(423);
  });

  it("считает вес по введенной сумме", () => {
    const result = editTotal(createEmptySaleEditor(product), 420, 2);

    expect(result.mode).toBe("by_amount");
    expect(result.requestedAmount).toBe(420);
    expect(result.differenceAmount).toBe(0);
    expect(result.totalAmount).toBe(420);
    expect(result.quantity).toBe(2.33);
  });

  it("применяет скидку и считает сдачу", () => {
    const initial = editActualTotal(editTotal(createEmptySaleEditor(product), 420, 2), 440, 2);
    const discounted = applyDiscount(initial, "amount", 20, 2);
    const paid = setReceivedAmount(discounted, 500, 2);

    expect(paid.finalTotalAmount).toBe(420);
    expect(paid.differenceAmount).toBe(0);
    expect(paid.receivedAmount).toBe(500);
    expect(paid.changeAmount).toBe(80);
  });

  it("сохраняет запрос 300 ₽ отдельно от фактических 305 ₽", () => {
    const pepper = { ...product, defaultSalePrice: 60 };
    const requested = editTotal(createEmptySaleEditor(pepper), 300, 2);
    const actual = editActualTotal(requested, 305, 2);

    expect(actual.requestedAmount).toBe(300);
    expect(actual.finalTotalAmount).toBe(305);
    expect(actual.differenceAmount).toBe(5);
    expect(actual.quantity).toBe(5.08);
  });

  it("сохраняет запрос 5 кг и фактический итог выше запроса", () => {
    const pepper = { ...product, defaultSalePrice: 60 };
    const requested = editWeight(createEmptySaleEditor(pepper), 5, 2);
    const actual = editActualTotal(requested, 307, 2);

    expect(actual.requestedQuantity).toBe(5);
    expect(actual.requestedAmount).toBe(300);
    expect(actual.finalTotalAmount).toBe(307);
    expect(actual.differenceAmount).toBe(7);
    expect(actual.quantity).toBe(5.12);
  });

  it("округляет штучный товар вверх до целого количества", () => {
    const watermelon = { ...product, unit: "piece" as const, defaultSalePrice: 90 };
    const result = editPieceAmount(createEmptySaleEditor(watermelon), 300, 2);

    expect(result.mode).toBe("by_amount");
    expect(result.requestedAmount).toBe(300);
    expect(result.quantity).toBe(4);
    expect(result.finalTotalAmount).toBe(360);
    expect(result.differenceAmount).toBe(60);
  });
});

describe("расчет порчи", () => {
  it("считает общий вес по мешкам", () => {
    expect(calculateWriteOffQuantity("packages", 0, 7, 18, 2)).toBe(126);
  });

  it("сохраняет точный вес для небольшой порчи", () => {
    expect(calculateWriteOffQuantity("weight", 1.53, 0, 0, 2)).toBe(1.53);
  });
});
