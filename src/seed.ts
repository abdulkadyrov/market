import { db } from "./db";
import type {
  AppSettings,
  BazaarLocation,
  Expense,
  Product,
  QuickButtonSetting,
  Receipt,
  Sale,
  StoreProfile,
  StockGroup,
  WriteOff
} from "./types";
import { nowIso } from "./utils";
import {
  createDefaultBazaarLocations,
  createDefaultProfiles,
  DEFAULT_PROFILE_ID,
  FARMER_PROFILE_ID,
  SECOND_PROFILE_ID
} from "./profiles";

const initializedKey = "market-db-initialized";
const demoRequestedKey = "market-db-demo-requested";

const timestamp = nowIso();
const secondProfileId = SECOND_PROFILE_ID;
const bazaarLocations: BazaarLocation[] = createDefaultBazaarLocations(timestamp);

const storeProfiles: StoreProfile[] = createDefaultProfiles(timestamp);

const stockGroupId = "group_bolgarka";
const productIds = {
  pepperRed: "product_pepper_red",
  pepperGreen: "product_pepper_green",
  pepperMix: "product_pepper_mix",
  tomato: "product_tomato",
  cucumber: "product_cucumber",
  watermelonPiece: "product_watermelon_piece",
  cucumberSecond: "product_cucumber_gazelle_2",
  tomatoSecond: "product_tomato_gazelle_2",
  cucumberFarmer: "product_cucumber_farmer",
  tomatoFarmer: "product_tomato_farmer"
};

