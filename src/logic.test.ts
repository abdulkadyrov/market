import { describe, expect, it } from "vitest";
import { applyDiscount, createEmptySaleEditor, editTotal, editWeight, setReceivedAmount } from "./logic";
import type { ProductView } from "./types";

const product: ProductView = {
  id: "product_tomato",
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
  it("считает сумму по введенному весу", () => {
    const result = editWeight(createEmptySaleEditor(product), 2.35, 2);

    expect(result.mode).toBe("by_weight");
    expect(result.quantity).toBe(2.35);
    expect(result.totalAmount).toBe(423);
    expect(result.finalTotalAmount).toBe(423);
  });

  it("считает вес по введенной сумме", () => {
    const result = editTotal(createEmptySaleEditor(product), 420, 2);

    expect(result.mode).toBe("by_amount");
    expect(result.totalAmount).toBe(420);
    expect(result.quantity).toBe(2.33);
  });

  it("применяет скидку и считает сдачу", () => {
    const initial = editTotal(createEmptySaleEditor(product), 420, 2);
    const discounted = applyDiscount(initial, "amount", 20, 2);
    const paid = setReceivedAmount(discounted, 500, 2);

    expect(paid.finalTotalAmount).toBe(400);
    expect(paid.receivedAmount).toBe(500);
    expect(paid.changeAmount).toBe(100);
  });
});
