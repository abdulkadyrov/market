import Dexie, { type Table } from "dexie";
import type {
  AppSettings,
  Expense,
  Product,
  QuickButtonSetting,
  Receipt,
  Sale,
  StockGroup,
  WriteOff
} from "./types";

export class MarketDatabase extends Dexie {
  stockGroups!: Table<StockGroup, string>;
  products!: Table<Product, string>;
  receipts!: Table<Receipt, string>;
  sales!: Table<Sale, string>;
  expenses!: Table<Expense, string>;
  writeOffs!: Table<WriteOff, string>;
  quickButtonSettings!: Table<QuickButtonSetting, string>;
  appSettings!: Table<AppSettings, string>;

  constructor() {
    super("market-bazaar-pwa-db");

    this.version(1).stores({
      stockGroups: "id, name, updatedAt",
      products: "id, name, variant, stockGroupId, isArchived, updatedAt",
      receipts: "id, stockGroupId, productId, date, updatedAt",
      sales: "id, productId, stockGroupId, date, updatedAt",
      expenses: "id, date, category, updatedAt",
      writeOffs: "id, stockGroupId, productId, date, updatedAt",
      quickButtonSettings: "id, type, order",
      appSettings: "id, updatedAt"
    });
  }
}

export const db = new MarketDatabase();
