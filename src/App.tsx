import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Archive,
  Boxes,
  Calculator,
  ChevronDown,
  Check,
  ClipboardList,
  Download,
  History,
  MapPin,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Search,
  Share2,
  Settings,
  ShoppingBasket,
  Store,
  Trash2,
  TrendingUp,
  Truck,
  Upload,
  Wallet,
  X
} from "lucide-react";
import { db } from "./db";
import {
  applyDiscount,
  calculatePriceDiscount,
  calculateWriteOffQuantity,
  clearDiscount,
  createEmptySaleEditor,
  defaultSettings,
  editActualTotal,
  editPieceAmount,
  editPrice,
  editTotal,
  editWeight,
  type SaleEditor
} from "./logic";
import { markDatabaseInitialized, requestDemoSeed, seedDatabase } from "./seed";
import { exportSnapshot, importSnapshot } from "./services/exportImport";
import "./styles.css";
import type {
  AppSettings,
  BaseField,
  BazaarLocation,
  DiscountType,
  Expense,
  Product,
  ProductView,
  QuickButtonSetting,
  Receipt as ReceiptEntity,
  Sale,
  SaleMode,
  StoreProfile,
  StockGroup,
  Unit,
  WriteOff
} from "./types";
import {
  bazaarCities,
  bazaarLocationLabel,
  createDefaultBazaarLocations,
  createDefaultProfile,
  DEFAULT_PROFILE_ID,
  profileLocationLabel
} from "./profiles";
import {
  downloadTextFile,
  evaluateExpression,
  formatDateTime,
  formatMoney,
  formatWeight,
  isToday,
  makeId,
  nowIso,
  parseNumber,
  toMoney
} from "./utils";

type Screen =
  | "sale"
  | "products"
  | "groups"
  | "receipts"
  | "writeOffs"
  | "expenses"
  | "history"
  | "reports"
  | "settings";

type KeypadField =
  | "quantity"
  | "totalAmount"
  | "actualAmount"
  | "salePrice"
  | "discountAmount"
  | "discountPercent"
  | "receivedAmount";

interface ToastState {
  id: string;
  text: string;
}

interface ConfirmState {
  title: string;
  text: string;
  action: () => Promise<void> | void;
}

interface KeypadState {
  field: KeypadField;
  title: string;
  suffix: string;
  value: string;
  submitLabel: string;
}

interface CartLine {
  id: string;
  productId: string;
  productName: string;
  unit: Unit;
  stockGroupId?: string;
  requestedQuantity?: number;
  requestedAmount: number;
  differenceAmount: number;
  quantity: number;
  salePrice: number;
  originalSalePrice: number;
  priceDiscountAmount: number;
  isDiscounted: boolean;
  totalAmount: number;
  originalTotalAmount: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  finalTotalAmount: number;
  mode: SaleMode;
  activeBaseField: BaseField;
  averageCost: number;
}

interface ProductDraft extends Product {}

interface GroupDraft extends StockGroup {}

interface ReceiptDraft {
  id: string;
  profileId: string;
  targetType: "group" | "product";
  targetId: string;
  date: string;
  quantity: string;
  purchasePrice: string;
  totalAmount: string;
  source: string;
  comment: string;
}

interface WriteOffDraft {
  id: string;
  profileId: string;
  targetType: "group" | "product";
  targetId: string;
  date: string;
  inputMode: "weight" | "packages";
  quantity: string;
  packageCount: string;
  packageWeight: string;
  packageLabel: string;
  reason: string;
  comment: string;
}

interface ExpenseDraft extends Expense {}

interface ProfileDraft extends StoreProfile {}
interface BazaarLocationDraft extends BazaarLocation {}

const screens: Array<{ id: Screen; label: string; icon: typeof ShoppingBasket }> = [
  { id: "sale", label: "Продажа", icon: ShoppingBasket },
  { id: "products", label: "Товары", icon: Package },
  { id: "receipts", label: "Поступления", icon: Receipt },
  { id: "history", label: "История", icon: History },
  { id: "reports", label: "Аналитика", icon: TrendingUp },
  { id: "settings", label: "Еще", icon: Settings }
];

