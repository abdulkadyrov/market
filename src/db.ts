import Dexie, { type Table } from "dexie";
import type {
  AppSettings,
  Buyer,
  DebtPayment,
  Expense,
  OperationLog,
  Product,
  QuickButtonSetting,
  Receipt,
  Sale,
  StockAdjustment,
  WriteOff
} from "./types";

export class MarketDatabase extends Dexie {
  products!: Table<Product, string>;
  receipts!: Table<Receipt, string>;
  sales!: Table<Sale, string>;
  buyers!: Table<Buyer, string>;
  expenses!: Table<Expense, string>;
  writeOffs!: Table<WriteOff, string>;
  stockAdjustments!: Table<StockAdjustment, string>;
  debtPayments!: Table<DebtPayment, string>;
  quickButtonSettings!: Table<QuickButtonSetting, string>;
  appSettings!: Table<AppSettings, string>;
  operationLogs!: Table<OperationLog, string>;

  constructor() {
    super("market-bazaar-db");

    this.version(1).stores({
      products: "id, name, category, isArchived, updatedAt",
      receipts: "id, productId, date, updatedAt",
      sales: "id, productId, buyerId, paymentStatus, saleType, date",
      buyers: "id, name, type, isArchived, updatedAt",
      expenses: "id, date, category",
      writeOffs: "id, productId, date",
      stockAdjustments: "id, productId, date",
      debtPayments: "id, saleId, buyerId, status, date, updatedAt",
      quickButtonSettings: "id, type, order, productId",
      appSettings: "id, updatedAt",
      operationLogs: "id, type, date, productId, buyerId"
    });
  }
}

export const db = new MarketDatabase();
