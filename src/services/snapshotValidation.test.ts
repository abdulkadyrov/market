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
  it("принимает старый снимок без метаданных и добавляет актуальную версию", () => {
    const result = parseSnapshot(emptySnapshot());

    expect(result.schemaVersion).toBe(4);
    expect(result.bazaarLocations).toHaveLength(1);
    expect(result.storeProfiles).toHaveLength(1);
    expect(result.appSettings).toHaveLength(0);
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

  it("не разрешает операции ссылаться на товар другого профиля", () => {
    const timestamp = "2026-08-22T00:00:00.000Z";
    const snapshot = {
      ...emptySnapshot(),
      schemaVersion: 3,
      exportedAt: timestamp,
      storeProfiles: ["profile_1", "profile_2"].map((id, index) => ({
        id,
        name: `Газель №${index + 1}`,
        city: "Махачкала",
        marketName: "Базар",
        pointName: "",
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp
      }))
    };
    snapshot.products = [
      {
        id: "product_1",
        profileId: "profile_1",
        name: "Арбуз",
        variant: "",
        category: "Фрукты",
        unit: "piece",
        currentStock: 20,
        averageCost: 60,
        defaultSalePrice: 90,
        notes: "",
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];
    snapshot.receipts = [
      {
        id: "receipt_1",
        profileId: "profile_2",
        productId: "product_1",
        date: timestamp,
        quantity: 5,
        purchasePrice: 60,
        totalAmount: 300,
        source: "",
        comment: "",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];

    expect(() => parseSnapshot(snapshot)).toThrow("товар принадлежит другому профилю");
  });
});
