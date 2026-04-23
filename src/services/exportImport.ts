import { db } from "../db";
import type { AppSnapshot } from "../types";

export const exportSnapshot = async (): Promise<AppSnapshot> => ({
  stockGroups: await db.stockGroups.toArray(),
  products: await db.products.toArray(),
  receipts: await db.receipts.toArray(),
  sales: await db.sales.toArray(),
  expenses: await db.expenses.toArray(),
  writeOffs: await db.writeOffs.toArray(),
  quickButtonSettings: await db.quickButtonSettings.toArray(),
  appSettings: await db.appSettings.toArray()
});

export const importSnapshot = async (snapshot: AppSnapshot) => {
  await db.stockGroups.clear();
  await db.products.clear();
  await db.receipts.clear();
  await db.sales.clear();
  await db.expenses.clear();
  await db.writeOffs.clear();
  await db.quickButtonSettings.clear();
  await db.appSettings.clear();

  await db.stockGroups.bulkPut(snapshot.stockGroups);
  await db.products.bulkPut(snapshot.products);
  await db.receipts.bulkPut(snapshot.receipts);
  await db.sales.bulkPut(snapshot.sales);
  await db.expenses.bulkPut(snapshot.expenses);
  await db.writeOffs.bulkPut(snapshot.writeOffs);
  await db.quickButtonSettings.bulkPut(snapshot.quickButtonSettings);
  await db.appSettings.bulkPut(snapshot.appSettings);
};
