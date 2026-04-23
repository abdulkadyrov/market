import { db } from "../db";
import type { AppSnapshot } from "../types";
import { downloadBlob, nowIso } from "../utils";

export const exportSnapshot = async () => {
  const snapshot: AppSnapshot = {
    products: await db.products.toArray(),
    receipts: await db.receipts.toArray(),
    sales: await db.sales.toArray(),
    buyers: await db.buyers.toArray(),
    expenses: await db.expenses.toArray(),
    writeOffs: await db.writeOffs.toArray(),
    stockAdjustments: await db.stockAdjustments.toArray(),
    debtPayments: await db.debtPayments.toArray(),
    quickButtonSettings: await db.quickButtonSettings.toArray(),
    appSettings: await db.appSettings.toArray(),
    operationLogs: await db.operationLogs.toArray()
  };

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json"
  });

  downloadBlob(`market-backup-${nowIso().slice(0, 10)}.json`, blob);
};

export const exportProductsCsv = async () => {
  const products = await db.products.toArray();
  const header = ["name", "category", "unit", "currentStock", "averageCost", "salePrice"];
  const rows = products.map((item) =>
    [item.name, item.category, item.unit, item.currentStock, item.averageCost, item.defaultSalePrice].join(",")
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8"
  });
  downloadBlob(`market-products-${nowIso().slice(0, 10)}.csv`, blob);
};

export const importSnapshot = async (file: File) => {
  const text = await file.text();
  const snapshot = JSON.parse(text) as AppSnapshot;

  await db.transaction(
    "rw",
    [
      db.products,
      db.receipts,
      db.sales,
      db.buyers,
      db.expenses,
      db.writeOffs,
      db.stockAdjustments,
      db.debtPayments,
      db.quickButtonSettings,
      db.appSettings,
      db.operationLogs
    ],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.receipts.clear(),
        db.sales.clear(),
        db.buyers.clear(),
        db.expenses.clear(),
        db.writeOffs.clear(),
        db.stockAdjustments.clear(),
        db.debtPayments.clear(),
        db.quickButtonSettings.clear(),
        db.appSettings.clear(),
        db.operationLogs.clear()
      ]);

      await db.products.bulkPut(snapshot.products ?? []);
      await db.receipts.bulkPut(snapshot.receipts ?? []);
      await db.sales.bulkPut(snapshot.sales ?? []);
      await db.buyers.bulkPut(snapshot.buyers ?? []);
      await db.expenses.bulkPut(snapshot.expenses ?? []);
      await db.writeOffs.bulkPut(snapshot.writeOffs ?? []);
      await db.stockAdjustments.bulkPut(snapshot.stockAdjustments ?? []);
      await db.debtPayments.bulkPut(snapshot.debtPayments ?? []);
      await db.quickButtonSettings.bulkPut(snapshot.quickButtonSettings ?? []);
      await db.appSettings.bulkPut(snapshot.appSettings ?? []);
      await db.operationLogs.bulkPut(snapshot.operationLogs ?? []);
    }
  );
};
