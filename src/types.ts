export type Unit = "kg" | "piece" | "box" | "bag" | "net" | "other";
export type PaymentStatus = "paid" | "partial" | "debt";
export type SaleType = "retail" | "wholesale";
export type SaleMode = "by_quantity" | "by_amount" | "manual";
export type BuyerType = "wholesaler" | "regular" | "shop" | "reseller" | "retail" | "other";
export type QuickButtonType = "weight" | "amount" | "price";
export type ThemeMode = "light" | "dark" | "system";
export type OperationType = "receipt" | "sale" | "expense" | "writeOff" | "adjustment" | "debtPayment";

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: Unit;
  defaultPurchasePrice: number;
  defaultSalePrice: number;
  currentStock: number;
  averageCost: number;
  notes: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  productId: string;
  date: string;
  quantity: number;
  unit: Unit;
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
  buyerId?: string;
  date: string;
  quantity: number;
  salePrice: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  debtAmount: number;
  saleType: SaleType;
  mode: SaleMode;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface Buyer {
  id: string;
  name: string;
  phone: string;
  type: BuyerType;
  city: string;
  comment: string;
  isArchived: boolean;
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
  productId: string;
  date: string;
  quantity: number;
  reason: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  date: string;
  previousStock: number;
  actualStock: number;
  reason: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtPayment {
  id: string;
  saleId: string;
  buyerId: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "active" | "closed";
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickButtonSetting {
  id: string;
  type: QuickButtonType;
  value: number;
  label: string;
  order: number;
  productId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  id: string;
  currency: string;
  theme: ThemeMode;
  createdAt: string;
  updatedAt: string;
}

export interface OperationLog {
  id: string;
  type: OperationType;
  entityId: string;
  productId?: string;
  buyerId?: string;
  date: string;
  quantity?: number;
  price?: number;
  amount?: number;
  comment?: string;
  meta?: string;
}

export interface AppSnapshot {
  products: Product[];
  receipts: Receipt[];
  sales: Sale[];
  buyers: Buyer[];
  expenses: Expense[];
  writeOffs: WriteOff[];
  stockAdjustments: StockAdjustment[];
  debtPayments: DebtPayment[];
  quickButtonSettings: QuickButtonSetting[];
  appSettings: AppSettings[];
  operationLogs: OperationLog[];
}

export interface ProductAnalytics {
  stockCost: number;
  potentialRevenue: number;
  potentialProfit: number;
}