const emptyProductDraft = (profileId: string): ProductDraft => ({
  id: makeId("product"),
  profileId,
  name: "",
  variant: "",
  category: "Овощи",
  unit: "kg",
  currentStock: 0,
  isUnlimitedStock: false,
  averageCost: 0,
  defaultSalePrice: 0,
  notes: "",
  isArchived: false,
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const emptyGroupDraft = (profileId: string): GroupDraft => ({
  id: makeId("group"),
  profileId,
  name: "",
  unit: "kg",
  currentStock: 0,
  averageCost: 0,
  notes: "",
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const emptyReceiptDraft = (profileId: string): ReceiptDraft => ({
  id: makeId("receipt"),
  profileId,
  targetType: "group",
  targetId: "",
  date: nowIso(),
  quantity: "",
  purchasePrice: "",
  totalAmount: "",
  source: "",
  comment: ""
});

const emptyWriteOffDraft = (profileId: string): WriteOffDraft => ({
  id: makeId("writeoff"),
  profileId,
  targetType: "group",
  targetId: "",
  date: nowIso(),
  inputMode: "weight",
  quantity: "",
  packageCount: "",
  packageWeight: "",
  packageLabel: "мешок",
  reason: "Порча",
  comment: ""
});

const emptyExpenseDraft = (profileId: string): ExpenseDraft => ({
  id: makeId("expense"),
  profileId,
  date: nowIso(),
  category: "Аренда",
  amount: 0,
  comment: "",
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const emptyProfileDraft = (location?: BazaarLocation): ProfileDraft => ({
  id: makeId("profile"),
  bazaarLocationId: location?.id ?? "",
  name: "",
  city: location?.city ?? "",
  marketName: location?.marketName ?? "",
  pointName: location?.pointName ?? "",
  isArchived: false,
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const emptyBazaarLocationDraft = (): BazaarLocationDraft => ({
  id: makeId("bazaar"),
  city: "Махачкала",
  marketName: "",
  pointName: "",
  isArchived: false,
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const unitLabel = (unit: Unit = "kg") =>
  ({ kg: "кг", piece: "шт", box: "ящ.", bag: "меш.", net: "сет.", other: "ед." })[unit];

const formatQuantity = (value: number, unit: Unit, precision: number) =>
  `${unit === "piece" ? formatMoney(value) : formatWeight(value, precision)} ${unitLabel(unit)}`;

function App() {
  const [startupError, setStartupError] = useState<string>("");
  const [screen, setScreen] = useState<Screen>("sale");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saleEditor, setSaleEditor] = useState<SaleEditor>(createEmptySaleEditor());
  const [saleCart, setSaleCart] = useState<CartLine[]>([]);
  const [isSavingSale, setIsSavingSale] = useState(false);
  const [receivedAmount, setReceivedAmountState] = useState<number>(0);
  const [keypad, setKeypad] = useState<KeypadState | null>(null);
  const [toolPanel, setToolPanel] = useState<"discount" | "change" | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);
  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft | null>(null);
  const [writeOffDraft, setWriteOffDraft] = useState<WriteOffDraft | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [bazaarLocationDraft, setBazaarLocationDraft] = useState<BazaarLocationDraft | null>(null);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [historyRange, setHistoryRange] = useState<"today" | "7d" | "30d" | "all">("today");
  const [analyticsRange, setAnalyticsRange] = useState<"today" | "7d" | "30d" | "all">("today");
  const [productQuery, setProductQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [newWeightPreset, setNewWeightPreset] = useState("");
  const [newAmountPreset, setNewAmountPreset] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saleCheckoutRef = useRef<HTMLDivElement | null>(null);

  const bazaarLocations = useLiveQuery(() => db.bazaarLocations.orderBy("marketName").toArray(), [], []) ?? [];
  const storeProfiles = useLiveQuery(() => db.storeProfiles.orderBy("name").toArray(), [], []) ?? [];
  const allStockGroups = useLiveQuery(() => db.stockGroups.toArray(), [], []) ?? [];
  const allProducts = useLiveQuery(() => db.products.orderBy("updatedAt").toArray(), [], []) ?? [];
  const allReceipts = useLiveQuery(() => db.receipts.orderBy("date").reverse().toArray(), [], []) ?? [];
  const allSales = useLiveQuery(() => db.sales.orderBy("date").reverse().toArray(), [], []) ?? [];
  const allExpenses = useLiveQuery(() => db.expenses.orderBy("date").reverse().toArray(), [], []) ?? [];
  const allWriteOffs = useLiveQuery(() => db.writeOffs.orderBy("date").reverse().toArray(), [], []) ?? [];
  const quickButtons = useLiveQuery(() => db.quickButtonSettings.orderBy("order").toArray(), [], []) ?? [];
  const appSettings = useLiveQuery(() => db.appSettings.get("main"), [], defaultSettings);

  const settings = appSettings ?? defaultSettings;
  const activeProfileId = storeProfiles.some((profile) => profile.id === settings.activeProfileId && !profile.isArchived)
    ? settings.activeProfileId
    : storeProfiles.find((profile) => !profile.isArchived)?.id ?? DEFAULT_PROFILE_ID;
  const activeProfile = storeProfiles.find((profile) => profile.id === activeProfileId);
  const stockGroups = useMemo(() => allStockGroups.filter((item) => item.profileId === activeProfileId), [activeProfileId, allStockGroups]);
  const products = useMemo(() => allProducts.filter((item) => item.profileId === activeProfileId), [activeProfileId, allProducts]);
  const receipts = useMemo(() => allReceipts.filter((item) => item.profileId === activeProfileId), [activeProfileId, allReceipts]);
  const sales = useMemo(() => allSales.filter((item) => item.profileId === activeProfileId), [activeProfileId, allSales]);
  const expenses = useMemo(() => allExpenses.filter((item) => item.profileId === activeProfileId), [activeProfileId, allExpenses]);
  const writeOffs = useMemo(() => allWriteOffs.filter((item) => item.profileId === activeProfileId), [activeProfileId, allWriteOffs]);
  const todayExpenses = useMemo(() => expenses.filter((item) => isToday(item.date)), [expenses]);
  const todayExpenseTotal = useMemo(() => todayExpenses.reduce((sum, item) => sum + item.amount, 0), [todayExpenses]);
  const todayExpenseByCategory = useMemo(
    () =>
      todayExpenses.reduce<Record<string, number>>((totals, item) => {
        totals[item.category] = (totals[item.category] ?? 0) + item.amount;
        return totals;
      }, {}),
    [todayExpenses]
  );
  const weightQuickButtons = useMemo(() => quickButtons.filter((button) => button.type === "weight"), [quickButtons]);
  const amountQuickButtons = useMemo(() => quickButtons.filter((button) => button.type === "amount"), [quickButtons]);

  useEffect(() => {
    void (async () => {
      try {
        await seedDatabase();
      } catch (error) {
        setStartupError(error instanceof Error ? error.message : String(error));
      }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    if (storeProfiles.length > 0 && settings.activeProfileId !== activeProfileId) {
      void db.appSettings.put({ ...settings, activeProfileId, updatedAt: nowIso() });
    }
  }, [activeProfileId, settings, storeProfiles.length]);

  useEffect(() => {
    setSelectedProductId("");
    setSaleEditor(createEmptySaleEditor());
    setSaleCart([]);
    setReceivedAmountState(0);
    setKeypad(null);
    setToolPanel(null);
    setModePickerOpen(false);
    setSelectedCategory("Все");
    setProductDraft(null);
    setGroupDraft(null);
    setReceiptDraft(null);
    setWriteOffDraft(null);
    setExpenseDraft(null);
    setProfileDraft(null);
    setBazaarLocationDraft(null);
  }, [activeProfileId]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const productViews = useMemo<ProductView[]>(() => {
    const groupMap = new Map(stockGroups.map((group) => [group.id, group]));

    return products
      .filter((product) => !product.isArchived)
      .map((product) => {
        const group = product.stockGroupId ? groupMap.get(product.stockGroupId) : undefined;
        return {
          ...product,
          displayName: [product.name, product.variant].filter(Boolean).join(" "),
          sharedStockName: group?.name,
          availableStock: group ? group.currentStock : product.currentStock,
          averageCost: group ? group.averageCost : product.averageCost
        };
      });
  }, [products, stockGroups]);

  const productViewMap = useMemo(
    () => new Map(productViews.map((product) => [product.id, product])),
    [productViews]
  );
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const stockGroupMap = useMemo(() => new Map(stockGroups.map((group) => [group.id, group])), [stockGroups]);

  const productCategories = useMemo(
    () => ["Все", ...Array.from(new Set(productViews.map((product) => product.category))).sort()],
    [productViews]
  );

  const filteredProductViews = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase("ru");
    return productViews.filter((product) => {
      const matchesCategory = selectedCategory === "Все" || product.category === selectedCategory;
      const matchesQuery =
        !query ||
        product.displayName.toLocaleLowerCase("ru").includes(query) ||
        product.category.toLocaleLowerCase("ru").includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [productQuery, productViews, selectedCategory]);

  const selectedProduct = selectedProductId ? productViewMap.get(selectedProductId) : undefined;
  const selectedUnit = selectedProduct?.unit ?? "kg";
  const isPieceSelected = selectedUnit === "piece";
  const receiptDraftUnit = receiptDraft?.targetType === "group"
    ? stockGroupMap.get(receiptDraft.targetId)?.unit ?? "kg"
    : productMap.get(receiptDraft?.targetId ?? "")?.unit ?? "kg";
  const writeOffDraftUnit = writeOffDraft?.targetType === "group"
    ? stockGroupMap.get(writeOffDraft.targetId)?.unit ?? "kg"
    : productMap.get(writeOffDraft?.targetId ?? "")?.unit ?? "kg";

  useEffect(() => {
    if (productViews.length === 0) {
      return;
    }

    const exists = selectedProductId && productViewMap.has(selectedProductId);
    if (!exists) {
      const nextProduct = productViews[0];
      setSelectedProductId(nextProduct.id);
      setSaleEditor(createEmptySaleEditor(nextProduct));
    }
  }, [productViewMap, productViews, selectedProductId]);

  const historyItems = useMemo(() => {
    const rows = [
      ...sales.map((item) => ({
        id: item.id,
        type: "sale" as const,
        date: item.date,
        title: productViewMap.get(item.productId)?.displayName ?? "Продажа",
        amount: item.finalTotalAmount,
        subtext: `${formatQuantity(item.quantity, productMap.get(item.productId)?.unit ?? "kg", settings.weightPrecision)} · запрос ${formatMoney(item.requestedAmount ?? item.finalTotalAmount)} ₽ · разница ${formatSignedMoney(item.differenceAmount ?? item.finalTotalAmount - (item.requestedAmount ?? item.finalTotalAmount))}${item.isDiscounted ? " · скидочная" : ""}`
      })),
      ...receipts.map((item) => ({
        id: item.id,
        type: "receipt" as const,
        date: item.date,
        title: item.stockGroupId
          ? stockGroups.find((group) => group.id === item.stockGroupId)?.name ?? "Поступление"
          : productViewMap.get(item.productId ?? "")?.displayName ?? "Поступление",
        amount: item.totalAmount,
        subtext: formatQuantity(
          item.quantity,
          item.stockGroupId ? stockGroupMap.get(item.stockGroupId)?.unit ?? "kg" : productMap.get(item.productId ?? "")?.unit ?? "kg",
          settings.weightPrecision
        )
      })),
      ...writeOffs.map((item) => ({
        id: item.id,
        type: "writeOff" as const,
        date: item.date,
        title: item.stockGroupId
          ? stockGroups.find((group) => group.id === item.stockGroupId)?.name ?? "Списание"
          : productViewMap.get(item.productId ?? "")?.displayName ?? "Списание",
        amount: item.costAmount,
        subtext: item.inputMode === "packages" && item.packageCount
          ? `${formatMoney(item.packageCount)} ${formatPackageLabel(item.packageLabel, item.packageCount)} · ${formatQuantity(item.quantity, item.stockGroupId ? stockGroupMap.get(item.stockGroupId)?.unit ?? "kg" : productMap.get(item.productId ?? "")?.unit ?? "kg", settings.weightPrecision)}`
          : formatQuantity(item.quantity, item.stockGroupId ? stockGroupMap.get(item.stockGroupId)?.unit ?? "kg" : productMap.get(item.productId ?? "")?.unit ?? "kg", settings.weightPrecision)
      })),
      ...expenses.map((item) => ({
        id: item.id,
        type: "expense" as const,
        date: item.date,
        title: item.category,
        amount: item.amount,
        subtext: item.comment || "Расход"
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (historyRange === "all") {
      return rows;
    }

    const rangeMap = {
      today: 1,
      "7d": 7,
      "30d": 30
    };
    const days = rangeMap[historyRange];
    const min = Date.now() - days * 24 * 60 * 60 * 1000;
    return rows.filter((row) => (historyRange === "today" ? isToday(row.date) : new Date(row.date).getTime() >= min));
  }, [expenses, historyRange, productMap, productViewMap, receipts, sales, settings.weightPrecision, stockGroupMap, stockGroups, writeOffs]);

  const report = useMemo(() => {
    const periodSales = sales.filter((item) => isInRange(item.date, analyticsRange));
    const periodReceipts = receipts.filter((item) => isInRange(item.date, analyticsRange));
    const periodExpenses = expenses.filter((item) => isInRange(item.date, analyticsRange));
    const periodWriteOffs = writeOffs.filter((item) => isInRange(item.date, analyticsRange));
    const revenue = periodSales.reduce((sum, item) => sum + item.finalTotalAmount, 0);
    const requestedRevenue = periodSales.reduce(
      (sum, item) => sum + (item.requestedAmount ?? item.finalTotalAmount),
      0
    );
    const differenceRevenue = toMoney(revenue - requestedRevenue);
    const purchase = periodReceipts.reduce((sum, item) => sum + item.totalAmount, 0);
    const expensesTotal = periodExpenses.reduce((sum, item) => sum + item.amount, 0);
    const writeOffTotal = periodWriteOffs.reduce((sum, item) => sum + item.costAmount, 0);
    const unitForWriteOff = (item: WriteOff) =>
      item.stockGroupId ? stockGroupMap.get(item.stockGroupId)?.unit ?? "kg" : productMap.get(item.productId ?? "")?.unit ?? "kg";
    const writeOffWeightQuantity = periodWriteOffs
      .filter((item) => unitForWriteOff(item) !== "piece")
      .reduce((sum, item) => sum + item.quantity, 0);
    const writeOffPieceQuantity = periodWriteOffs
      .filter((item) => unitForWriteOff(item) === "piece")
      .reduce((sum, item) => sum + item.quantity, 0);
    const writeOffPackages = periodWriteOffs.reduce((sum, item) => sum + (item.packageCount ?? 0), 0);
    const cogs = periodSales.reduce((sum, item) => sum + item.costOfGoodsSold, 0);
    const stockValue =
      stockGroups.reduce((sum, item) => sum + item.currentStock * item.averageCost, 0) +
      products
        .filter((item) => !item.stockGroupId && !item.isArchived)
        .reduce((sum, item) => sum + item.currentStock * item.averageCost, 0);

    const topProductMap = new Map<string, { name: string; unit: Unit; revenue: number; quantity: number }>();
    for (const sale of periodSales) {
      const current = topProductMap.get(sale.productId) ?? {
        name: productViewMap.get(sale.productId)?.displayName ?? "Товар",
        unit: productMap.get(sale.productId)?.unit ?? "kg",
        revenue: 0,
        quantity: 0
      };
      current.revenue += sale.finalTotalAmount;
      current.quantity += sale.quantity;
      topProductMap.set(sale.productId, current);
    }

    const topWriteOffMap = new Map<
      string,
      { name: string; unit: Unit; quantity: number; packageCount: number; cost: number; incidents: number }
    >();
    for (const item of periodWriteOffs) {
      const id = item.stockGroupId ? `group:${item.stockGroupId}` : `product:${item.productId ?? "unknown"}`;
      const name = item.stockGroupId
        ? stockGroups.find((group) => group.id === item.stockGroupId)?.name ?? "Партия"
        : productViewMap.get(item.productId ?? "")?.displayName ?? "Товар";
      const current = topWriteOffMap.get(id) ?? { name, unit: unitForWriteOff(item), quantity: 0, packageCount: 0, cost: 0, incidents: 0 };
      current.quantity += item.quantity;
      current.packageCount += item.packageCount ?? 0;
      current.cost += item.costAmount;
      current.incidents += 1;
      topWriteOffMap.set(id, current);
    }

    return {
      revenue,
      requestedRevenue,
      differenceRevenue,
      adjustedSalesCount: periodSales.filter(
        (item) => Math.abs(item.differenceAmount ?? item.finalTotalAmount - (item.requestedAmount ?? item.finalTotalAmount)) > 0.001
      ).length,
      discountedSalesCount: periodSales.filter((item) => item.isDiscounted).length,
      purchase,
      expenses: expensesTotal,
      writeOffs: writeOffTotal,
      writeOffWeightQuantity,
      writeOffPieceQuantity,
      writeOffPackages,
      writeOffIncidents: periodWriteOffs.length,
      cogs,
      profit: revenue - cogs - expensesTotal - writeOffTotal,
      stockValue,
      topProducts: Array.from(topProductMap.entries())
        .map(([id, item]) => ({ id, ...item }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
      topWriteOffs: Array.from(topWriteOffMap.entries())
        .map(([id, item]) => ({ id, ...item }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5)
    };
  }, [analyticsRange, expenses, productMap, productViewMap, products, receipts, sales, stockGroupMap, stockGroups, writeOffs]);

  const shareAnalytics = async () => {
    if (!activeProfile) {
      showToast("Сначала выберите профиль");
      return;
    }
    const rangeLabel = { today: "сегодня", "7d": "за 7 дней", "30d": "за 30 дней", all: "за все время" }[
      analyticsRange
    ];
    const text = [
      `WayYaam · ${activeProfile.name}`,
      profileLocationLabel(activeProfile),
      `Отчет ${rangeLabel}`,
      `По запросам: ${formatMoney(report.requestedRevenue)} ₽`,
      `Фактически: ${formatMoney(report.revenue)} ₽`,
      `Разница: ${formatSignedMoney(report.differenceRevenue)}`,
      `Скидочных продаж: ${report.discountedSalesCount}`,
      `Расходы: ${formatMoney(report.expenses)} ₽`,
      `Порча: ${formatMoney(report.writeOffs)} ₽`,
      `Прибыль: ${formatMoney(report.profit)} ₽`
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: `Аналитика · ${activeProfile.name}`, text });
        showToast("Отчет передан");
      } else {
        downloadTextFile(`analytics-${activeProfile.id}-${new Date().toISOString().slice(0, 10)}.txt`, text);
        showToast("Отчет скачан — им можно поделиться");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      showToast("Не удалось поделиться отчетом");
    }
  };

  const reservedStockByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of saleCart) {
      map.set(line.productId, (map.get(line.productId) ?? 0) + line.quantity);
    }
    return map;
  }, [saleCart]);

  const reservedStockByGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of saleCart) {
      if (!line.stockGroupId) {
        continue;
      }
      map.set(line.stockGroupId, (map.get(line.stockGroupId) ?? 0) + line.quantity);
    }
    return map;
  }, [saleCart]);

  const currentLineValid =
    !!selectedProduct &&
    saleEditor.requestedAmount > 0 &&
    saleEditor.quantity > 0 &&
    (!isPieceSelected || Number.isInteger(saleEditor.quantity)) &&
    saleEditor.salePrice > 0 &&
    saleEditor.finalTotalAmount > 0 &&
    saleEditor.differenceAmount >= 0;

  const currentLineStockLeft = selectedProduct
    ? hasUnlimitedStock(selectedProduct)
      ? Number.POSITIVE_INFINITY
      : selectedProduct.availableStock -
        (selectedProduct.stockGroupId
          ? reservedStockByGroup.get(selectedProduct.stockGroupId) ?? 0
          : reservedStockByProduct.get(selectedProduct.id) ?? 0)
    : 0;

  const currentOriginalSalePrice = selectedProduct?.defaultSalePrice ?? saleEditor.salePrice;
  const currentPriceDiscountAmount = calculatePriceDiscount(
    currentOriginalSalePrice,
    saleEditor.salePrice,
    saleEditor.quantity
  );
  const currentPriceChanged = Math.abs(saleEditor.salePrice - currentOriginalSalePrice) > 0.001;
  const currentIsDiscounted = currentPriceDiscountAmount > 0 || Boolean(saleEditor.discountAmount);

  const checkoutCurrentIncluded = currentLineValid ? saleEditor.finalTotalAmount : 0;
  const checkoutTotal = useMemo(
    () => toMoney(saleCart.reduce((sum, item) => sum + item.finalTotalAmount, checkoutCurrentIncluded)),
    [checkoutCurrentIncluded, saleCart]
  );
  const checkoutChange = toMoney(Math.max(0, (receivedAmount || 0) - checkoutTotal));

  const showToast = (text: string) => setToast({ id: makeId("toast"), text });

  function hasUnlimitedStock(product?: ProductView | Product | null) {
    return Boolean(product?.isUnlimitedStock && !product?.stockGroupId);
  }

  const getProductStockSubtitle = (product: ProductView) =>
    hasUnlimitedStock(product)
      ? "Остаток: без ограничения"
      : product.sharedStockName
        ? `Общий остаток: ${formatQuantity(product.availableStock, product.unit, settings.weightPrecision)}`
        : `Остаток: ${formatQuantity(product.availableStock, product.unit, settings.weightPrecision)}`;

  const getProductStockMeta = (product: ProductView) =>
    hasUnlimitedStock(product)
      ? "Свободный товар без ограничения остатка"
      : product.sharedStockName
        ? `Общая группа: ${product.sharedStockName}`
        : "Свободный товар";

  const getProductStockSide = (product: ProductView) =>
    hasUnlimitedStock(product)
      ? "∞"
      : product.sharedStockName
        ? "Общий остаток"
        : formatQuantity(product.availableStock, product.unit, settings.weightPrecision);

  const editRequestedAmount = (editor: SaleEditor, value: number) =>
    isPieceSelected
      ? editPieceAmount(editor, value, settings.weightPrecision)
      : editTotal(editor, value, settings.weightPrecision);

  const editSelectedPrice = (editor: SaleEditor, value: number) => {
    const repriced = editPrice(editor, value, settings.weightPrecision);
    return isPieceSelected && repriced.mode === "by_amount" && repriced.requestedAmount > 0
      ? editPieceAmount(repriced, repriced.requestedAmount, settings.weightPrecision)
      : repriced;
  };

  const resetSale = (product = selectedProduct) => {
    setSaleEditor(createEmptySaleEditor(product));
    setKeypad(null);
    setToolPanel(null);
  };

  const resetEntireCheckout = (product = selectedProduct) => {
    resetSale(product);
    setSaleCart([]);
    setReceivedAmountState(0);
  };

  const chooseProduct = (productId: string) => {
    const product = productViewMap.get(productId);
    if (!product) {
      return;
    }
    setSelectedProductId(productId);
    resetSale(product);
    setModePickerOpen(true);
  };

  const chooseSaleMode = (mode: SaleMode) => {
    setModePickerOpen(false);
    if (mode === "by_weight") {
      openKeypad(
        "quantity",
        isPieceSelected ? "Введите количество" : "Введите вес",
        saleEditor.requestedQuantity ?? "",
        unitLabel(selectedUnit)
      );
    } else {
      openKeypad("totalAmount", "Введите сумму", saleEditor.requestedAmount, "₽");
    }
  };

  const openKeypad = (field: KeypadField, title: string, value: number | string, suffix: string) => {
    setKeypad({
      field,
      title,
      suffix,
      value: String(value || ""),
      submitLabel: suffix || "OK"
    });
  };

  const submitKeypad = () => {
    if (!keypad) {
      return;
    }

    const computed = evaluateExpression(keypad.value);
    const value = Number.isFinite(computed) ? computed : 0;
    const precision = settings.weightPrecision;

    if (keypad.field === "quantity") {
      if (isPieceSelected && !Number.isInteger(value)) {
        showToast("Введите целое количество штук");
        return;
      }
      setSaleEditor((current) => editWeight(current, value, precision));
      setToolPanel(null);
    }

    if (keypad.field === "totalAmount") {
      setSaleEditor((current) => editRequestedAmount(current, value));
      setToolPanel(null);
    }

    if (keypad.field === "actualAmount") {
      if (value < saleEditor.requestedAmount) {
        showToast("Фактическая сумма не может быть меньше запроса клиента");
        return;
      }
      setSaleEditor((current) => editActualTotal(current, value, precision));
      setToolPanel(null);
    }

    if (keypad.field === "salePrice") {
      setSaleEditor((current) => editSelectedPrice(current, value));
      setToolPanel(null);
      if (selectedProduct && value < selectedProduct.defaultSalePrice) {
        showToast("Цена снижена — продажа отмечена скидочной");
      } else if (selectedProduct && Math.abs(value - selectedProduct.defaultSalePrice) > 0.001) {
        showToast("Цена продажи изменена");
      }
    }

    if (keypad.field === "discountAmount") {
      setSaleEditor((current) => applyDiscount(current, "amount", value, precision));
      setToolPanel("discount");
    }

    if (keypad.field === "discountPercent") {
      setSaleEditor((current) => applyDiscount(current, "percent", value, precision));
      setToolPanel("discount");
    }

    if (keypad.field === "receivedAmount") {
      setReceivedAmountState(value);
      setToolPanel("change");
    }

    setKeypad(null);
  };

  const appendKey = (key: string) => {
    setKeypad((current) => {
      if (!current) {
        return current;
      }

      const operators = ["+", "-", "*", "/"];
      const lastChar = current.value.slice(-1);

      if (key === "." && /(^|[+\-*/(])[^+\-*/()]*\./.test(current.value)) {
        return current;
      }

      if (operators.includes(key)) {
        if (!current.value && key !== "-") {
          return current;
        }
        if (operators.includes(lastChar)) {
          return { ...current, value: `${current.value.slice(0, -1)}${key}` };
        }
      }

      return { ...current, value: `${current.value}${key}` };
    });
  };

  const backspaceKey = () => {
    setKeypad((current) => (current ? { ...current, value: current.value.slice(0, -1) } : current));
  };

  const clearKeypad = () => {
    setKeypad((current) => (current ? { ...current, value: "" } : current));
  };

  const quickApply = (button: QuickButtonSetting) => {
    const precision = settings.weightPrecision;

    if (button.type === "weight") {
      setSaleEditor((current) => editWeight(current, isPieceSelected ? Math.max(1, Math.floor(button.value)) : button.value, precision));
    }
    if (button.type === "amount") {
      setSaleEditor((current) => editRequestedAmount(current, button.value));
    }
    if (button.type === "discount") {
      setSaleEditor((current) => applyDiscount(current, "amount", button.value, precision));
      setToolPanel("discount");
    }
  };

  const addCurrentItemToCart = () => {
    if (!selectedProduct) {
      showToast("Выберите товар");
      return;
    }
    if (saleEditor.quantity <= 0 || saleEditor.salePrice <= 0 || saleEditor.finalTotalAmount <= 0) {
      showToast(isPieceSelected ? "Проверьте количество, цену и сумму" : "Проверьте вес, цену и сумму");
      return;
    }
    if (saleEditor.requestedAmount <= 0) {
      showToast(isPieceSelected ? "Введите запрос клиента в штуках или рублях" : "Введите запрос клиента в кг или рублях");
      return;
    }
    if (saleEditor.differenceAmount < 0) {
      showToast("Фактическая сумма должна быть не меньше запроса клиента");
      return;
    }
    if (currentLineStockLeft < saleEditor.quantity) {
      showToast("Недостаточно остатка");
      return;
    }

    setSaleCart((current) => [
      ...current,
      {
        id: makeId("line"),
        productId: selectedProduct.id,
        productName: selectedProduct.displayName,
        unit: selectedProduct.unit,
        stockGroupId: selectedProduct.stockGroupId,
        requestedQuantity: saleEditor.requestedQuantity,
        requestedAmount: saleEditor.requestedAmount,
        differenceAmount: saleEditor.differenceAmount,
        quantity: saleEditor.quantity,
        salePrice: saleEditor.salePrice,
        originalSalePrice: currentOriginalSalePrice,
        priceDiscountAmount: currentPriceDiscountAmount,
        isDiscounted: currentIsDiscounted,
        totalAmount: saleEditor.totalAmount,
        originalTotalAmount: saleEditor.discountAmount ? saleEditor.originalTotalAmount : saleEditor.totalAmount,
        discountType: saleEditor.discountType,
        discountValue: saleEditor.discountValue,
        discountAmount: saleEditor.discountAmount,
        finalTotalAmount: saleEditor.finalTotalAmount,
        mode: saleEditor.mode,
        activeBaseField: saleEditor.activeBaseField,
        averageCost: selectedProduct.averageCost
      }
    ]);

    resetSale(selectedProduct);
    showToast("Позиция добавлена в чек");
  };

  const removeCartLine = (lineId: string) => {
    setSaleCart((current) => current.filter((item) => item.id !== lineId));
  };

  const persistSale = async () => {
    if (isSavingSale) {
      return;
    }

    const lines = [...saleCart];
    const hasCurrentDraft = saleEditor.requestedAmount > 0 || saleEditor.quantity > 0 || saleEditor.totalAmount > 0;

    if (hasCurrentDraft && !currentLineValid) {
      showToast(
        saleEditor.differenceAmount < 0
          ? "Фактическая сумма должна быть не меньше запроса клиента"
          : isPieceSelected
            ? "Проверьте количество, цену и сумму"
            : "Проверьте запрос клиента, вес, цену и фактическую сумму"
      );
      return;
    }

    if (currentLineValid && selectedProduct) {
      if (currentLineStockLeft < saleEditor.quantity) {
        showToast("Недостаточно остатка");
        return;
      }

      lines.push({
        id: makeId("line"),
        productId: selectedProduct.id,
        productName: selectedProduct.displayName,
        unit: selectedProduct.unit,
        stockGroupId: selectedProduct.stockGroupId,
        requestedQuantity: saleEditor.requestedQuantity,
        requestedAmount: saleEditor.requestedAmount,
        differenceAmount: saleEditor.differenceAmount,
        quantity: saleEditor.quantity,
        salePrice: saleEditor.salePrice,
        originalSalePrice: currentOriginalSalePrice,
        priceDiscountAmount: currentPriceDiscountAmount,
        isDiscounted: currentIsDiscounted,
        totalAmount: saleEditor.totalAmount,
        originalTotalAmount: saleEditor.discountAmount ? saleEditor.originalTotalAmount : saleEditor.totalAmount,
        discountType: saleEditor.discountType,
        discountValue: saleEditor.discountValue,
        discountAmount: saleEditor.discountAmount,
        finalTotalAmount: saleEditor.finalTotalAmount,
        mode: saleEditor.mode,
        activeBaseField: saleEditor.activeBaseField,
        averageCost: selectedProduct.averageCost
      });
    }

    if (lines.length === 0) {
      showToast("Добавьте хотя бы одну позицию");
      return;
    }

    const groupedStockUsage = new Map<string, number>();
    const groupedProductUsage = new Map<string, number>();
    for (const line of lines) {
      if (line.stockGroupId) {
        groupedStockUsage.set(line.stockGroupId, (groupedStockUsage.get(line.stockGroupId) ?? 0) + line.quantity);
      } else {
        groupedProductUsage.set(line.productId, (groupedProductUsage.get(line.productId) ?? 0) + line.quantity);
      }
    }

    for (const [groupId, quantity] of groupedStockUsage) {
      const product = productViews.find((item) => item.stockGroupId === groupId);
      if (product && product.availableStock < quantity) {
        showToast("Недостаточно остатка в общей группе");
        return;
      }
    }

    for (const [productId, quantity] of groupedProductUsage) {
      const product = productViewMap.get(productId);
      if (product && !hasUnlimitedStock(product) && product.availableStock < quantity) {
        showToast(`Недостаточно остатка: ${product.displayName}`);
        return;
      }
    }

    const batchId = makeId("batch");
    const timestamp = nowIso();
    const totalLinesAmount = lines.reduce((sum, line) => sum + line.finalTotalAmount, 0);

    setIsSavingSale(true);
    try {
      await db.transaction("rw", db.sales, db.products, db.stockGroups, async () => {
        for (const [groupId, quantity] of groupedStockUsage) {
          const group = await db.stockGroups.get(groupId);
          if (!group || group.profileId !== activeProfileId) {
            throw new Error("Группа остатка не найдена");
          }
          await db.stockGroups.put({
            ...group,
            currentStock: toMoney(group.currentStock - quantity),
            updatedAt: timestamp
          });
        }

        for (const [productId, quantity] of groupedProductUsage) {
          const product = await db.products.get(productId);
          if (!product || product.profileId !== activeProfileId) {
            throw new Error("Товар не найден");
          }
          if (hasUnlimitedStock(product)) {
            continue;
          }
          await db.products.put({
            ...product,
            currentStock: toMoney(product.currentStock - quantity),
            updatedAt: timestamp
          });
        }

        for (const line of lines) {
          const receivedForLine = totalLinesAmount > 0 ? toMoney((receivedAmount * line.finalTotalAmount) / totalLinesAmount) : undefined;
          const changeForLine =
            receivedForLine !== undefined ? toMoney(Math.max(0, receivedForLine - line.finalTotalAmount)) : undefined;

          await db.sales.add({
            id: makeId("sale"),
            profileId: activeProfileId,
            saleBatchId: batchId,
            productId: line.productId,
            stockGroupId: line.stockGroupId,
            date: timestamp,
            requestedQuantity: line.requestedQuantity,
            requestedAmount: line.requestedAmount,
            differenceAmount: line.differenceAmount,
            quantity: line.quantity,
            salePrice: line.salePrice,
            originalSalePrice: line.originalSalePrice,
            priceDiscountAmount: line.priceDiscountAmount || undefined,
            isDiscounted: line.isDiscounted,
            totalAmount: line.totalAmount,
            originalTotalAmount: line.originalTotalAmount,
            discountType: line.discountType,
            discountValue: line.discountValue,
            discountAmount: line.discountAmount,
            finalTotalAmount: line.finalTotalAmount,
            receivedAmount: receivedForLine,
            changeAmount: changeForLine,
            mode: line.mode,
            activeBaseField: line.activeBaseField,
            costOfGoodsSold: toMoney(line.quantity * line.averageCost),
            comment: lines.length > 1 ? `Чек ${batchId}` : "",
            createdAt: timestamp,
            updatedAt: timestamp
          });
        }
      });

      showToast("Продано");
      resetEntireCheckout(selectedProduct);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не удалось сохранить продажу");
    } finally {
      setIsSavingSale(false);
    }
  };

  const saveProduct = async () => {
    if (!productDraft) {
      return;
    }
    if (!productDraft.name.trim()) {
      showToast("Введите название товара");
      return;
    }
    if (productDraft.unit === "piece" && !productDraft.isUnlimitedStock && !Number.isInteger(productDraft.currentStock)) {
      showToast("Для штучного товара укажите целый остаток");
      return;
    }
    const payload: Product = {
      ...productDraft,
      profileId: activeProfileId,
      stockGroupId: productDraft.stockGroupId || undefined,
      currentStock: productDraft.stockGroupId ? 0 : productDraft.currentStock,
      isUnlimitedStock: productDraft.stockGroupId ? false : productDraft.isUnlimitedStock,
      averageCost: productDraft.stockGroupId ? 0 : productDraft.averageCost,
      updatedAt: nowIso()
    };
    await db.products.put(payload);
    setProductDraft(null);
    showToast("Товар сохранен");
  };

  const saveGroup = async () => {
    if (!groupDraft) {
      return;
    }
    if (!groupDraft.name.trim()) {
      showToast("Введите название партии");
      return;
    }
    if (products.some((product) => product.stockGroupId === groupDraft.id && product.unit !== groupDraft.unit)) {
      showToast("Сначала отвяжите товары с другой единицей");
      return;
    }
    await db.stockGroups.put({
      ...groupDraft,
      profileId: activeProfileId,
      updatedAt: nowIso()
    });
    setGroupDraft(null);
    showToast("Партия сохранена");
  };

  const saveReceipt = async () => {
    if (!receiptDraft) {
      return;
    }
    if (!receiptDraft.targetId) {
      showToast("Выберите куда пришло поступление");
      return;
    }
    const quantity = parseNumber(receiptDraft.quantity);
    const purchasePrice = parseNumber(receiptDraft.purchasePrice);
    const totalAmount = parseNumber(receiptDraft.totalAmount) || toMoney(quantity * purchasePrice);

    if (quantity <= 0 || purchasePrice <= 0) {
      showToast("Введите количество и закупочную цену");
      return;
    }
    const receiptUnit = receiptDraft.targetType === "group"
      ? stockGroupMap.get(receiptDraft.targetId)?.unit
      : productMap.get(receiptDraft.targetId)?.unit;
    if (receiptUnit === "piece" && !Number.isInteger(quantity)) {
      showToast("Для штучного товара укажите целое количество");
      return;
    }

    const receipt: ReceiptEntity = {
      id: receiptDraft.id,
      profileId: activeProfileId,
      stockGroupId: receiptDraft.targetType === "group" ? receiptDraft.targetId : undefined,
      productId: receiptDraft.targetType === "product" ? receiptDraft.targetId : undefined,
      date: receiptDraft.date,
      quantity,
      purchasePrice,
      totalAmount,
      source: receiptDraft.source,
      comment: receiptDraft.comment,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    await db.transaction("rw", db.receipts, db.stockGroups, db.products, async () => {
      await db.receipts.put(receipt);
      if (receipt.stockGroupId) {
        const group = await db.stockGroups.get(receipt.stockGroupId);
        if (!group || group.profileId !== activeProfileId) {
          throw new Error("Группа не найдена");
        }
        const newStock = group.currentStock + quantity;
        const averageCost =
          newStock > 0
            ? toMoney((group.currentStock * group.averageCost + quantity * purchasePrice) / newStock)
            : purchasePrice;
        await db.stockGroups.put({
          ...group,
          currentStock: toMoney(newStock),
          averageCost,
          updatedAt: nowIso()
        });
      } else if (receipt.productId) {
        const product = await db.products.get(receipt.productId);
        if (!product || product.profileId !== activeProfileId) {
          throw new Error("Товар не найден");
        }
        const newStock = product.currentStock + quantity;
        const averageCost =
          newStock > 0
            ? toMoney((product.currentStock * product.averageCost + quantity * purchasePrice) / newStock)
            : purchasePrice;
        await db.products.put({
          ...product,
          currentStock: toMoney(newStock),
          averageCost,
          updatedAt: nowIso()
        });
      }
    });

    setReceiptDraft(null);
    showToast("Поступление сохранено");
  };

  const saveWriteOff = async () => {
    if (!writeOffDraft) {
      return;
    }
    if (!writeOffDraft.targetId) {
      showToast("Выберите товар или партию");
      return;
    }
    const packageCount = parseNumber(writeOffDraft.packageCount);
    const packageWeight = parseNumber(writeOffDraft.packageWeight);
    const quantity = calculateWriteOffQuantity(
      writeOffDraft.inputMode,
      parseNumber(writeOffDraft.quantity),
      packageCount,
      packageWeight,
      settings.weightPrecision
    );

    if (quantity <= 0) {
      showToast(
        writeOffDraft.inputMode === "packages"
          ? "Введите количество упаковок и вес одной упаковки"
          : "Введите вес порчи"
      );
      return;
    }
    const writeOffUnit = writeOffDraft.targetType === "group"
      ? stockGroupMap.get(writeOffDraft.targetId)?.unit
      : productMap.get(writeOffDraft.targetId)?.unit;
    if (writeOffUnit === "piece" && !Number.isInteger(quantity)) {
      showToast("Для штучного товара укажите целое количество");
      return;
    }

    try {
      await db.transaction("rw", db.writeOffs, db.stockGroups, db.products, async () => {
        if (writeOffDraft.targetType === "group") {
        const group = await db.stockGroups.get(writeOffDraft.targetId);
        if (!group || group.profileId !== activeProfileId || group.currentStock < quantity) {
          throw new Error("Недостаточно остатка в группе");
        }
        await db.stockGroups.put({
          ...group,
          currentStock: toMoney(group.currentStock - quantity),
          updatedAt: nowIso()
        });
        await db.writeOffs.put({
          id: writeOffDraft.id,
          profileId: activeProfileId,
          stockGroupId: writeOffDraft.targetId,
          date: writeOffDraft.date,
          inputMode: writeOffDraft.inputMode,
          packageCount: writeOffDraft.inputMode === "packages" ? packageCount : undefined,
          packageWeight: writeOffDraft.inputMode === "packages" ? packageWeight : undefined,
          packageLabel: writeOffDraft.inputMode === "packages" ? writeOffDraft.packageLabel : undefined,
          quantity,
          reason: writeOffDraft.reason,
          comment: writeOffDraft.comment,
          costAmount: toMoney(quantity * group.averageCost),
          createdAt: nowIso(),
          updatedAt: nowIso()
        });
        } else {
        const product = await db.products.get(writeOffDraft.targetId);
        if (!product || product.profileId !== activeProfileId || product.currentStock < quantity) {
          throw new Error("Недостаточно остатка у товара");
        }
        await db.products.put({
          ...product,
          currentStock: toMoney(product.currentStock - quantity),
          updatedAt: nowIso()
        });
        await db.writeOffs.put({
          id: writeOffDraft.id,
          profileId: activeProfileId,
          productId: writeOffDraft.targetId,
          date: writeOffDraft.date,
          inputMode: writeOffDraft.inputMode,
          packageCount: writeOffDraft.inputMode === "packages" ? packageCount : undefined,
          packageWeight: writeOffDraft.inputMode === "packages" ? packageWeight : undefined,
          packageLabel: writeOffDraft.inputMode === "packages" ? writeOffDraft.packageLabel : undefined,
          quantity,
          reason: writeOffDraft.reason,
          comment: writeOffDraft.comment,
          costAmount: toMoney(quantity * product.averageCost),
          createdAt: nowIso(),
          updatedAt: nowIso()
        });
        }
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не удалось сохранить порчу");
      return;
    }

    setWriteOffDraft(null);
    showToast("Порча сохранена и остаток уменьшен");
  };

  const saveExpense = async () => {
    if (!expenseDraft) {
      return;
    }
    if (!expenseDraft.category.trim() || expenseDraft.amount <= 0) {
      showToast("Заполните расход");
      return;
    }
    await db.expenses.put({
      ...expenseDraft,
      profileId: activeProfileId,
      updatedAt: nowIso()
    });
    setExpenseDraft(null);
    showToast("Расход сохранен");
  };

  const archiveProduct = async (product: Product) => {
    await db.products.put({
      ...product,
      isArchived: true,
      updatedAt: nowIso()
    });
    showToast("Товар убран в архив");
  };

  const deleteExpense = async (expense: Expense) => {
    await db.expenses.delete(expense.id);
    showToast("Расход удален");
  };

  const deleteGroup = async (group: StockGroup) => {
    const hasLinked = products.some((product) => product.stockGroupId === group.id && !product.isArchived);
    const hasOps = receipts.some((item) => item.stockGroupId === group.id) || writeOffs.some((item) => item.stockGroupId === group.id);
    if (hasLinked || hasOps) {
      showToast("Группу нельзя удалить: есть товары или операции");
      return;
    }
    await db.stockGroups.delete(group.id);
    showToast("Партия удалена");
  };

  const handleExport = async () => {
    const snapshot = await exportSnapshot();
    downloadTextFile(`market-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snapshot, null, 2));
    showToast("Экспорт готов");
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      await importSnapshot(JSON.parse(text));
      markDatabaseInitialized();
      setProductDraft(null);
      setGroupDraft(null);
      setReceiptDraft(null);
      setWriteOffDraft(null);
      setExpenseDraft(null);
      resetEntireCheckout(undefined);
      showToast("Импорт завершен");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не удалось импортировать файл");
    } finally {
      event.target.value = "";
    }
  };

  const clearSalesHistory = async () => {
    const profileSales = await db.sales.where("profileId").equals(activeProfileId).toArray();

    await db.transaction("rw", db.sales, db.products, db.stockGroups, async () => {
      for (const sale of profileSales) {
        if (sale.stockGroupId) {
          const group = await db.stockGroups.get(sale.stockGroupId);
          if (group) {
            await db.stockGroups.put({
              ...group,
              currentStock: toMoney(group.currentStock + sale.quantity),
              updatedAt: nowIso()
            });
          }
        } else {
          const product = await db.products.get(sale.productId);
          if (product) {
            await db.products.put({
              ...product,
              currentStock: toMoney(product.currentStock + sale.quantity),
              updatedAt: nowIso()
            });
          }
        }
      }

      await db.sales.bulkDelete(profileSales.map((item) => item.id));
    });

    resetEntireCheckout(selectedProduct);
    showToast("История продаж очищена");
  };

  const clearReceiptsHistory = async () => {
    const profileReceipts = await db.receipts.where("profileId").equals(activeProfileId).toArray();

    await db.transaction("rw", db.receipts, db.products, db.stockGroups, async () => {
      for (const receipt of profileReceipts) {
        if (receipt.stockGroupId) {
          const group = await db.stockGroups.get(receipt.stockGroupId);
          if (group) {
            await db.stockGroups.put({
              ...group,
              currentStock: toMoney(Math.max(0, group.currentStock - receipt.quantity)),
              updatedAt: nowIso()
            });
          }
        } else if (receipt.productId) {
          const product = await db.products.get(receipt.productId);
          if (product) {
            await db.products.put({
              ...product,
              currentStock: toMoney(Math.max(0, product.currentStock - receipt.quantity)),
              updatedAt: nowIso()
            });
          }
        }
      }

      await db.receipts.bulkDelete(profileReceipts.map((item) => item.id));
    });

    showToast("Поступления очищены");
  };

  const clearWriteOffsHistory = async () => {
    const profileWriteOffs = await db.writeOffs.where("profileId").equals(activeProfileId).toArray();

    await db.transaction("rw", db.writeOffs, db.products, db.stockGroups, async () => {
      for (const writeOff of profileWriteOffs) {
        if (writeOff.stockGroupId) {
          const group = await db.stockGroups.get(writeOff.stockGroupId);
          if (group) {
            await db.stockGroups.put({
              ...group,
              currentStock: toMoney(group.currentStock + writeOff.quantity),
              updatedAt: nowIso()
            });
          }
        } else if (writeOff.productId) {
          const product = await db.products.get(writeOff.productId);
          if (product) {
            await db.products.put({
              ...product,
              currentStock: toMoney(product.currentStock + writeOff.quantity),
              updatedAt: nowIso()
            });
          }
        }
      }

      await db.writeOffs.bulkDelete(profileWriteOffs.map((item) => item.id));
    });

    showToast("Списания очищены");
  };

  const clearExpensesHistory = async () => {
    const profileExpenses = await db.expenses.where("profileId").equals(activeProfileId).primaryKeys();
    await db.expenses.bulkDelete(profileExpenses);
    showToast("Расходы очищены");
  };

  const loadDemoData = async () => {
    requestDemoSeed();
    await db.delete();
    window.location.reload();
  };

  const clearAllData = async () => {
    markDatabaseInitialized();
    await db.transaction("rw", db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
      const timestamp = nowIso();
      await db.bazaarLocations.bulkPut(createDefaultBazaarLocations(timestamp));
      await db.storeProfiles.put(createDefaultProfile(timestamp));
      await db.appSettings.put({ ...defaultSettings, activeProfileId: DEFAULT_PROFILE_ID, updatedAt: timestamp });
    });
    resetEntireCheckout(undefined);
    setProductDraft(null);
    setGroupDraft(null);
    setReceiptDraft(null);
    setWriteOffDraft(null);
    setExpenseDraft(null);
    showToast("Все данные очищены");
  };

  const saveSettings = async (patch: Partial<AppSettings>) => {
    await db.appSettings.put({
      ...settings,
      ...patch,
      updatedAt: nowIso()
    });
  };

  const selectProfile = async (profileId: string) => {
    const profile = storeProfiles.find((item) => item.id === profileId && !item.isArchived);
    if (!profile || profileId === activeProfileId) {
      return;
    }
    await saveSettings({ activeProfileId: profileId });
    showToast(`Открыт профиль «${profile.name}»`);
  };

  const saveProfile = async () => {
    if (!profileDraft) {
      return;
    }
    const location = bazaarLocations.find(
      (item) => item.id === profileDraft.bazaarLocationId && !item.isArchived
    );
    if (!profileDraft.name.trim() || !location) {
      showToast("Введите название и выберите сохраненный базар");
      return;
    }
    const isNew = !storeProfiles.some((profile) => profile.id === profileDraft.id);
    await db.storeProfiles.put({
      ...profileDraft,
      name: profileDraft.name.trim(),
      bazaarLocationId: location.id,
      city: location.city,
      marketName: location.marketName,
      pointName: location.pointName,
      updatedAt: nowIso()
    });
    setProfileDraft(null);
    if (isNew) {
      await saveSettings({ activeProfileId: profileDraft.id });
    }
    showToast(isNew ? "Профиль газели создан" : "Профиль обновлен");
  };

  const saveBazaarLocation = async () => {
    if (!bazaarLocationDraft) {
      return;
    }
    if (!bazaarLocationDraft.city.trim() || !bazaarLocationDraft.marketName.trim()) {
      showToast("Заполните город и название базара");
      return;
    }
    const timestamp = nowIso();
    const location: BazaarLocation = {
      ...bazaarLocationDraft,
      city: bazaarLocationDraft.city.trim(),
      marketName: bazaarLocationDraft.marketName.trim(),
      pointName: bazaarLocationDraft.pointName.trim(),
      updatedAt: timestamp
    };
    await db.transaction("rw", db.bazaarLocations, db.storeProfiles, async () => {
      await db.bazaarLocations.put(location);
      const linkedProfiles = await db.storeProfiles.where("bazaarLocationId").equals(location.id).toArray();
      await db.storeProfiles.bulkPut(
        linkedProfiles.map((profile) => ({
          ...profile,
          city: location.city,
          marketName: location.marketName,
          pointName: location.pointName,
          updatedAt: timestamp
        }))
      );
    });
    setBazaarLocationDraft(null);
    showToast("Базар сохранен");
  };

  const addQuickPreset = async (type: "weight" | "amount", rawValue: string) => {
    const value = parseNumber(rawValue);
    if (value <= 0) {
      showToast(type === "weight" ? "Введите вес больше нуля" : "Введите сумму больше нуля");
      return;
    }
    if (quickButtons.some((button) => button.type === type && button.value === value)) {
      showToast("Такое быстрое значение уже есть");
      return;
    }
    const timestamp = nowIso();
    await db.quickButtonSettings.put({
      id: makeId(`quick_${type}`),
      type,
      value,
      label: type === "weight" ? `${formatWeight(value, settings.weightPrecision)} кг` : `${formatMoney(value)} ₽`,
      order: quickButtons.reduce((max, button) => Math.max(max, button.order), -1) + 1,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    if (type === "weight") {
      setNewWeightPreset("");
    } else {
      setNewAmountPreset("");
    }
    showToast("Быстрое значение добавлено");
  };

  const deleteQuickPreset = async (button: QuickButtonSetting) => {
    await db.quickButtonSettings.delete(button.id);
    showToast("Быстрое значение удалено");
  };

  if (startupError) {
    return (
      <div className="app-shell">
        <section className="section">
          <div className="eyebrow">Ошибка локальной базы</div>
          <h1>Не удалось открыть данные</h1>
          <p className="muted">{startupError}</p>
          <p className="muted">Чаще всего это связано с ограничением IndexedDB или старым кэшем Safari.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-title">
          <div className="eyebrow">WayYaam касса · смена открыта</div>
          <h1>{screen === "sale" ? "Касса" : screenLabel(screen)}</h1>
        </div>
        <label className="profile-switcher">
          <Truck size={20} aria-hidden="true" />
          <span>
            <strong>{activeProfile?.name ?? "Профиль газели"}</strong>
            <small>{profileLocationLabel(activeProfile)}</small>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
          <select
            aria-label="Выбрать профиль газели"
            value={activeProfileId}
            onChange={(event) => void selectProfile(event.target.value)}
          >
            {storeProfiles.filter((profile) => !profile.isArchived).map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} — {profile.city} · {profile.marketName}
              </option>
            ))}
          </select>
        </label>
        <button className="daily-expense-chip" type="button" onClick={() => setScreen("expenses")}>
          <span>Расходы сегодня</span>
          <strong>{formatMoney(todayExpenseTotal)} ₽</strong>
        </button>
        <button className="icon-button" type="button" aria-label="Сбросить текущий ввод" title="Сбросить текущий ввод" onClick={() => resetSale()}>
          <RotateCcw size={20} />
        </button>
      </header>

      <main className="content">
        {screen === "sale" && (
          <div className="sale-workspace">
            <Section className="ribbon-section sale-catalog">
              <div className="section-header">
                <div>
                  <div className="eyebrow">Каталог магазина</div>
                  <h2>Товары</h2>
                </div>
                <span>{filteredProductViews.length} из {productViews.length}</span>
              </div>
              <div className="catalog-controls">
                <label className="search-box">
                  <Search size={20} aria-hidden="true" />
                  <input
                    value={productQuery}
                    type="search"
                    aria-label="Поиск по товарам"
                    placeholder="Поиск по товарам"
                    onChange={(event) => setProductQuery(event.target.value)}
                  />
                </label>
                <div className="category-row" aria-label="Категории товаров">
                  {productCategories.map((category) => (
                    <button
                      key={category}
                      className={`category-chip ${selectedCategory === category ? "active" : ""}`}
                      type="button"
                      aria-pressed={selectedCategory === category}
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              <div className="product-ribbon">
                {filteredProductViews.map((product) => (
                  <button
                    key={product.id}
                    className={`product-chip ${product.id === selectedProductId ? "active" : ""}`}
                    type="button"
                    onClick={() => chooseProduct(product.id)}
                  >
                    <span className="product-chip-visual" aria-hidden="true">{productEmoji(product.displayName)}</span>
                    <span className="product-chip-copy">
                      <span className="product-chip-category">{product.category}</span>
                      <strong>{product.displayName}</strong>
                      <span className="product-chip-price">{formatMoney(product.defaultSalePrice)} ₽/{unitLabel(product.unit)}</span>
                      <span className="product-chip-stock">{getProductStockSubtitle(product)}</span>
                    </span>
                  </button>
                ))}
                {filteredProductViews.length === 0 ? (
                  <EmptyState title="Товары не найдены" text="Измените запрос или выберите другую категорию." />
                ) : null}
              </div>
            </Section>

            <div ref={saleCheckoutRef} className="sale-checkout-column">
              <Section className="sale-focus">
              <div className="sale-head">
                <div>
                  <div className="eyebrow">Выбран товар</div>
                  <h2>{selectedProduct?.displayName ?? "Нет товара"}</h2>
                  <p className="muted">
                    {hasUnlimitedStock(selectedProduct)
                      ? "Продажа без ограничения остатка"
                      : selectedProduct?.sharedStockName
                        ? `Общий остаток: ${formatQuantity(selectedProduct.availableStock, selectedProduct.unit, settings.weightPrecision)}`
                        : `Остаток: ${formatQuantity(selectedProduct?.availableStock ?? 0, selectedUnit, settings.weightPrecision)}`}
                  </p>
                </div>
                <button
                  className="price-badge"
                  type="button"
                  title="Изменить цену только для этого клиента"
                  onClick={() => openKeypad("salePrice", "Цена для клиента", saleEditor.salePrice, "₽")}
                >
                  <span>ЦЕНА</span>
                  <strong>{formatMoney(saleEditor.salePrice)} ₽/{unitLabel(selectedUnit)}</strong>
                </button>
              </div>

              <div className="mode-grid">
                <div className="mode-card">
                  <button
                    className={`mode-tile ${saleEditor.mode === "by_weight" ? "active" : ""}`}
                    type="button"
                    onClick={() => openKeypad("quantity", isPieceSelected ? "Введите количество" : "Введите вес", saleEditor.requestedQuantity ?? "", unitLabel(selectedUnit))}
                  >
                    <span>{isPieceSelected ? "ПО КОЛИЧЕСТВУ" : "ПО ВЕСУ"}</span>
                    <strong>{saleEditor.requestedQuantity ? formatQuantity(saleEditor.requestedQuantity, selectedUnit, settings.weightPrecision) : `Ввести ${unitLabel(selectedUnit)}`}</strong>
                  </button>
                  <div className="mode-presets" aria-label={isPieceSelected ? "Быстрый выбор количества" : "Быстрый выбор веса"}>
                    {weightQuickButtons.map((button) => (
                      <button key={button.id} className="preset-chip" type="button" onClick={() => quickApply(button)}>
                        {isPieceSelected ? `${formatMoney(Math.max(1, Math.floor(button.value)))} шт` : button.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mode-card">
                  <button
                    className={`mode-tile ${saleEditor.mode === "by_amount" ? "active" : ""}`}
                    type="button"
                    onClick={() => openKeypad("totalAmount", "Введите сумму", saleEditor.requestedAmount, "₽")}
                  >
                    <span>НА СУММУ</span>
                    <strong>{saleEditor.requestedAmount > 0 ? `${formatMoney(saleEditor.requestedAmount)} ₽` : "Ввести ₽"}</strong>
                  </button>
                  <div className="mode-presets" aria-label="Быстрый выбор суммы">
                    {amountQuickButtons.map((button) => (
                      <button key={button.id} className="preset-chip" type="button" onClick={() => quickApply(button)}>
                        {button.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="result-panel">
                <MetricCard label="Товар" value={selectedProduct?.displayName ?? "Нет"} />
                <MetricCard
                  label="Запрос клиента"
                  value={
                    saleEditor.mode === "by_weight" && saleEditor.requestedQuantity
                      ? `${formatQuantity(saleEditor.requestedQuantity, selectedUnit, settings.weightPrecision)} = ${formatMoney(saleEditor.requestedAmount)} ₽`
                      : `${formatMoney(saleEditor.requestedAmount)} ₽`
                  }
                />
                <MetricCard
                  label="Фактически получилось"
                  value={`${formatMoney(saleEditor.finalTotalAmount)} ₽`}
                  buttonLabel={isPieceSelected ? undefined : "Ввести результат"}
                  onClick={isPieceSelected ? undefined : () => openKeypad("actualAmount", "Фактическая сумма", saleEditor.finalTotalAmount, "₽")}
                  accent="primary"
                />
                <MetricCard
                  label="Разница к запросу"
                  value={formatSignedMoney(saleEditor.differenceAmount)}
                  accent={saleEditor.differenceAmount < 0 ? "danger" : saleEditor.differenceAmount > 0 ? "attention" : undefined}
                />
                <MetricCard label={isPieceSelected ? "Количество" : "Вес фактически"} value={formatQuantity(saleEditor.quantity, selectedUnit, settings.weightPrecision)} />
                <MetricCard
                  label="Цена"
                  value={`${formatMoney(saleEditor.salePrice)} ₽/${unitLabel(selectedUnit)}`}
                  onClick={() => openKeypad("salePrice", "Цена для клиента", saleEditor.salePrice, "₽")}
                />
                {saleEditor.discountAmount ? (
                  <>
                    <MetricCard label="Было" value={`${formatMoney(saleEditor.originalTotalAmount)} ₽`} />
                    <MetricCard label="Скидка" value={`-${formatMoney(saleEditor.discountAmount)} ₽`} accent="danger" />
                  </>
                ) : null}
              </div>

              {currentPriceChanged ? (
                <div className={`price-status ${currentPriceDiscountAmount > 0 ? "discounted" : "changed"}`}>
                  <strong>{currentPriceDiscountAmount > 0 ? "Скидочная цена" : "Цена изменена"}</strong>
                  <span>
                    Было {formatMoney(currentOriginalSalePrice)} ₽/{unitLabel(selectedUnit)}
                    {currentPriceDiscountAmount > 0 ? ` · скидка по цене ${formatMoney(currentPriceDiscountAmount)} ₽` : ""}
                  </span>
                </div>
              ) : null}

              <div className="quick-actions">
                <ActionButton onClick={() => setToolPanel((current) => (current === "discount" ? null : "discount"))}>Скидка</ActionButton>
                <ActionButton onClick={() => setToolPanel((current) => (current === "change" ? null : "change"))}>Оплата и сдача</ActionButton>
                <button className="primary-button checkout-add-button" type="button" onClick={addCurrentItemToCart}>
                  В чек
                </button>
                <button
                  className="danger-button reset-sale-button"
                  type="button"
                  onClick={() => {
                    resetEntireCheckout(selectedProduct);
                  }}
                >
                  Сбросить все
                </button>
              </div>

              {toolPanel === "discount" && (
                <Panel title="Скидка">
                  <div className="quick-button-row">
                    <button className="quick-pill" type="button" onClick={() => setSaleEditor((current) => applyDiscount(current, "amount", 10, settings.weightPrecision))}>
                      -10 ₽
                    </button>
                    <button className="quick-pill" type="button" onClick={() => setSaleEditor((current) => applyDiscount(current, "amount", 20, settings.weightPrecision))}>
                      -20 ₽
                    </button>
                    <button className="quick-pill" type="button" onClick={() => setSaleEditor((current) => applyDiscount(current, "amount", 50, settings.weightPrecision))}>
                      -50 ₽
                    </button>
                    <button className="quick-pill" type="button" onClick={() => setSaleEditor((current) => applyDiscount(current, "percent", 5, settings.weightPrecision))}>
                      -5%
                    </button>
                    <button className="quick-pill" type="button" onClick={() => setSaleEditor((current) => applyDiscount(current, "percent", 10, settings.weightPrecision))}>
                      -10%
                    </button>
                  </div>
                  <div className="panel-actions">
                    <button className="secondary-button" type="button" onClick={() => openKeypad("discountAmount", "Скидка", saleEditor.discountValue ?? "", "₽")}>
                      Ввести ₽
                    </button>
                    <button className="secondary-button" type="button" onClick={() => openKeypad("discountPercent", "Скидка", saleEditor.discountValue ?? "", "%")}>
                      Ввести %
                    </button>
                    <button className="ghost-button" type="button" onClick={() => setSaleEditor((current) => clearDiscount(current, settings.weightPrecision))}>
                      Сбросить скидку
                    </button>
                  </div>
                </Panel>
              )}

              {toolPanel === "change" && (
                <Panel title="Расчет сдачи">
                  <div className="change-grid">
                    <MetricCard label="К оплате" value={`${formatMoney(checkoutTotal)} ₽`} accent="primary" />
                    <MetricCard label="Получено" value={`${formatMoney(receivedAmount)} ₽`} />
                    <MetricCard label="Сдача" value={`${formatMoney(checkoutChange)} ₽`} accent="primary" />
                  </div>
                  <div className="panel-actions">
                    <button className="secondary-button" type="button" onClick={() => openKeypad("receivedAmount", "Получено", receivedAmount || "", "₽")}>
                      Ввести сумму
                    </button>
                  </div>
                </Panel>
              )}

              {saleCart.length > 0 && <Panel title="Чек">
                <div className="section-header">
                  <h3>Позиции</h3>
                  <strong>{formatMoney(checkoutTotal)} ₽</strong>
                </div>
                  <div className="list-stack">
                    {saleCart.map((line) => (
                      <ListCard
                        key={line.id}
                        title={line.productName}
                        subtitle={`${formatQuantity(line.quantity, line.unit, settings.weightPrecision)} × ${formatMoney(line.salePrice)} ₽`}
                        meta={`Запрос ${formatMoney(line.requestedAmount)} ₽ · разница ${formatSignedMoney(line.differenceAmount)}${line.priceDiscountAmount ? ` · скидочная цена ${formatMoney(line.priceDiscountAmount)} ₽` : ""}${line.discountAmount ? ` · скидка ${formatMoney(line.discountAmount)} ₽` : ""}`}
                        side={`${formatMoney(line.finalTotalAmount)} ₽`}
                        actions={
                          <button className="ghost-button danger" type="button" onClick={() => removeCartLine(line.id)}>
                            <Trash2 size={16} /> Убрать
                          </button>
                        }
                      />
                    ))}
                  </div>
              </Panel>}

              <NumberPad
                keypad={keypad}
                price={saleEditor.salePrice}
                amount={saleEditor.requestedAmount}
                quantity={saleEditor.requestedQuantity ?? saleEditor.quantity}
                unit={selectedUnit}
                weightPrecision={settings.weightPrecision}
                onAppend={appendKey}
                onBackspace={backspaceKey}
                onClear={clearKeypad}
                onSubmit={submitKeypad}
                onClose={() => setKeypad(null)}
                onSelectParameter={(field) => {
                  if (field === "salePrice") {
                    openKeypad("salePrice", "Цена для клиента", saleEditor.salePrice, "₽");
                  } else if (field === "totalAmount") {
                    openKeypad("totalAmount", "Введите сумму", saleEditor.requestedAmount, "₽");
                  } else {
                    openKeypad(
                      "quantity",
                      isPieceSelected ? "Введите количество" : "Введите вес",
                      saleEditor.requestedQuantity ?? saleEditor.quantity,
                      unitLabel(selectedUnit)
                    );
                  }
                }}
              />
              </Section>

              <div className="sell-bar">
                <button className="sell-button" type="button" onClick={() => void persistSale()} disabled={isSavingSale}>
                  {isSavingSale
                    ? "СОХРАНЕНИЕ..."
                    : `ЗАВЕРШИТЬ ПРОДАЖУ ${checkoutTotal > 0 ? `· ${formatMoney(checkoutTotal)} ₽` : ""}`.trim()}
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === "products" && (
          <>
            <Section>
              <div className="section-header">
                <h2>Товары</h2>
                <button className="primary-button" type="button" onClick={() => setProductDraft(emptyProductDraft(activeProfileId))}>
                  <Plus size={18} /> Добавить
                </button>
              </div>
              {productDraft && (
                <EditorCard
                  title={products.some((item) => item.id === productDraft.id) ? "Редактировать товар" : "Новый товар"}
                  onCancel={() => setProductDraft(null)}
                  onSave={() => void saveProduct()}
                >
                  <Field label="Название">
                    <input value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })} />
                  </Field>
                  <Field label="Вариант / цвет">
                    <input value={productDraft.variant} onChange={(event) => setProductDraft({ ...productDraft, variant: event.target.value })} />
                  </Field>
                  <Field label="Категория">
                    <input value={productDraft.category} onChange={(event) => setProductDraft({ ...productDraft, category: event.target.value })} />
                  </Field>
                  <Field label="Продажа">
                    <select
                      value={productDraft.unit}
                      onChange={(event) => {
                        const unit = event.target.value as Unit;
                        setProductDraft({
                          ...productDraft,
                          unit,
                          stockGroupId: stockGroups.some((group) => group.id === productDraft.stockGroupId && group.unit === unit)
                            ? productDraft.stockGroupId
                            : undefined
                        });
                      }}
                    >
                      <option value="kg">По весу, кг</option>
                      <option value="piece">Поштучно, шт</option>
                    </select>
                  </Field>
                  <Field label="Цена продажи">
                    <input inputMode="decimal" value={String(productDraft.defaultSalePrice || "")} onChange={(event) => setProductDraft({ ...productDraft, defaultSalePrice: parseNumber(event.target.value) })} />
                  </Field>
                  <Field label="Связать с общей партией">
                    <select
                      value={productDraft.stockGroupId ?? ""}
                      onChange={(event) =>
                        setProductDraft({
                          ...productDraft,
                          stockGroupId: event.target.value || undefined,
                          isUnlimitedStock: event.target.value ? false : productDraft.isUnlimitedStock
                        })
                      }
                    >
                      <option value="">Без общей партии</option>
                      {stockGroups.filter((group) => group.unit === productDraft.unit).map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {!productDraft.stockGroupId && (
                    <>
                      <Field label="Режим остатка">
                        <button
                          className={productDraft.isUnlimitedStock ? "primary-button" : "secondary-button"}
                          type="button"
                          onClick={() => setProductDraft({ ...productDraft, isUnlimitedStock: !productDraft.isUnlimitedStock })}
                        >
                          {productDraft.isUnlimitedStock ? "∞ Без ограничения" : "Включить ∞ бесконечность"}
                        </button>
                      </Field>
                      <Field label="Текущий остаток">
                        <input
                          inputMode="decimal"
                          value={productDraft.isUnlimitedStock ? "" : String(productDraft.currentStock || "")}
                          placeholder={productDraft.isUnlimitedStock ? "∞" : "0"}
                          disabled={productDraft.isUnlimitedStock}
                          onChange={(event) => setProductDraft({ ...productDraft, currentStock: parseNumber(event.target.value) })}
                        />
                      </Field>
                      <Field label="Средняя себестоимость">
                        <input inputMode="decimal" value={String(productDraft.averageCost || "")} onChange={(event) => setProductDraft({ ...productDraft, averageCost: parseNumber(event.target.value) })} />
                      </Field>
                    </>
                  )}
                  <Field label="Заметка">
                    <textarea value={productDraft.notes} onChange={(event) => setProductDraft({ ...productDraft, notes: event.target.value })} />
                  </Field>
                </EditorCard>
              )}
              <div className="list-stack">
                {productViews.map((product) => (
                  <ListCard
                    key={product.id}
                    title={product.displayName}
                    subtitle={`${formatMoney(product.defaultSalePrice)} ₽/${unitLabel(product.unit)}`}
                    meta={getProductStockMeta(product)}
                    side={getProductStockSide(product)}
                    actions={
                      <>
                        <button className="ghost-button" type="button" onClick={() => setProductDraft({ ...products.find((item) => item.id === product.id)! })}>
                          Изменить
                        </button>
                        <button
                          className="ghost-button danger"
                          type="button"
                          onClick={() =>
                            setConfirm({
                              title: "Убрать товар в архив?",
                              text: product.displayName,
                              action: () => archiveProduct(products.find((item) => item.id === product.id)!)
                            })
                          }
                        >
                          <Archive size={16} />
                        </button>
                      </>
                    }
                  />
                ))}
              </div>
            </Section>
          </>
        )}

        {screen === "groups" && (
          <Section>
            <div className="section-header">
              <h2>Общие партии</h2>
              <button className="primary-button" type="button" onClick={() => setGroupDraft(emptyGroupDraft(activeProfileId))}>
                <Plus size={18} /> Добавить
              </button>
            </div>
            {groupDraft && (
              <EditorCard title="Партия остатка" onCancel={() => setGroupDraft(null)} onSave={() => void saveGroup()}>
                <Field label="Название">
                  <input value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} />
                </Field>
                <Field label="Текущий остаток">
                  <input inputMode="decimal" value={String(groupDraft.currentStock || "")} onChange={(event) => setGroupDraft({ ...groupDraft, currentStock: parseNumber(event.target.value) })} />
                </Field>
                <Field label="Единица">
                  <select value={groupDraft.unit} onChange={(event) => setGroupDraft({ ...groupDraft, unit: event.target.value as Unit })}>
                    <option value="kg">Килограммы</option>
                    <option value="piece">Штуки</option>
                  </select>
                </Field>
                <Field label="Средняя себестоимость">
                  <input inputMode="decimal" value={String(groupDraft.averageCost || "")} onChange={(event) => setGroupDraft({ ...groupDraft, averageCost: parseNumber(event.target.value) })} />
                </Field>
                <Field label="Заметка">
                  <textarea value={groupDraft.notes} onChange={(event) => setGroupDraft({ ...groupDraft, notes: event.target.value })} />
                </Field>
              </EditorCard>
            )}
            <div className="list-stack">
              {stockGroups.map((group) => (
                <ListCard
                  key={group.id}
                  title={group.name}
                  subtitle={`Остаток ${formatQuantity(group.currentStock, group.unit, settings.weightPrecision)}`}
                  meta={`Связанные товары: ${products.filter((item) => item.stockGroupId === group.id && !item.isArchived).map((item) => [item.name, item.variant].filter(Boolean).join(" ")).join(", ") || "нет"}`}
                  side={`${formatMoney(group.averageCost)} ₽/${unitLabel(group.unit)}`}
                  actions={
                    <>
                      <button className="ghost-button" type="button" onClick={() => setGroupDraft(group)}>
                        Изменить
                      </button>
                      <button
                        className="ghost-button danger"
                        type="button"
                        onClick={() =>
                          setConfirm({
                            title: "Удалить партию?",
                            text: group.name,
                            action: () => deleteGroup(group)
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          </Section>
        )}

        {screen === "receipts" && (
          <>
            <Section>
              <div className="section-header">
                <h2>Поступления</h2>
                <button className="primary-button" type="button" onClick={() => setReceiptDraft(emptyReceiptDraft(activeProfileId))}>
                  <Plus size={18} /> Поступление
                </button>
              </div>
              {receiptDraft && (
                <EditorCard title="Новое поступление" onCancel={() => setReceiptDraft(null)} onSave={() => void saveReceipt()}>
                  <Field label="Куда пришло">
                    <select value={receiptDraft.targetType} onChange={(event) => setReceiptDraft({ ...receiptDraft, targetType: event.target.value as "group" | "product", targetId: "" })}>
                      <option value="group">Общая партия</option>
                      <option value="product">Обычный товар</option>
                    </select>
                  </Field>
                  <Field label={receiptDraft.targetType === "group" ? "Партия" : "Товар"}>
                    <select value={receiptDraft.targetId} onChange={(event) => setReceiptDraft({ ...receiptDraft, targetId: event.target.value })}>
                      <option value="">Выберите</option>
                      {(receiptDraft.targetType === "group" ? stockGroups : productViews.filter((item) => !item.stockGroupId)).map((item) => (
                        <option key={item.id} value={item.id}>
                          {targetLabel(item)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Количество, ${unitLabel(receiptDraftUnit)}`}>
                    <input inputMode="decimal" value={receiptDraft.quantity} onChange={(event) => setReceiptDraft({ ...receiptDraft, quantity: event.target.value })} />
                  </Field>
                  <Field label="Цена закупки">
                    <input inputMode="decimal" value={receiptDraft.purchasePrice} onChange={(event) => setReceiptDraft({ ...receiptDraft, purchasePrice: event.target.value })} />
                  </Field>
                  <Field label="Сумма">
                    <input inputMode="decimal" value={receiptDraft.totalAmount} onChange={(event) => setReceiptDraft({ ...receiptDraft, totalAmount: event.target.value })} />
                  </Field>
                  <Field label="Источник">
                    <input value={receiptDraft.source} onChange={(event) => setReceiptDraft({ ...receiptDraft, source: event.target.value })} />
                  </Field>
                  <Field label="Комментарий">
                    <textarea value={receiptDraft.comment} onChange={(event) => setReceiptDraft({ ...receiptDraft, comment: event.target.value })} />
                  </Field>
                </EditorCard>
              )}
              <div className="list-stack">
                {receipts.map((receipt) => (
                  <ListCard
                    key={receipt.id}
                    title={receipt.stockGroupId ? stockGroups.find((group) => group.id === receipt.stockGroupId)?.name ?? "Партия" : productViewMap.get(receipt.productId ?? "")?.displayName ?? "Товар"}
                    subtitle={`${formatQuantity(receipt.quantity, receipt.stockGroupId ? stockGroupMap.get(receipt.stockGroupId)?.unit ?? "kg" : productMap.get(receipt.productId ?? "")?.unit ?? "kg", settings.weightPrecision)} × ${formatMoney(receipt.purchasePrice)} ₽`}
                    meta={`${receipt.source || "Без источника"} · ${formatDateTime(receipt.date)}`}
                    side={`${formatMoney(receipt.totalAmount)} ₽`}
                  />
                ))}
              </div>
            </Section>

            <Section>
              <div className="section-header">
                <div>
                  <div className="eyebrow">Контроль потерь</div>
                  <h2>Порча и списания</h2>
                </div>
                <button className="primary-button" type="button" onClick={() => setWriteOffDraft(emptyWriteOffDraft(activeProfileId))}>
                  <Plus size={18} /> Зафиксировать порчу
                </button>
              </div>
              {writeOffDraft && (
                <EditorCard title="Что испортилось" onCancel={() => setWriteOffDraft(null)} onSave={() => void saveWriteOff()}>
                  <Field label="Откуда списать">
                    <select value={writeOffDraft.targetType} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, targetType: event.target.value as "group" | "product", targetId: "" })}>
                      <option value="group">Общая партия</option>
                      <option value="product">Обычный товар</option>
                    </select>
                  </Field>
                  <Field label={writeOffDraft.targetType === "group" ? "Партия" : "Товар"}>
                    <select value={writeOffDraft.targetId} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, targetId: event.target.value })}>
                      <option value="">Выберите</option>
                      {(writeOffDraft.targetType === "group" ? stockGroups : productViews.filter((item) => !item.stockGroupId)).map((item) => (
                        <option key={item.id} value={item.id}>
                          {targetLabel(item)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Как считать">
                    <select
                      value={writeOffDraft.inputMode}
                      onChange={(event) =>
                        setWriteOffDraft({
                          ...writeOffDraft,
                          inputMode: event.target.value as "weight" | "packages"
                        })
                      }
                    >
                      <option value="weight">{writeOffDraftUnit === "piece" ? "По количеству" : "По точному весу"}</option>
                      <option value="packages">Мешками / упаковками</option>
                    </select>
                  </Field>
                  {writeOffDraft.inputMode === "weight" ? (
                    <Field label={`Испорчено, ${unitLabel(writeOffDraftUnit)}`}>
                      <input inputMode="decimal" value={writeOffDraft.quantity} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, quantity: event.target.value })} />
                    </Field>
                  ) : (
                    <>
                      <Field label="Вид упаковки">
                        <select value={writeOffDraft.packageLabel} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, packageLabel: event.target.value })}>
                          <option value="мешок">Мешок</option>
                          <option value="ящик">Ящик</option>
                          <option value="коробка">Коробка</option>
                          <option value="упаковка">Упаковка</option>
                        </select>
                      </Field>
                      <Field label="Количество упаковок">
                        <input inputMode="decimal" value={writeOffDraft.packageCount} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, packageCount: event.target.value })} />
                      </Field>
                      <Field label={`${writeOffDraftUnit === "piece" ? "Количество" : "Вес"} одной упаковки, ${unitLabel(writeOffDraftUnit)}`}>
                        <input inputMode="decimal" value={writeOffDraft.packageWeight} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, packageWeight: event.target.value })} />
                      </Field>
                      <div className="spoilage-preview">
                        <span>Итого будет списано</span>
                        <strong>
                          {formatQuantity(
                            calculateWriteOffQuantity(
                              "packages",
                              0,
                              parseNumber(writeOffDraft.packageCount),
                              parseNumber(writeOffDraft.packageWeight),
                              settings.weightPrecision
                            ),
                            writeOffDraftUnit,
                            settings.weightPrecision
                          )}
                        </strong>
                      </div>
                    </>
                  )}
                  <Field label="Причина">
                    <select value={writeOffDraft.reason} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, reason: event.target.value })}>
                      <option value="Порча">Порча</option>
                      <option value="Брак">Брак</option>
                      <option value="Усушка">Усушка</option>
                      <option value="Истек срок">Истек срок</option>
                      <option value="Повреждение">Повреждение</option>
                      <option value="Другое">Другое</option>
                    </select>
                  </Field>
                  <Field label="Что произошло / детали">
                    <textarea value={writeOffDraft.comment} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, comment: event.target.value })} />
                  </Field>
                </EditorCard>
              )}
              <div className="list-stack">
                {writeOffs.map((item) => (
                  <ListCard
                    key={item.id}
                    title={item.stockGroupId ? stockGroups.find((group) => group.id === item.stockGroupId)?.name ?? "Партия" : productViewMap.get(item.productId ?? "")?.displayName ?? "Товар"}
                    subtitle={
                      item.inputMode === "packages" && item.packageCount
                        ? `${formatMoney(item.packageCount)} ${formatPackageLabel(item.packageLabel, item.packageCount)} × ${formatQuantity(item.packageWeight ?? 0, item.stockGroupId ? stockGroupMap.get(item.stockGroupId)?.unit ?? "kg" : productMap.get(item.productId ?? "")?.unit ?? "kg", settings.weightPrecision)} = ${formatQuantity(item.quantity, item.stockGroupId ? stockGroupMap.get(item.stockGroupId)?.unit ?? "kg" : productMap.get(item.productId ?? "")?.unit ?? "kg", settings.weightPrecision)}`
                        : formatQuantity(item.quantity, item.stockGroupId ? stockGroupMap.get(item.stockGroupId)?.unit ?? "kg" : productMap.get(item.productId ?? "")?.unit ?? "kg", settings.weightPrecision)
                    }
                    meta={`${item.reason} · ${formatDateTime(item.date)}`}
                    side={`${formatMoney(item.costAmount)} ₽`}
                  />
                ))}
              </div>
            </Section>
          </>
        )}

        {screen === "writeOffs" && <Section><h2>Списания</h2></Section>}

        {screen === "expenses" && (
          <Section>
            <div className="section-header">
              <div>
                <div className="eyebrow">{activeProfile?.name} · {activeProfile?.city}</div>
                <h2>Ежедневные расходы</h2>
              </div>
              <button className="primary-button" type="button" onClick={() => setExpenseDraft(emptyExpenseDraft(activeProfileId))}>
                <Plus size={18} /> Добавить
              </button>
            </div>
            <div className="stats-grid daily-expense-grid">
              <StatCard icon={<Wallet size={20} />} label="Всего сегодня" value={`${formatMoney(todayExpenseTotal)} ₽`} />
              <StatCard icon={<Store size={20} />} label="Аренда" value={`${formatMoney(todayExpenseByCategory["Аренда"] ?? 0)} ₽`} />
              <StatCard icon={<Receipt size={20} />} label="Обед" value={`${formatMoney(todayExpenseByCategory["Обед"] ?? 0)} ₽`} />
              <StatCard icon={<Truck size={20} />} label="Транспорт" value={`${formatMoney(todayExpenseByCategory["Транспорт"] ?? 0)} ₽`} />
            </div>
            {expenseDraft && (
              <EditorCard title="Расход" onCancel={() => setExpenseDraft(null)} onSave={() => void saveExpense()}>
                <Field label="Категория">
                  <select value={expenseDraft.category} onChange={(event) => setExpenseDraft({ ...expenseDraft, category: event.target.value })}>
                    <option value="Аренда">Аренда места</option>
                    <option value="Обед">Обед</option>
                    <option value="Транспорт">Транспорт / топливо</option>
                    <option value="Погрузка">Погрузка / разгрузка</option>
                    <option value="Упаковка">Пакеты и упаковка</option>
                    <option value="Прочее">Прочее</option>
                  </select>
                </Field>
                <Field label="Сумма">
                  <input inputMode="decimal" value={String(expenseDraft.amount || "")} onChange={(event) => setExpenseDraft({ ...expenseDraft, amount: parseNumber(event.target.value) })} />
                </Field>
                <Field label="Комментарий">
                  <textarea value={expenseDraft.comment} onChange={(event) => setExpenseDraft({ ...expenseDraft, comment: event.target.value })} />
                </Field>
              </EditorCard>
            )}
            <div className="list-stack">
              {expenses.map((expense) => (
                <ListCard
                  key={expense.id}
                  title={expense.category}
                  subtitle={expense.comment || "Расход"}
                  meta={formatDateTime(expense.date)}
                  side={`${formatMoney(expense.amount)} ₽`}
                  actions={
                    <>
                      <button className="ghost-button" type="button" onClick={() => setExpenseDraft(expense)}>
                        Изменить
                      </button>
                      <button
                        className="ghost-button danger"
                        type="button"
                        onClick={() =>
                          setConfirm({
                            title: "Удалить расход?",
                            text: `${expense.category} · ${formatMoney(expense.amount)} ₽`,
                            action: () => deleteExpense(expense)
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          </Section>
        )}

        {screen === "history" && (
          <Section>
            <div className="section-header">
              <h2>История операций</h2>
              <div className="range-row">
                {[
                  ["today", "Сегодня"],
                  ["7d", "7 дней"],
                  ["30d", "30 дней"],
                  ["all", "Все"]
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`range-chip ${historyRange === value ? "active" : ""}`}
                    type="button"
                    onClick={() => setHistoryRange(value as "today" | "7d" | "30d" | "all")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="list-stack">
              {historyItems.length === 0 ? (
                <EmptyState title="Пока нет операций" text="Добавьте продажу, поступление, расход или списание." />
              ) : (
                historyItems.map((item) => (
                  <ListCard
                    key={`${item.type}_${item.id}`}
                    title={item.title}
                    subtitle={item.subtext}
                    meta={`${historyTypeLabel(item.type)} · ${formatDateTime(item.date)}`}
                    side={`${formatMoney(item.amount)} ₽`}
                  />
                ))
              )}
            </div>
          </Section>
        )}

        {screen === "reports" && (
          <>
            <Section>
              <div className="section-header">
                <div>
                  <div className="eyebrow">По локальным данным</div>
                  <h2>Аналитика</h2>
                </div>
                <div className="analytics-actions">
                  <button className="secondary-button compact-button" type="button" onClick={() => void shareAnalytics()}>
                    <Share2 size={17} /> Поделиться
                  </button>
                  <div className="range-row">
                    {[
                      ["today", "Сегодня"],
                      ["7d", "7 дней"],
                      ["30d", "30 дней"],
                      ["all", "Все"]
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        className={`range-chip ${analyticsRange === value ? "active" : ""}`}
                        type="button"
                        onClick={() => setAnalyticsRange(value as "today" | "7d" | "30d" | "all")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="stats-grid">
                <StatCard icon={<Wallet size={20} />} label="Ровно по запросу" value={`${formatMoney(report.requestedRevenue)} ₽`} />
                <StatCard icon={<TrendingUp size={20} />} label="Фактически получили" value={`${formatMoney(report.revenue)} ₽`} />
                <StatCard
                  icon={<Calculator size={20} />}
                  label={`Разница · ${formatCountWithNoun(report.adjustedSalesCount, ["продажа", "продажи", "продаж"])}`}
                  value={formatSignedMoney(report.differenceRevenue)}
                />
                <StatCard icon={<Wallet size={20} />} label="Скидочные продажи" value={String(report.discountedSalesCount)} />
                <StatCard icon={<Receipt size={20} />} label="Закупка" value={`${formatMoney(report.purchase)} ₽`} />
                <StatCard icon={<Boxes size={20} />} label="Себестоимость продаж" value={`${formatMoney(report.cogs)} ₽`} />
                <StatCard icon={<ClipboardList size={20} />} label="Расходы" value={`${formatMoney(report.expenses)} ₽`} />
                <StatCard icon={<Archive size={20} />} label="Списания" value={`${formatMoney(report.writeOffs)} ₽`} />
                <StatCard icon={<Boxes size={20} />} label="Остатки" value={`${formatMoney(report.stockValue)} ₽`} />
                <StatCard icon={<TrendingUp size={20} />} label="Прибыль" value={`${formatMoney(report.profit)} ₽`} />
              </div>
            </Section>

            <Section>
              <div className="section-header">
                <div>
                  <div className="eyebrow">Потери за период</div>
                  <h2>Порча и списания</h2>
                </div>
                <span>{formatMoney(report.writeOffs)} ₽ себестоимости</span>
              </div>
              <div className="stats-grid spoilage-stats">
                <StatCard icon={<Archive size={20} />} label="Случаев" value={String(report.writeOffIncidents)} />
                <StatCard icon={<Boxes size={20} />} label="Испорчено, кг" value={formatWeight(report.writeOffWeightQuantity, settings.weightPrecision)} />
                {report.writeOffPieceQuantity > 0 ? (
                  <StatCard icon={<Package size={20} />} label="Испорчено, шт" value={formatMoney(report.writeOffPieceQuantity)} />
                ) : null}
                <StatCard icon={<Package size={20} />} label="Упаковок / мешков" value={formatMoney(report.writeOffPackages)} />
                <StatCard icon={<Wallet size={20} />} label="Потери" value={`${formatMoney(report.writeOffs)} ₽`} />
              </div>
              <div className="list-stack">
                {report.topWriteOffs.length === 0 ? (
                  <EmptyState title="Порчи не было" text="Списания за выбранный период появятся здесь." />
                ) : (
                  report.topWriteOffs.map((item) => (
                    <ListCard
                      key={item.id}
                      title={item.name}
                      subtitle={`${formatQuantity(item.quantity, item.unit, settings.weightPrecision)}${item.packageCount > 0 ? ` · ${formatMoney(item.packageCount)} уп.` : ""}`}
                      meta={`${formatCountWithNoun(item.incidents, ["случай", "случая", "случаев"])} за выбранный период`}
                      side={`${formatMoney(item.cost)} ₽`}
                    />
                  ))
                )}
              </div>
            </Section>

            <Section>
              <div className="section-header">
                <h2>Лидеры продаж</h2>
                <span>По выручке</span>
              </div>
              <div className="list-stack">
                {report.topProducts.length === 0 ? (
                  <EmptyState title="Еще нет продаж" text="Продажи за выбранный период появятся здесь." />
                ) : (
                  report.topProducts.map((product, index) => (
                    <ListCard
                      key={product.id}
                      title={`${index + 1}. ${product.name}`}
                      subtitle={formatQuantity(product.quantity, product.unit, settings.weightPrecision)}
                      meta="Продажи за выбранный период"
                      side={`${formatMoney(product.revenue)} ₽`}
                    />
                  ))
                )}
              </div>
            </Section>

            <Section>
              <div className="section-header">
                <h2>Остатки</h2>
                <span>Актуально сейчас</span>
              </div>
              <div className="list-stack">
                {productViews.map((product) => (
                  <ListCard
                    key={product.id}
                    title={product.displayName}
                    subtitle={`${formatMoney(product.defaultSalePrice)} ₽/${unitLabel(product.unit)}`}
                    meta={getProductStockSubtitle(product)}
                    side={getProductStockSide(product)}
                  />
                ))}
              </div>
            </Section>
          </>
        )}

        {screen === "settings" && (
          <>
            <Section>
              <div className="section-header">
                <div>
                  <div className="eyebrow">Сохраните один раз</div>
                  <h2>Базары и места</h2>
                </div>
                <button className="primary-button" type="button" onClick={() => setBazaarLocationDraft(emptyBazaarLocationDraft())}>
                  <Plus size={18} /> Место
                </button>
              </div>
              {bazaarLocationDraft && (
                <EditorCard title="Базар / торговое место" onCancel={() => setBazaarLocationDraft(null)} onSave={() => void saveBazaarLocation()}>
                  <Field label="Город">
                    <input list="bazaar-city-options" value={bazaarLocationDraft.city} onChange={(event) => setBazaarLocationDraft({ ...bazaarLocationDraft, city: event.target.value })} />
                    <datalist id="bazaar-city-options">
                      {bazaarCities.map((city) => <option key={city} value={city} />)}
                    </datalist>
                  </Field>
                  <Field label="Название базара">
                    <input value={bazaarLocationDraft.marketName} placeholder="Например, Восточный базар" onChange={(event) => setBazaarLocationDraft({ ...bazaarLocationDraft, marketName: event.target.value })} />
                  </Field>
                  <Field label="Точка / ряд">
                    <input value={bazaarLocationDraft.pointName} placeholder="Например, Ряд 4 · точка 7" onChange={(event) => setBazaarLocationDraft({ ...bazaarLocationDraft, pointName: event.target.value })} />
                  </Field>
                </EditorCard>
              )}
              <div className="profile-card-grid">
                {bazaarLocations.filter((location) => !location.isArchived).map((location) => (
                  <article key={location.id} className="profile-card location-card">
                    <div className="profile-card-icon"><MapPin size={22} /></div>
                    <div className="profile-card-copy">
                      <h3>{location.marketName}</h3>
                      <p>{bazaarLocationLabel(location)}</p>
                    </div>
                    <div className="card-actions">
                      <button className="ghost-button compact-button" type="button" onClick={() => setBazaarLocationDraft({ ...location })}>Изменить</button>
                    </div>
                  </article>
                ))}
              </div>
            </Section>

            <Section>
              <div className="section-header">
                <div>
                  <div className="eyebrow">Отдельные каталоги и отчеты</div>
                  <h2>Профили газелей</h2>
                </div>
                <button className="primary-button" type="button" onClick={() => setProfileDraft(emptyProfileDraft(bazaarLocations.find((location) => !location.isArchived)))}>
                  <Plus size={18} /> Профиль
                </button>
              </div>
              {profileDraft && (
                <EditorCard title="Профиль точки" onCancel={() => setProfileDraft(null)} onSave={() => void saveProfile()}>
                  <Field label="Название профиля / газели">
                    <input value={profileDraft.name} placeholder="Например, Газель №3" onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} />
                  </Field>
                  <Field label="Сохраненный базар / место">
                    <select
                      value={profileDraft.bazaarLocationId}
                      onChange={(event) => {
                        const location = bazaarLocations.find((item) => item.id === event.target.value);
                        if (location) {
                          setProfileDraft({
                            ...profileDraft,
                            bazaarLocationId: location.id,
                            city: location.city,
                            marketName: location.marketName,
                            pointName: location.pointName
                          });
                        }
                      }}
                    >
                      <option value="">Выберите место</option>
                      {bazaarLocations.filter((location) => !location.isArchived).map((location) => (
                        <option key={location.id} value={location.id}>{bazaarLocationLabel(location)}</option>
                      ))}
                    </select>
                  </Field>
                  {bazaarLocations.length === 0 ? <p className="muted">Сначала добавьте базар выше.</p> : null}
                </EditorCard>
              )}
              <div className="profile-card-grid">
                {storeProfiles.filter((profile) => !profile.isArchived).map((profile) => (
                  <article key={profile.id} className={`profile-card ${profile.id === activeProfileId ? "active" : ""}`}>
                    <div className="profile-card-icon"><Truck size={22} /></div>
                    <div className="profile-card-copy">
                      <h3>{profile.name}</h3>
                      <p><MapPin size={15} /> {profileLocationLabel(profile)}</p>
                    </div>
                    <div className="card-actions">
                      {profile.id !== activeProfileId ? (
                        <button className="secondary-button compact-button" type="button" onClick={() => void selectProfile(profile.id)}>Открыть</button>
                      ) : (
                        <span className="active-profile-badge"><Check size={15} /> Сейчас открыт</span>
                      )}
                      <button className="ghost-button compact-button" type="button" onClick={() => setProfileDraft({ ...profile })}>Изменить</button>
                    </div>
                  </article>
                ))}
              </div>
            </Section>

            <Section>
              <div className="section-header">
                <h2>Настройки</h2>
                <span>PWA и данные</span>
              </div>
              <div className="settings-stack">
                <Field label="Тема">
                  <select value={settings.theme} onChange={(event) => void saveSettings({ theme: event.target.value as AppSettings["theme"] })}>
                    <option value="light">Светлая</option>
                    <option value="contrast">Контрастная</option>
                  </select>
                </Field>
                <Field label="Точность веса">
                  <select value={String(settings.weightPrecision)} onChange={(event) => void saveSettings({ weightPrecision: Number(event.target.value) })}>
                    <option value="2">2 знака</option>
                    <option value="3">3 знака</option>
                  </select>
                </Field>
                <div className="preset-settings">
                  <div>
                    <h3>Быстрые значения</h3>
                    <p className="muted">Для штучного товара те же значения показываются в штуках.</p>
                  </div>
                  <Field label="Добавить вес / количество">
                    <div className="inline-add-row">
                      <input
                        inputMode="decimal"
                        value={newWeightPreset}
                        placeholder="Например, 2.5"
                        onChange={(event) => setNewWeightPreset(event.target.value)}
                      />
                      <button className="primary-button" type="button" onClick={() => void addQuickPreset("weight", newWeightPreset)}>
                        <Plus size={18} /> Добавить
                      </button>
                    </div>
                  </Field>
                  <div className="editable-preset-row">
                    {weightQuickButtons.map((button) => (
                      <button key={button.id} className="editable-preset" type="button" title={`Удалить ${button.label}`} onClick={() => void deleteQuickPreset(button)}>
                        {button.label} <X size={14} />
                      </button>
                    ))}
                  </div>
                  <Field label="Добавить сумму, ₽">
                    <div className="inline-add-row">
                      <input
                        inputMode="decimal"
                        value={newAmountPreset}
                        placeholder="Например, 1000"
                        onChange={(event) => setNewAmountPreset(event.target.value)}
                      />
                      <button className="primary-button" type="button" onClick={() => void addQuickPreset("amount", newAmountPreset)}>
                        <Plus size={18} /> Добавить
                      </button>
                    </div>
                  </Field>
                  <div className="editable-preset-row">
                    {amountQuickButtons.map((button) => (
                      <button key={button.id} className="editable-preset" type="button" title={`Удалить ${button.label}`} onClick={() => void deleteQuickPreset(button)}>
                        {button.label} <X size={14} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-actions">
                  <button className="secondary-button" type="button" onClick={() => void handleExport()}>
                    <Download size={18} /> Экспорт JSON
                  </button>
                  <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={18} /> Импорт JSON
                  </button>
                  <button
                    className="ghost-button danger"
                    type="button"
                      onClick={() =>
                        setConfirm({
                          title: "Загрузить demo-данные?",
                          text: "Текущие локальные данные будут удалены, затем приложение загрузится заново с demo-данными.",
                          action: () => loadDemoData()
                        })
                      }
                    >
                      <RotateCcw size={18} /> Загрузить demo
                    </button>
                </div>
                <div className="note-card">
                  <strong>Офлайн-режим</strong>
                  <p>Приложение хранит данные в IndexedDB через Dexie и работает после установки как PWA.</p>
                </div>
              </div>
            </Section>

            <Section>
              <div className="section-header">
                <h2>Опасные действия</h2>
                <span>С удалением данных</span>
              </div>
              <div className="note-card">
                <strong>Сначала сделайте экспорт JSON</strong>
                <p>Очистка истории меняет отчеты и может изменить остатки. Для полного восстановления потом используйте импорт backup.</p>
              </div>
              <div className="list-stack">
                <ListCard
                  title="Очистить продажи"
                  subtitle="Удалить все продажи"
                  meta="Остаток будет возвращен обратно"
                  side="Опасно"
                  actions={
                    <button
                      className="ghost-button danger"
                      type="button"
                      onClick={() =>
                        setConfirm({
                          title: "Очистить всю историю продаж?",
                          text: "Все продажи будут удалены, а остатки вернутся обратно.",
                          action: () => clearSalesHistory()
                        })
                      }
                    >
                      <Trash2 size={16} /> Очистить
                    </button>
                  }
                />
                <ListCard
                  title="Очистить поступления"
                  subtitle="Удалить все поступления"
                  meta="Остаток будет уменьшен обратно"
                  side="Опасно"
                  actions={
                    <button
                      className="ghost-button danger"
                      type="button"
                      onClick={() =>
                        setConfirm({
                          title: "Очистить все поступления?",
                          text: "Все поступления будут удалены, остатки уменьшатся. Средняя себестоимость не пересчитывается назад автоматически.",
                          action: () => clearReceiptsHistory()
                        })
                      }
                    >
                      <Trash2 size={16} /> Очистить
                    </button>
                  }
                />
                <ListCard
                  title="Очистить списания"
                  subtitle="Удалить все списания"
                  meta="Списанный остаток вернется обратно"
                  side="Опасно"
                  actions={
                    <button
                      className="ghost-button danger"
                      type="button"
                      onClick={() =>
                        setConfirm({
                          title: "Очистить все списания?",
                          text: "Все списания будут удалены, остатки вернутся обратно.",
                          action: () => clearWriteOffsHistory()
                        })
                      }
                    >
                      <Trash2 size={16} /> Очистить
                    </button>
                  }
                />
                <ListCard
                  title="Очистить расходы"
                  subtitle="Удалить все расходы"
                  meta="На остатки не влияет"
                  side="Опасно"
                  actions={
                    <button
                      className="ghost-button danger"
                      type="button"
                      onClick={() =>
                        setConfirm({
                          title: "Очистить все расходы?",
                          text: "Все расходы будут удалены из истории и отчетов.",
                          action: () => clearExpensesHistory()
                        })
                      }
                    >
                      <Trash2 size={16} /> Очистить
                    </button>
                  }
                />
                <ListCard
                  title="Очистить все данные"
                  subtitle="Оставить приложение пустым"
                  meta="Удалит все локальные данные на устройстве без возврата demo-данных"
                  side="Очень опасно"
                  actions={
                    <button
                      className="ghost-button danger"
                      type="button"
                      onClick={() =>
                        setConfirm({
                          title: "Очистить вообще все данные?",
                          text: "Все локальные данные будут удалены. Приложение останется пустым.",
                          action: () => clearAllData()
                        })
                      }
                    >
                      <Trash2 size={16} /> Очистить все
                    </button>
                  }
                />
                <ListCard
                  title="Загрузить demo-данные"
                  subtitle="Вернуть тестовые товары и операции"
                  meta="Полностью перезапишет текущую локальную базу"
                  side="Опасно"
                  actions={
                    <button
                      className="ghost-button danger"
                      type="button"
                      onClick={() =>
                        setConfirm({
                          title: "Загрузить demo-данные?",
                          text: "Текущая локальная база будет удалена и заменена тестовыми данными.",
                          action: () => loadDemoData()
                        })
                      }
                    >
                      <RotateCcw size={16} /> Demo
                    </button>
                  }
                />
              </div>
            </Section>

            <Section>
              <div className="section-header">
                <h2>Доп. разделы</h2>
                <span>MVP</span>
              </div>
              <div className="quick-actions">
                <ActionButton onClick={() => setScreen("expenses")}>Расходы</ActionButton>
                <ActionButton onClick={() => setScreen("receipts")}>Поступления</ActionButton>
              </div>
            </Section>
          </>
        )}
      </main>

      {modePickerOpen && selectedProduct ? (
        <div
          className="mode-picker-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModePickerOpen(false);
            }
          }}
        >
          <section className="mode-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="sale-mode-title">
            <button className="mode-picker-close" type="button" aria-label="Закрыть" onClick={() => setModePickerOpen(false)}>
              <X size={20} />
            </button>
            <div className="mode-picker-product">
              <span className="mode-picker-emoji" aria-hidden="true">{productEmoji(selectedProduct.displayName)}</span>
              <div>
                <div className="eyebrow">Выбран товар</div>
                <h2 id="sale-mode-title">{selectedProduct.displayName}</h2>
                <p>{formatMoney(selectedProduct.defaultSalePrice)} ₽/{unitLabel(selectedProduct.unit)}</p>
              </div>
            </div>
            <div className="mode-picker-actions">
              <button className="mode-picker-option" type="button" onClick={() => chooseSaleMode("by_weight")}>
                <span>{isPieceSelected ? "ПО КОЛИЧЕСТВУ" : "ПО ВЕСУ"}</span>
                <strong>{isPieceSelected ? "Ввести шт" : "Ввести кг"}</strong>
              </button>
              <button className="mode-picker-option" type="button" onClick={() => chooseSaleMode("by_amount")}>
                <span>НА СУММУ</span>
                <strong>Ввести ₽</strong>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <nav className="bottom-nav">
        <div className="nav-brand">
          <span className="nav-brand-mark"><Store size={22} /></span>
          <span>
            <strong>WayYaam</strong>
            <small>{activeProfile?.name ?? "касса магазина"}</small>
          </span>
        </div>
        {screens.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-button ${screen === item.id ? "active" : ""}`}
              type="button"
              onClick={() => setScreen(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <div className="nav-shift">
          <span className="shift-dot" />
          <span><strong>Смена открыта</strong><small>{activeProfile?.city ?? "Локальный режим"}</small></span>
        </div>
      </nav>

      <input ref={fileInputRef} hidden type="file" accept="application/json" onChange={(event) => void handleImportFile(event)} />

      {toast && <div className="toast">{toast.text}</div>}

      {confirm && (
        <div className="dialog-backdrop">
          <div className="dialog-card">
            <h3>{confirm.title}</h3>
            <p>{confirm.text}</p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setConfirm(null)}>
                Отмена
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={async () => {
                  const action = confirm.action;
                  setConfirm(null);
                  await action();
                }}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`section ${className ?? ""}`.trim()}>{children}</section>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="tool-panel">
      <div className="section-header">
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  buttonLabel,
  onClick,
  accent
}: {
  label: string;
  value: string;
  buttonLabel?: string;
  onClick?: () => void;
  accent?: "primary" | "danger" | "attention";
}) {
  return (
    <div className={`metric-card ${accent ?? ""} ${onClick ? "clickable" : ""}`.trim()} onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
      {buttonLabel && onClick && (
        <button className="metric-link" type="button" onClick={onClick}>
          {buttonLabel}
        </button>
      )}
    </div>
  );
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="action-button" type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ListCard({
  title,
  subtitle,
  meta,
  side,
  actions
}: {
  title: string;
  subtitle: string;
  meta: string;
  side: string;
  actions?: ReactNode;
}) {
  return (
    <article className="list-card">
      <div className="list-card-main">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
          <span>{meta}</span>
        </div>
        <strong>{side}</strong>
      </div>
      {actions ? <div className="card-actions">{actions}</div> : null}
    </article>
  );
}

function EditorCard({
  title,
  children,
  onSave,
  onCancel
}: {
  title: string;
  children: ReactNode;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="editor-card">
      <div className="section-header">
        <h3>{title}</h3>
      </div>
      <div className="editor-grid">{children}</div>
      <div className="dialog-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          <X size={16} /> Закрыть
        </button>
        <button className="primary-button" type="button" onClick={onSave}>
          <Save size={16} /> Сохранить
        </button>
      </div>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function NumberPad({
  keypad,
  price,
  amount,
  quantity,
  unit,
  weightPrecision,
  onAppend,
  onBackspace,
  onClear,
  onSubmit,
  onClose,
  onSelectParameter
}: {
  keypad: KeypadState | null;
  price: number;
  amount: number;
  quantity: number;
  unit: Unit;
  weightPrecision: number;
  onAppend: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  onClose: () => void;
  onSelectParameter: (field: "salePrice" | "totalAmount" | "quantity") => void;
}) {
  const numberKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0"];

  if (!keypad) {
    return null;
  }

  return (
    <div className="floating-pad-backdrop" onClick={onClose}>
      <div className="number-pad floating" onClick={(event) => event.stopPropagation()}>
        <div className="compact-pad-header">
          <h3>{keypad.title}</h3>
          <button className="compact-pad-close" type="button" aria-label="Закрыть" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="compact-pad-params" aria-label="Параметры продажи">
          <button
            className={keypad.field === "salePrice" ? "active" : ""}
            type="button"
            onClick={() => onSelectParameter("salePrice")}
          >
            <span>Цена</span>
            <strong>{formatMoney(price)} ₽</strong>
          </button>
          <button
            className={["totalAmount", "actualAmount"].includes(keypad.field) ? "active" : ""}
            type="button"
            onClick={() => onSelectParameter("totalAmount")}
          >
            <span>Сумма</span>
            <strong>{formatMoney(amount)} ₽</strong>
          </button>
          <button
            className={keypad.field === "quantity" ? "active" : ""}
            type="button"
            onClick={() => onSelectParameter("quantity")}
          >
            <span>{unit === "piece" ? "Штуки" : "Вес"}</span>
            <strong>{unit === "piece" ? formatMoney(quantity) : formatWeight(quantity, weightPrecision)} {unitLabel(unit)}</strong>
          </button>
        </div>
        <div className="pad-display" aria-live="polite">
          <strong>{keypad.value || 0}</strong>
          <span>{keypad.suffix}</span>
        </div>
        <div className="pad-grid">
          {numberKeys.map((key) => (
            <button key={key} className="pad-key" type="button" onClick={() => onAppend(key)}>
              {key}
            </button>
          ))}
          <button className="pad-key utility backspace-key" type="button" aria-label="Удалить цифру" onClick={onBackspace}>
            ←
          </button>
        </div>
        <div className="compact-pad-actions">
          <button className="compact-pad-clear" type="button" onClick={onClear}>Очистить</button>
          <button className="compact-pad-confirm" type="button" onClick={onSubmit}>
            Готово <span>{keypad.submitLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function screenLabel(screen: Screen) {
  const labels: Record<Screen, string> = {
    sale: "Касса",
    products: "Товары",
    groups: "Общие партии",
    receipts: "Поступления и порча",
    writeOffs: "Порча",
    expenses: "Расходы",
    history: "История",
    reports: "Аналитика",
    settings: "Настройки"
  };

  return labels[screen];
}

function formatSignedMoney(value: number) {
  const safeValue = Math.abs(value) < 0.001 ? 0 : value;
  return `${safeValue > 0 ? "+" : safeValue < 0 ? "−" : ""}${formatMoney(Math.abs(safeValue))} ₽`;
}

function formatCountWithNoun(value: number, forms: [string, string, string]) {
  const absolute = Math.abs(Math.trunc(value));
  const mod100 = absolute % 100;
  const mod10 = absolute % 10;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? forms[1]
        : forms[2];
  return `${formatMoney(value)} ${noun}`;
}

function formatPackageLabel(label: string | undefined, count: number) {
  const forms: Record<string, [string, string, string]> = {
    мешок: ["мешок", "мешка", "мешков"],
    ящик: ["ящик", "ящика", "ящиков"],
    коробка: ["коробка", "коробки", "коробок"],
    упаковка: ["упаковка", "упаковки", "упаковок"]
  };
  return formatCountWithNoun(count, forms[label ?? ""] ?? ["уп.", "уп.", "уп."]).replace(
    `${formatMoney(count)} `,
    ""
  );
}

function isInRange(date: string, range: "today" | "7d" | "30d" | "all") {
  if (range === "all") {
    return true;
  }
  if (range === "today") {
    return isToday(date);
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(date).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function productEmoji(name: string) {
  const normalized = name.toLocaleLowerCase("ru");
  if (normalized.includes("помид")) return "🍅";
  if (normalized.includes("огур")) return "🥒";
  if (normalized.includes("перец") || normalized.includes("болгар")) return "🫑";
  if (normalized.includes("карто")) return "🥔";
  if (normalized.includes("лук")) return "🧅";
  if (normalized.includes("яблок")) return "🍎";
  return "🛒";
}

function historyTypeLabel(type: "sale" | "receipt" | "expense" | "writeOff") {
  return {
    sale: "Продажа",
    receipt: "Поступление",
    expense: "Расход",
    writeOff: "Порча / списание"
  }[type];
}

function targetLabel(item: ProductView | StockGroup) {
  return "displayName" in item ? item.displayName : item.name;
}

export default App;
