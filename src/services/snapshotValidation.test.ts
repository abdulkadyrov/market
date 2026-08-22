import { describe, expect, it } from "vitest";
import { parseSnapshot } from "./snapshotValidation";

const emptySnapshot = () => ({
  stockGroups: [] as Array<Record<string, unknown>>,
  products: [] as Array<Record<string, unknown>>,
  receipts: [] as Array<Record<string, unknown>>,
  sales: [] as Array<Record<string, unknown>>,
  expenses: [] as Array<Record<string, unknown>>,
  writeOffs: [] as Array<Record<string, unknown>>,
  quickButtonSettings: [] as Array<Record<string, unknown>>,
  appSettings: [] as Array<Record<string, unknown>>
});

describe("проверка импортируемого снимка", () => {
  it("принимает старый снимок без метаданных и добавляет версию", () => {
    const result = parseSnapshot(emptySnapshot());

    expect(result.schemaVersion).toBe(1);
    expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("отклоняет файл без обязательной таблицы", () => {
    const snapshot = emptySnapshot();
    delete (snapshot as Partial<typeof snapshot>).sales;

    expect(() => parseSnapshot(snapshot)).toThrow("sales — ожидался массив");
  });

  it("отклоняет повторяющиеся идентификаторы", () => {
    const snapshot = emptySnapshot();
    snapshot.stockGroups = [
      {
        id: "group_1",
        name: "Партия",
        unit: "kg",
        currentStock: 10,
        averageCost: 20,
        notes: "",
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T00:00:00.000Z"
      },
      {
        id: "group_1",
        name: "Дубль",
        unit: "kg",
        currentStock: 5,
        averageCost: 21,
        notes: "",
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T00:00:00.000Z"
      }
    ];

    expect(() => parseSnapshot(snapshot)).toThrow("повторяющийся id");
  });

  it("отклоняет товар со ссылкой на отсутствующую партию", () => {
    const snapshot = emptySnapshot();
    snapshot.products = [
      {
        id: "product_1",
        name: "Помидоры",
        variant: "",
        category: "Овощи",
        unit: "kg",
        stockGroupId: "missing_group",
        currentStock: 0,
        averageCost: 0,
        defaultSalePrice: 180,
        notes: "",
        isArchived: false,
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T00:00:00.000Z"
      }
    ];

    expect(() => parseSnapshot(snapshot)).toThrow("партия не найдена");
  });
});
