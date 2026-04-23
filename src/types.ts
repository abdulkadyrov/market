export type Unit = "kg" | "piece" | "box" | "bag" | "net" | "other";

export type SaleMode = "by_weight" | "by_amount";
export type BaseField = "quantity" | "totalAmount";
export type DiscountType = "amount" | "percent";
export type HistoryEntity = "sale" | "receipt" | "expense" | "writeOff";
export type ThemeMode = "light" | "contrast";

export interface StockGroup {
  id: string;
  name: string;
  unit: Unit;
  currentStock: number;
  averageCost: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  variant: string;
  category: string;
  unit: Unit;
  stockGroupId?: string;
  currentStock: number;
  averageCost: number;
  defaultSalePrice: number;
  notes: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  stockGroupId?: string;
  productId?: string;
  date: string;
  quantity: number;
  purchasePrice: number;
  totalAmount: number;
  source: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  productId: string;
  stockGroupId?: string;
  date: string;
  quantity: number;
  salePrice: number;
  totalAmount: number;
  originalTotalAmount: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  finalTotalAmount: number;
  receivedAmount?: number;
  changeAmount?: number;
  mode: SaleMode;
  activeBaseField: BaseField;
  costOfGoodsSold: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface WriteOff {
  id: string;
  stockGroupId?: string;
  productId?: string;
  date: string;
  quantity: number;
  reason: string;
  comment: string;
  costAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuickButtonSetting {
  id: string;
  type: "weight" | "amount" | "discount" | "round";
  value: number;
  label: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  id: string;
  theme: ThemeMode;
  weightPrecision: number;
  currencySymbol: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSnapshot {
  stockGroups: StockGroup[];
  products: Product[];
  receipts: Receipt[];
  sales: Sale[];
  expenses: Expense[];
  writeOffs: WriteOff[];
  quickButtonSettings: QuickButtonSetting[];
  appSettings: AppSettings[];
}

export interface ProductView extends Product {
  displayName: string;
  sharedStockName?: string;
  availableStock: number;
  averageCost: number;
}
