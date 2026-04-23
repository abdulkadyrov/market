import { db } from "./db";
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
import { nowIso } from "./utils";

const timestamp = nowIso();

const stockGroupId = "group_bolgarka";
const productIds = {
  pepperRed: "product_pepper_red",
  pepperGreen: "product_pepper_green",
  pepperMix: "product_pepper_mix",
  tomato: "product_tomato",
  cucumber: "product_cucumber"
};

const stockGroups: StockGroup[] = [
  {
    id: stockGroupId,
    name: "Болгарка общая партия",
    unit: "kg",
    currentStock: 89.31,
    averageCost: 40,
    notes: "Один общий остаток для красного, зеленого и смешанного перца",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const products: Product[] = [
  {
    id: productIds.pepperRed,
    name: "Болгарка",
    variant: "красный",
    category: "Овощи",
    unit: "kg",
    stockGroupId,
    currentStock: 0,
    averageCost: 40,
    defaultSalePrice: 80,
    notes: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.pepperGreen,
    name: "Болгарка",
    variant: "зеленый",
    category: "Овощи",
    unit: "kg",
    stockGroupId,
    currentStock: 0,
    averageCost: 40,
    defaultSalePrice: 60,
    notes: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.pepperMix,
    name: "Болгарка",
    variant: "смешанный",
    category: "Овощи",
    unit: "kg",
    stockGroupId,
    currentStock: 0,
    averageCost: 40,
    defaultSalePrice: 65,
    notes: "Самая ходовая позиция",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.tomato,
    name: "Помидор",
    variant: "",
    category: "Овощи",
    unit: "kg",
    currentStock: 46.2,
    averageCost: 42,
    defaultSalePrice: 70,
    notes: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.cucumber,
    name: "Огурец",
    variant: "",
    category: "Овощи",
    unit: "kg",
    currentStock: 28.5,
    averageCost: 31,
    defaultSalePrice: 55,
    notes: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const receipts: Receipt[] = [
  {
    id: "receipt_group_main",
    stockGroupId,
    date: timestamp,
    quantity: 100,
    purchasePrice: 40,
    totalAmount: 4000,
    source: "Астрахань",
    comment: "Стартовая общая партия",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "receipt_tomato",
    productId: productIds.tomato,
    date: timestamp,
    quantity: 60,
    purchasePrice: 42,
    totalAmount: 2520,
    source: "Фермер",
    comment: "",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "receipt_cucumber",
    productId: productIds.cucumber,
    date: timestamp,
    quantity: 35,
    purchasePrice: 31,
    totalAmount: 1085,
    source: "База",
    comment: "",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const sales: Sale[] = [
  {
    id: "sale_pepper_mix",
    productId: productIds.pepperMix,
    stockGroupId,
    date: timestamp,
    quantity: 7.69,
    salePrice: 65,
    totalAmount: 500,
    originalTotalAmount: 500,
    finalTotalAmount: 500,
    mode: "by_amount",
    activeBaseField: "totalAmount",
    costOfGoodsSold: 307.6,
    comment: "На 500 рублей",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "sale_pepper_red",
    productId: productIds.pepperRed,
    stockGroupId,
    date: timestamp,
    quantity: 2,
    salePrice: 80,
    totalAmount: 160,
    originalTotalAmount: 160,
    discountType: "amount",
    discountValue: 10,
    discountAmount: 10,
    finalTotalAmount: 150,
    receivedAmount: 200,
    changeAmount: 50,
    mode: "by_weight",
    activeBaseField: "quantity",
    costOfGoodsSold: 80,
    comment: "Постоянный покупатель",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "sale_tomato",
    productId: productIds.tomato,
    date: timestamp,
    quantity: 12,
    salePrice: 70,
    totalAmount: 840,
    originalTotalAmount: 840,
    finalTotalAmount: 840,
    mode: "by_weight",
    activeBaseField: "quantity",
    costOfGoodsSold: 504,
    comment: "",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const expenses: Expense[] = [
  {
    id: "expense_market_fee",
    date: timestamp,
    category: "Место",
    amount: 700,
    comment: "Дневная аренда",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "expense_fuel",
    date: timestamp,
    category: "Транспорт",
    amount: 950,
    comment: "Доставка товара",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const writeOffs: WriteOff[] = [
  {
    id: "writeoff_cucumber",
    productId: productIds.cucumber,
    date: timestamp,
    quantity: 1.5,
    reason: "Порча",
    comment: "Подвяли",
    costAmount: 46.5,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "writeoff_group",
    stockGroupId,
    date: timestamp,
    quantity: 1,
    reason: "Брак",
    comment: "",
    costAmount: 40,
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const quickButtonsSeed: Array<[QuickButtonSetting["type"], number, string]> = [
  ["weight", 1, "1 кг"],
  ["weight", 3, "3 кг"],
  ["amount", 200, "200 ₽"],
  ["amount", 500, "500 ₽"],
  ["discount", 20, "-20 ₽"],
  ["round", 500, "До 500"]
];

const quickButtons: QuickButtonSetting[] = quickButtonsSeed.map(([type, value, label], index) => ({
  id: `quick_${index}`,
  type,
  value,
  label,
  order: index,
  createdAt: timestamp,
  updatedAt: timestamp
}));

const appSettings: AppSettings[] = [
  {
    id: "main",
    theme: "light",
    weightPrecision: 2,
    currencySymbol: "₽",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

export const seedDatabase = async () => {
  const existing = await db.products.count();

  if (existing > 0) {
    return;
  }

  await db.stockGroups.bulkAdd(stockGroups);
  await db.products.bulkAdd(products);
  await db.receipts.bulkAdd(receipts);
  await db.sales.bulkAdd(sales);
  await db.expenses.bulkAdd(expenses);
  await db.writeOffs.bulkAdd(writeOffs);
  await db.quickButtonSettings.bulkAdd(quickButtons);
  await db.appSettings.bulkAdd(appSettings);
};
