import { db } from "../db";
import type { AppSnapshot } from "../types";
import { parseSnapshot } from "./snapshotValidation";

export const exportSnapshot = async (): Promise<AppSnapshot> => ({
  schemaVersion: 3,
  exportedAt: new Date().toISOString(),
  storeProfiles: await db.storeProfiles.toArray(),
  stockGroups: await db.stockGroups.toArray(),
  products: await db.products.toArray(),
  receipts: await db.receipts.toArray(),
  sales: await db.sales.toArray(),
  expenses: await db.expenses.toArray(),
  writeOffs: await db.writeOffs.toArray(),
  quickButtonSettings: await db.quickButtonSettings.toArray(),
  appSettings: await db.appSettings.toArray()
});

export const importSnapshot = async (input: unknown) => {
  const snapshot = parseSnapshot(input);

  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.storeProfiles.bulkPut(snapshot.storeProfiles);
    await db.stockGroups.bulkPut(snapshot.stockGroups);
    await db.products.bulkPut(snapshot.products);
    await db.receipts.bulkPut(snapshot.receipts);
    await db.sales.bulkPut(snapshot.sales);
    await db.expenses.bulkPut(snapshot.expenses);
    await db.writeOffs.bulkPut(snapshot.writeOffs);
    await db.quickButtonSettings.bulkPut(snapshot.quickButtonSettings);
    await db.appSettings.bulkPut(snapshot.appSettings);
  });
};