const stockGroups: StockGroup[] = [
  {
    id: stockGroupId,
    profileId: DEFAULT_PROFILE_ID,
    name: "Болгарка общая партия",
    unit: "kg",
    currentStock: 91.92,
    averageCost: 40,
    notes: "Один общий остаток для красного, зеленого и смешанного перца",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const products: Product[] = [
  {
    id: productIds.pepperRed,
    profileId: DEFAULT_PROFILE_ID,
    name: "Болгарка",
    variant: "красный",
    category: "Овощи",
    unit: "kg",
    stockGroupId,
    currentStock: 0,
    isUnlimitedStock: false,
    averageCost: 40,
    defaultSalePrice: 80,
    notes: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.pepperGreen,
    profileId: DEFAULT_PROFILE_ID,
    name: "Болгарка",
    variant: "зеленый",
    category: "Овощи",
    unit: "kg",
    stockGroupId,
    currentStock: 0,
    isUnlimitedStock: false,
    averageCost: 40,
    defaultSalePrice: 60,
    notes: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.pepperMix,
    profileId: DEFAULT_PROFILE_ID,
    name: "Болгарка",
    variant: "смешанный",
    category: "Овощи",
    unit: "kg",
    stockGroupId,
    currentStock: 0,
    isUnlimitedStock: false,
    averageCost: 40,
    defaultSalePrice: 65,
    notes: "Самая ходовая позиция",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.tomato,
    profileId: DEFAULT_PROFILE_ID,
    name: "Помидор",
    variant: "",
    category: "Овощи",
    unit: "kg",
    currentStock: 46.2,
    isUnlimitedStock: false,
    averageCost: 42,
    defaultSalePrice: 70,
    notes: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.cucumber,
    profileId: DEFAULT_PROFILE_ID,
    name: "Огурец",
    variant: "",
    category: "Овощи",
    unit: "kg",
    currentStock: 28.5,
    isUnlimitedStock: false,
    averageCost: 31,
    defaultSalePrice: 55,
    notes: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.cucumberSecond,
    profileId: secondProfileId,
    name: "Огурец",
    variant: "",
    category: "Овощи",
    unit: "kg",
    currentStock: 40,
    isUnlimitedStock: false,
    averageCost: 35,
    defaultSalePrice: 65,
    notes: "Закупка для второй газели",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.watermelonPiece,
    profileId: DEFAULT_PROFILE_ID,
    name: "Арбуз",
    variant: "штучный",
    category: "Фрукты",
    unit: "piece",
    currentStock: 20,
    isUnlimitedStock: false,
    averageCost: 60,
    defaultSalePrice: 90,
    notes: "Продажа целыми штуками",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.tomatoSecond,
    profileId: secondProfileId,
    name: "Помидор",
    variant: "розовый",
    category: "Овощи",
    unit: "kg",
    currentStock: 25,
    isUnlimitedStock: false,
    averageCost: 50,
    defaultSalePrice: 85,
    notes: "Отдельная цена второй точки",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.cucumberFarmer,
    profileId: FARMER_PROFILE_ID,
    name: "Огурец",
    variant: "фермерский",
    category: "Овощи",
    unit: "kg",
    currentStock: 55,
    isUnlimitedStock: false,
    averageCost: 38,
    defaultSalePrice: 70,
    notes: "Фермерская партия",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: productIds.tomatoFarmer,
    profileId: FARMER_PROFILE_ID,
    name: "Помидор",
    variant: "фермерский",
    category: "Овощи",
    unit: "kg",
    currentStock: 48,
    isUnlimitedStock: false,
    averageCost: 52,
    defaultSalePrice: 90,
    notes: "Фермерская партия",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const receipts: Receipt[] = [
  {
    id: "receipt_group_main",
    profileId: DEFAULT_PROFILE_ID,
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
    profileId: DEFAULT_PROFILE_ID,
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
    profileId: DEFAULT_PROFILE_ID,
    productId: productIds.cucumber,
    date: timestamp,
    quantity: 35,
    purchasePrice: 31,
    totalAmount: 1085,
    source: "База",
    comment: "",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "receipt_cucumber_gazelle_2",
    profileId: secondProfileId,
    productId: productIds.cucumberSecond,
    date: timestamp,
    quantity: 40,
    purchasePrice: 35,
    totalAmount: 1400,
    source: "Оптовая база",
    comment: "Закупка второй газели",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "receipt_watermelon_piece",
    profileId: DEFAULT_PROFILE_ID,
    productId: productIds.watermelonPiece,
    date: timestamp,
    quantity: 20,
    purchasePrice: 60,
    totalAmount: 1200,
    source: "Оптовая база",
    comment: "Штучный товар",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "receipt_tomato_gazelle_2",
    profileId: secondProfileId,
    productId: productIds.tomatoSecond,
    date: timestamp,
    quantity: 25,
    purchasePrice: 50,
    totalAmount: 1250,
    source: "Фермер",
    comment: "Закупка второй газели",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const sales: Sale[] = [
  {
    id: "sale_pepper_mix",
    profileId: DEFAULT_PROFILE_ID,
    productId: productIds.pepperGreen,
    stockGroupId,
    date: timestamp,
    requestedAmount: 300,
    differenceAmount: 5,
    quantity: 5.08,
    salePrice: 60,
    totalAmount: 305,
    originalTotalAmount: 305,
    finalTotalAmount: 305,
    mode: "by_amount",
    activeBaseField: "totalAmount",
    costOfGoodsSold: 203.2,
    comment: "Клиент просил на 300 ₽, фактически получилось 305 ₽",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "sale_pepper_red",
    profileId: DEFAULT_PROFILE_ID,
    productId: productIds.pepperRed,
    stockGroupId,
    date: timestamp,
    requestedQuantity: 2,
    requestedAmount: 160,
    differenceAmount: 0,
    quantity: 2,
    salePrice: 80,
    totalAmount: 160,
    originalTotalAmount: 160,
    finalTotalAmount: 160,
    receivedAmount: 200,
    changeAmount: 40,
    mode: "by_weight",
    activeBaseField: "quantity",
    costOfGoodsSold: 80,
    comment: "Постоянный покупатель",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "sale_tomato",
    profileId: DEFAULT_PROFILE_ID,
    productId: productIds.tomato,
    date: timestamp,
    requestedQuantity: 12,
    requestedAmount: 840,
    differenceAmount: 0,
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
    profileId: DEFAULT_PROFILE_ID,
    date: timestamp,
    category: "Аренда",
    amount: 700,
    comment: "Дневная аренда",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "expense_fuel",
    profileId: DEFAULT_PROFILE_ID,
    date: timestamp,
    category: "Транспорт",
    amount: 950,
    comment: "Доставка товара",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "expense_lunch_gazelle_2",
    profileId: secondProfileId,
    date: timestamp,
    category: "Обед",
    amount: 650,
    comment: "Обед бригады",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const writeOffs: WriteOff[] = [
  {
    id: "writeoff_cucumber",
    profileId: DEFAULT_PROFILE_ID,
    productId: productIds.cucumber,
    date: timestamp,
    inputMode: "weight",
    quantity: 1.5,
    reason: "Порча",
    comment: "Подвяли",
    costAmount: 46.5,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "writeoff_group",
    profileId: DEFAULT_PROFILE_ID,
    stockGroupId,
    date: timestamp,
    inputMode: "packages",
    packageCount: 1,
    packageWeight: 1,
    packageLabel: "мешок",
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
    activeProfileId: DEFAULT_PROFILE_ID,
    theme: "light",
    weightPrecision: 2,
    currencySymbol: "₽",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const setInitialized = () => {
  window.localStorage.setItem(initializedKey, "1");
};

const clearDemoRequest = () => {
  window.localStorage.removeItem(demoRequestedKey);
};

const isInitialized = () => window.localStorage.getItem(initializedKey) === "1";
const isDemoRequested = () => window.localStorage.getItem(demoRequestedKey) === "1";

export const requestDemoSeed = () => {
  window.localStorage.setItem(demoRequestedKey, "1");
  window.localStorage.removeItem(initializedKey);
};

export const markDatabaseInitialized = () => {
  setInitialized();
  clearDemoRequest();
};

let seedPromise: Promise<void> | null = null;

const seedDatabaseOnce = async () => {
  const existing = await db.products.count();

  if (existing > 0) {
    setInitialized();
    clearDemoRequest();
    return;
  }

  if (isInitialized() && !isDemoRequested()) {
    return;
  }

  await db.transaction("rw", db.tables, async () => {
    await db.bazaarLocations.bulkPut(bazaarLocations);
    await db.storeProfiles.bulkPut(storeProfiles);
    await db.stockGroups.bulkPut(stockGroups);
    await db.products.bulkPut(products);
    await db.receipts.bulkPut(receipts);
    await db.sales.bulkPut(sales);
    await db.expenses.bulkPut(expenses);
    await db.writeOffs.bulkPut(writeOffs);
    await db.quickButtonSettings.bulkPut(quickButtons);
    await db.appSettings.bulkPut(appSettings);
  });
  setInitialized();
  clearDemoRequest();
};

export const seedDatabase = () => {
  if (!seedPromise) {
    seedPromise = seedDatabaseOnce().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
};
