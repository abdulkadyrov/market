import { db } from "./db";
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
import { formatQuickButtonLabel, makeId, nowIso } from "./utils";

const timestamp = nowIso();

const productIds = {
  tomato: makeId("product"),
  pepper: makeId("product"),
  watermelon: makeId("product")
};

const buyerIds = {
  shop: makeId("buyer"),
  wholesaler: makeId("buyer")
};

const saleIds = {
  partial: makeId("sale"),
  paid: makeId("sale")
};

const defaultQuickButtons = (
  [
    ["weight", [0.5, 1, 2, 3, 5, 10, 25]],
    ["amount", [100, 200, 500, 1000, 2000, 5000]],
    ["price", [50, 60, 70, 80, 100, 120]]
  ] as const
).flatMap(([type, values]) =>
  values.map((value, order) => ({
    id: makeId("qb"),
    type,
    value,
    label: formatQuickButtonLabel(type, value),
    order,
    createdAt: timestamp,
    updatedAt: timestamp
  }))
) satisfies QuickButtonSetting[];

const products: Product[] = [
  {
    id: productIds.tomato,
    name: "Помидоры",
    category: "Овощи",
    unit: "kg",
    defaultPurchasePrice: 65,
    defaultSalePrice: 95,
    currentStock: 55,
    averageCost: 62,
    notes: "Основной ходовой товар",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.pepper,
    name: "Перец болгарский",
    category: "Овощи",
    unit: "kg",
    defaultPurchasePrice: 80,
    defaultSalePrice: 120,
    currentStock: 28,
    averageCost: 78,
    notes: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.watermelon,
    name: "Арбуз",
    category: "Фрукты",
    unit: "kg",
    defaultPurchasePrice: 18,
    defaultSalePrice: 32,
    currentStock: 140,
    averageCost: 17,
    notes: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const buyers: Buyer[] = [
  {
    id: buyerIds.shop,
    name: "Магазин Южный",
    phone: "+7 900 000-00-01",
    type: "shop",
    city: "Рынок",
    comment: "Берут перец и помидоры",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: buyerIds.wholesaler,
    name: "Карим опт",
    phone: "+7 900 000-00-02",
    type: "wholesaler",
    city: "Склад",
    comment: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const receipts: Receipt[] = [
  {
    id: makeId("receipt"),
    productId: productIds.tomato,
    date: timestamp,
    quantity: 80,
    unit: "kg",
    purchasePrice: 62,
    totalAmount: 4960,
    source: "Астрахань",
    comment: "",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: makeId("receipt"),
    productId: productIds.pepper,
    date: timestamp,
    quantity: 40,
    unit: "kg",
    purchasePrice: 78,
    totalAmount: 3120,
    source: "Поставщик",
    comment: "",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const sales: Sale[] = [
  {
    id: saleIds.partial,
    productId: productIds.tomato,
    buyerId: buyerIds.shop,
    date: timestamp,
    quantity: 12,
    salePrice: 96,
    totalAmount: 1152,
    paymentStatus: "partial",
    paidAmount: 600,
    debtAmount: 552,
    saleType: "wholesale",
    mode: "by_quantity",
    comment: "Утренний заказ",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: saleIds.paid,
    productId: productIds.watermelon,
    date: timestamp,
    quantity: 15,
    salePrice: 35,
    totalAmount: 525,
    paymentStatus: "paid",
    paidAmount: 525,
    debtAmount: 0,
    saleType: "retail",
    mode: "by_quantity",
    comment: "",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const expenses: Expense[] = [
  {
    id: makeId("expense"),
    date: timestamp,
    category: "fuel",
    amount: 1800,
    comment: "Заправка утром",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: makeId("expense"),
    date: timestamp,
    category: "market_place",
    amount: 500,
    comment: "Место на базаре",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const writeOffs: WriteOff[] = [
  {
    id: makeId("writeoff"),
    productId: productIds.pepper,
    date: timestamp,
    quantity: 2,
    reason: "Помялось",
    comment: "",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const stockAdjustments: StockAdjustment[] = [
  {
    id: makeId("adjustment"),
    productId: productIds.watermelon,
    date: timestamp,
    previousStock: 145,
    actualStock: 140,
    reason: "Пересчет вечером",
    comment: "",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const debtPayments: DebtPayment[] = [
  {
    id: makeId("debt"),
    saleId: saleIds.partial,
    buyerId: buyerIds.shop,
    date: timestamp,
    totalAmount: 1152,
    paidAmount: 600,
    remainingAmount: 552,
    status: "active",
    comment: "Оплата частично",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const appSettings: AppSettings[] = [
  {
    id: "main",
    currency: "RUB",
    theme: "light",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const operationLogs: OperationLog[] = [
  ...receipts.map((receipt) => ({
    id: makeId("op"),
    type: "receipt" as const,
    entityId: receipt.id,
    productId: receipt.productId,
    date: receipt.date,
    quantity: receipt.quantity,
    price: receipt.purchasePrice,
    amount: receipt.totalAmount,
    comment: receipt.comment
  })),
  ...sales.map((sale) => ({
    id: makeId("op"),
    type: "sale" as const,
    entityId: sale.id,
    productId: sale.productId,
    buyerId: sale.buyerId,
    date: sale.date,
    quantity: sale.quantity,
    price: sale.salePrice,
    amount: sale.totalAmount,
    comment: sale.comment
  })),
  ...expenses.map((expense) => ({
    id: makeId("op"),
    type: "expense" as const,
    entityId: expense.id,
    date: expense.date,
    amount: expense.amount,
    comment: expense.comment
  })),
  ...writeOffs.map((item) => ({
    id: makeId("op"),
    type: "writeOff" as const,
    entityId: item.id,
    productId: item.productId,
    date: item.date,
    quantity: item.quantity,
    comment: item.reason
  })),
  ...stockAdjustments.map((item) => ({
    id: makeId("op"),
    type: "adjustment" as const,
    entityId: item.id,
    productId: item.productId,
    date: item.date,
    quantity: item.actualStock,
    comment: item.reason,
    meta: JSON.stringify({
      previousStock: item.previousStock,
      actualStock: item.actualStock
    })
  }))
];

export const seedDatabase = async () => {
  const productsCount = await db.products.count();
  if (productsCount > 0) {
    return;
  }

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
      await db.products.bulkAdd(products);
      await db.receipts.bulkAdd(receipts);
      await db.sales.bulkAdd(sales);
      await db.buyers.bulkAdd(buyers);
      await db.expenses.bulkAdd(expenses);
      await db.writeOffs.bulkAdd(writeOffs);
      await db.stockAdjustments.bulkAdd(stockAdjustments);
      await db.debtPayments.bulkAdd(debtPayments);
      await db.quickButtonSettings.bulkAdd(defaultQuickButtons);
      await db.appSettings.bulkAdd(appSettings);
      await db.operationLogs.bulkAdd(operationLogs);
    }
  );
};
