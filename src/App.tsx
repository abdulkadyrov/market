import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Archive,
  ArrowLeft,
  Calculator,
  CircleDollarSign,
  Download,
  FileDown,
  History,
  House,
  Package,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet
} from "lucide-react";
import { db } from "./db";
import { seedDatabase } from "./seed";
import {
  addDebtPayment,
  addReceipt,
  addSale,
  addStockAdjustment,
  addWriteOff,
  archiveBuyer,
  archiveProduct,
  deleteExpense,
  deleteQuickButton,
  saveBuyer,
  saveExpense,
  saveProduct,
  saveQuickButton,
  type SaleDraft
} from "./services/inventory";
import {
  buildSummary,
  groupByBuyer,
  groupByProduct,
  productAnalytics,
  recentOperations,
  resolveRange,
  type ReportRange
} from "./services/reports";
import { exportProductsCsv, exportSnapshot, importSnapshot } from "./services/exportImport";
import { buyerTypeLabels, expenseCategories, paymentLabels, quickButtonDefaults, receiptSources, saleModeLabels, writeOffReasons } from "./constants";
import type {
  AppSettings,
  Buyer,
  Expense,
  PaymentStatus,
  Product,
  QuickButtonSetting,
  QuickButtonType,
  SaleMode,
  SaleType
} from "./types";
import { clampMoney, currency, dateOnly, dateTime, evaluateExpression, formatQuickButtonLabel, makeId, nowIso, number, parseNumberInput } from "./utils";

type Screen =
  | "dashboard"
  | "quickSale"
  | "products"
  | "receipts"
  | "expenses"
  | "buyers"
  | "debts"
  | "history"
  | "reports"
  | "settings"
  | "calculator";

type ToastTone = "success" | "error" | "info";

interface ToastState {
  id: string;
  text: string;
  tone: ToastTone;
}

interface ConfirmState {
  title: string;
  text: string;
  action: () => Promise<void> | void;
}

interface QuickSaleState {
  productId: string;
  buyerId: string;
  date: string;
  quantity: string;
  salePrice: string;
  totalAmount: string;
  paymentStatus: PaymentStatus;
  paidAmount: string;
  saleType: SaleType;
  mode: SaleMode;
  comment: string;
}

interface ReceiptDraftState {
  productId: string;
  date: string;
  quantity: string;
  unit: Product["unit"];
  purchasePrice: string;
  totalAmount: string;
  source: string;
  comment: string;
}

interface WriteOffDraftState {
  productId: string;
  date: string;
  quantity: string;
  reason: string;
  comment: string;
}

interface AdjustmentDraftState {
  productId: string;
  date: string;
  actualStock: string;
  reason: string;
  comment: string;
}

const initialQuickSaleState = (): QuickSaleState => ({
  productId: "",
  buyerId: "",
  date: nowIso().slice(0, 16),
  quantity: "",
  salePrice: "",
  totalAmount: "",
  paymentStatus: "paid",
  paidAmount: "",
  saleType: "retail",
  mode: "by_quantity",
  comment: ""
});

const emptyProduct = (): Product => ({
  id: makeId("product"),
  name: "",
  category: "",
  unit: "kg",
  defaultPurchasePrice: 0,
  defaultSalePrice: 0,
  currentStock: 0,
  averageCost: 0,
  notes: "",
  isArchived: false,
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const emptyBuyer = (): Buyer => ({
  id: makeId("buyer"),
  name: "",
  phone: "",
  type: "regular",
  city: "",
  comment: "",
  isArchived: false,
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const emptyExpense = (): Expense => ({
  id: makeId("expense"),
  date: nowIso().slice(0, 16),
  category: "fuel",
  amount: 0,
  comment: "",
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const screenTitle: Record<Screen, string> = {
  dashboard: "Главная",
  quickSale: "Быстрая продажа",
  products: "Товары",
  receipts: "Поступления",
  expenses: "Расходы",
  buyers: "Покупатели",
  debts: "Долги",
  history: "История",
  reports: "Отчеты",
  settings: "Настройки",
  calculator: "Калькулятор"
};

function App() {
  const [screen, setScreen] = useState<Screen>("quickSale");
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [quickSale, setQuickSale] = useState<QuickSaleState>(initialQuickSaleState);
  const [manualField, setManualField] = useState<QuickButtonType | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [calculatorTarget, setCalculatorTarget] = useState<"quantity" | "salePrice" | "totalAmount" | null>(null);
  const [calculatorExpression, setCalculatorExpression] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [buyerSearch, setBuyerSearch] = useState("");
  const [reportRange, setReportRange] = useState<ReportRange>("today");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>("");
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [buyerFormOpen, setBuyerFormOpen] = useState(false);
  const [receiptFormOpen, setReceiptFormOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [writeOffFormOpen, setWriteOffFormOpen] = useState(false);
  const [adjustmentFormOpen, setAdjustmentFormOpen] = useState(false);
  const [quickButtonEditorOpen, setQuickButtonEditorOpen] = useState(false);
  const [quickButtonDraftOpen, setQuickButtonDraftOpen] = useState(false);
  const [debtPaymentTarget, setDebtPaymentTarget] = useState<string>("");
  const [productDraft, setProductDraft] = useState<Product>(emptyProduct());
  const [buyerDraft, setBuyerDraft] = useState<Buyer>(emptyBuyer());
  const [expenseDraft, setExpenseDraft] = useState<Expense>(emptyExpense());
  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraftState>({
    productId: "",
    date: nowIso().slice(0, 16),
    quantity: "",
    unit: "kg",
    purchasePrice: "",
    totalAmount: "",
    source: receiptSources[0],
    comment: ""
  });
  const [writeOffDraft, setWriteOffDraft] = useState<WriteOffDraftState>({
    productId: "",
    date: nowIso().slice(0, 16),
    quantity: "",
    reason: writeOffReasons[0],
    comment: ""
  });
  const [adjustmentDraft, setAdjustmentDraft] = useState<AdjustmentDraftState>({
    productId: "",
    date: nowIso().slice(0, 16),
    actualStock: "",
    reason: "",
    comment: ""
  });
  const [debtPaymentAmount, setDebtPaymentAmount] = useState("");
  const [debtPaymentComment, setDebtPaymentComment] = useState("");
  const [quickButtonDraft, setQuickButtonDraft] = useState<QuickButtonSetting>({
    id: makeId("qb"),
    type: "weight",
    value: 0,
    label: "",
    order: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });

  const quickInputRef = useRef<HTMLInputElement | null>(null);

  const products = useLiveQuery(() => db.products.toArray(), [], []) ?? [];
  const receipts = useLiveQuery(() => db.receipts.toArray(), [], []) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray(), [], []) ?? [];
  const buyers = useLiveQuery(() => db.buyers.toArray(), [], []) ?? [];
  const expenses = useLiveQuery(() => db.expenses.toArray(), [], []) ?? [];
  const writeOffs = useLiveQuery(() => db.writeOffs.toArray(), [], []) ?? [];
  const stockAdjustments = useLiveQuery(() => db.stockAdjustments.toArray(), [], []) ?? [];
  const debtPayments = useLiveQuery(() => db.debtPayments.toArray(), [], []) ?? [];
  const quickButtons = useLiveQuery(() => db.quickButtonSettings.toArray(), [], []) ?? [];
  const operationLogs = useLiveQuery(() => db.operationLogs.toArray(), [], []) ?? [];
  const settings = useLiveQuery(async () => (await db.appSettings.get("main")) ?? null, [], null);

  useEffect(() => {
    void seedDatabase();
  }, []);

  useEffect(() => {
    if (!quickSale.productId && products.length > 0) {
      const product = products.find((item) => !item.isArchived) ?? products[0];
      setQuickSale((current) => ({
        ...current,
        productId: product.id,
        salePrice: String(product.defaultSalePrice)
      }));
    }
  }, [products, quickSale.productId]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings?.theme ?? "light";
  }, [settings?.theme]);

  useEffect(() => {
    if (manualField && quickInputRef.current) {
      quickInputRef.current.focus();
    }
  }, [manualField]);

  const activeProducts = useMemo(
    () => products.filter((item) => !item.isArchived).sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );
  const activeBuyers = useMemo(
    () => buyers.filter((item) => !item.isArchived).sort((a, b) => a.name.localeCompare(b.name)),
    [buyers]
  );
  const selectedProduct = activeProducts.find((item) => item.id === quickSale.productId) ?? activeProducts[0];
  const selectedBuyer = activeBuyers.find((item) => item.id === quickSale.buyerId);
  const activeQuickButtons = useMemo(
    () => [...quickButtons].sort((a, b) => a.type.localeCompare(b.type) || a.order - b.order),
    [quickButtons]
  );

  const summary = useMemo(
    () => buildSummary(products, receipts, sales, expenses, writeOffs, debtPayments, resolveRange(reportRange)),
    [debtPayments, expenses, products, receipts, reportRange, sales, writeOffs]
  );

  const recentOps = useMemo(() => recentOperations(operationLogs, 12), [operationLogs]);
  const reportProducts = useMemo(
    () => groupByProduct(activeProducts, receipts, sales, writeOffs, resolveRange(reportRange)),
    [activeProducts, receipts, reportRange, sales, writeOffs]
  );
  const reportBuyers = useMemo(
    () => groupByBuyer(activeBuyers, sales, debtPayments, resolveRange(reportRange)),
    [activeBuyers, debtPayments, reportRange, sales]
  );

  const addToast = (text: string, tone: ToastTone = "success") => {
    const id = makeId("toast");
    setToasts((current) => [...current, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2800);
  };

  const runSafely = async (action: () => Promise<void>, successText: string) => {
    try {
      await action();
      addToast(successText, "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Что-то пошло не так", "error");
    }
  };

  const setQuickSaleField = (field: keyof QuickSaleState, value: string) => {
    setQuickSale((current) => {
      const next = { ...current, [field]: value };
      return recalculateSaleForm(next, field, selectedProduct?.defaultSalePrice ?? 0);
    });
  };

  const applyQuickValue = (type: QuickButtonType, value: number) => {
    if (type === "weight") {
      setQuickSaleField("quantity", String(value));
    }
    if (type === "amount") {
      setQuickSaleField("totalAmount", String(value));
    }
    if (type === "price") {
      setQuickSaleField("salePrice", String(value));
    }
  };

  const submitQuickSale = async () => {
    if (!quickSale.productId) {
      addToast("Сначала выберите товар", "error");
      return;
    }

    const payload: SaleDraft = {
      productId: quickSale.productId,
      buyerId: quickSale.buyerId || undefined,
      date: new Date(quickSale.date).toISOString(),
      quantity: parseNumberInput(quickSale.quantity),
      salePrice: parseNumberInput(quickSale.salePrice),
      totalAmount: parseNumberInput(quickSale.totalAmount),
      paymentStatus: quickSale.paymentStatus,
      paidAmount: parseNumberInput(quickSale.paidAmount),
      saleType: quickSale.saleType,
      mode: quickSale.mode,
      comment: quickSale.comment
    };

    await runSafely(async () => {
      await addSale(payload);
      setQuickSale((current) => ({
        ...initialQuickSaleState(),
        productId: current.productId,
        salePrice: String(selectedProduct?.defaultSalePrice ?? "")
      }));
    }, "Продажа сохранена");
  };

  const saveTheme = async (theme: AppSettings["theme"]) => {
    await db.appSettings.put({
      id: "main",
      currency: settings?.currency ?? "RUB",
      theme,
      createdAt: settings?.createdAt ?? nowIso(),
      updatedAt: nowIso()
    });
  };

  const resetQuickButtons = async () => {
    await db.quickButtonSettings.clear();
    await db.quickButtonSettings.bulkAdd(
      quickButtonDefaults.map((item, index) => ({
        ...item,
        id: makeId("qb"),
        order: index
      }))
    );
  };

  const clearAllData = async () => {
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
        await Promise.all([
          db.products.clear(),
          db.receipts.clear(),
          db.sales.clear(),
          db.buyers.clear(),
          db.expenses.clear(),
          db.writeOffs.clear(),
          db.stockAdjustments.clear(),
          db.debtPayments.clear(),
          db.quickButtonSettings.clear(),
          db.appSettings.clear(),
          db.operationLogs.clear()
        ]);
      }
    );
    await seedDatabase();
  };

  const selectedProductDetail = activeProducts.find((item) => item.id === selectedProductId);
  const selectedBuyerDetail = activeBuyers.find((item) => item.id === selectedBuyerId);

  const visibleProducts = activeProducts.filter((item) =>
    `${item.name} ${item.category}`.toLowerCase().includes(productSearch.toLowerCase())
  );

  const visibleBuyers = activeBuyers.filter((item) =>
    `${item.name} ${item.phone} ${item.city}`.toLowerCase().includes(buyerSearch.toLowerCase())
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Bazaar Market</div>
          <h1>{screenTitle[screen]}</h1>
        </div>
        <button className="icon-button" onClick={() => setScreen("quickSale")} title="Быстрая продажа">
          <ShoppingCart size={20} />
        </button>
      </header>

      <main className="content">
        {screen === "dashboard" && (
          <section className="stack">
            <CardGrid
              items={[
                ["Выручка", currency(summary.revenue, settings?.currency)],
                ["Закупка", currency(summary.purchase, settings?.currency)],
                ["Расходы", currency(summary.expenses, settings?.currency)],
                ["Прибыль", currency(summary.profit, settings?.currency)],
                ["Остаток", number(summary.stock)],
                ["Продаж", String(summary.salesCount)],
                ["Долги", currency(summary.debts, settings?.currency)],
                ["Опт", String(summary.wholesaleSales)]
              ]}
            />

            <section className="section">
              <SectionTitle title="Быстрые действия" />
              <div className="action-grid">
                <ActionButton icon={<ShoppingCart size={18} />} text="Быстрая продажа" onClick={() => setScreen("quickSale")} />
                <ActionButton icon={<Plus size={18} />} text="Поступление" onClick={() => setReceiptFormOpen(true)} />
                <ActionButton icon={<Wallet size={18} />} text="Расход" onClick={() => setExpenseFormOpen(true)} />
                <ActionButton icon={<Archive size={18} />} text="Списание" onClick={() => setWriteOffFormOpen(true)} />
                <ActionButton icon={<Users size={18} />} text="Покупатель" onClick={() => setBuyerFormOpen(true)} />
                <ActionButton icon={<CircleDollarSign size={18} />} text="Долги" onClick={() => setScreen("debts")} />
                <ActionButton icon={<Calculator size={18} />} text="Калькулятор" onClick={() => setScreen("calculator")} />
              </div>
            </section>

            <section className="section">
              <SectionTitle title="Последние операции" />
              <OperationList
                operations={recentOps}
                products={products}
                buyers={buyers}
                emptyTitle="Нет операций"
                emptyAction={{ label: "Открыть продажу", onClick: () => setScreen("quickSale") }}
              />
            </section>
          </section>
        )}

        {screen === "quickSale" && (
          <section className="stack">
            <section className="section section-hero">
              <div className="hero-head">
                <div>
                  <div className="eyebrow">Главный экран</div>
                  <h2>Продажа за несколько секунд</h2>
                </div>
                <button className="secondary-button" onClick={() => setQuickButtonEditorOpen(true)}>
                  Быстрые кнопки
                </button>
              </div>

              <div className="sale-meta">
                <SelectField
                  label="Товар"
                  value={quickSale.productId}
                  onChange={(value) => {
                    const product = activeProducts.find((item) => item.id === value);
                    setQuickSale((current) =>
                      recalculateSaleForm(
                        {
                          ...current,
                          productId: value,
                          salePrice: product ? String(product.defaultSalePrice) : current.salePrice
                        },
                        "salePrice",
                        product?.defaultSalePrice ?? 0
                      )
                    );
                  }}
                  options={activeProducts.map((item) => ({
                    value: item.id,
                    label: `${item.name} • ${number(item.currentStock)} ${item.unit}`
                  }))}
                />
                <SelectField
                  label="Покупатель"
                  value={quickSale.buyerId}
                  onChange={(value) => setQuickSale((current) => ({ ...current, buyerId: value }))}
                  options={[{ value: "", label: "Без покупателя" }, ...activeBuyers.map((item) => ({ value: item.id, label: item.name }))]}
                />
                <div className="inline-pills">
                  <Segment
                    label="Тип"
                    value={quickSale.saleType}
                    options={[
                      { value: "retail", label: "Розница" },
                      { value: "wholesale", label: "Опт" }
                    ]}
                    onChange={(value) => setQuickSale((current) => ({ ...current, saleType: value as SaleType }))}
                  />
                  <Segment
                    label="Режим"
                    value={quickSale.mode}
                    options={[
                      { value: "by_quantity", label: "По кол-ву" },
                      { value: "by_amount", label: "По сумме" },
                      { value: "manual", label: "Ручной" }
                    ]}
                    onChange={(value) =>
                      setQuickSale((current) => recalculateSaleForm({ ...current, mode: value as SaleMode }, "mode", selectedProduct?.defaultSalePrice ?? 0))
                    }
                  />
                </div>
                {selectedProduct && (
                  <div className="info-strip">
                    <span>Остаток: {number(selectedProduct.currentStock)} {selectedProduct.unit}</span>
                    <span>Цена: {currency(selectedProduct.defaultSalePrice, settings?.currency)}</span>
                    {selectedBuyer && <span>{selectedBuyer.name}</span>}
                  </div>
                )}
              </div>

              <QuickButtonsSection
                title="Вес"
                buttons={activeQuickButtons.filter((item) => item.type === "weight")}
                onPress={(value) => applyQuickValue("weight", value)}
                manualLabel="Свой вес"
                onManual={() => {
                  setManualField("weight");
                  setManualValue("");
                }}
              />
              <QuickButtonsSection
                title="Сумма"
                buttons={activeQuickButtons.filter((item) => item.type === "amount")}
                onPress={(value) => applyQuickValue("amount", value)}
                manualLabel="Своя сумма"
                onManual={() => {
                  setManualField("amount");
                  setManualValue("");
                }}
              />
              <QuickButtonsSection
                title="Цена"
                buttons={activeQuickButtons.filter((item) => item.type === "price")}
                onPress={(value) => applyQuickValue("price", value)}
                manualLabel="Своя цена"
                onManual={() => {
                  setManualField("price");
                  setManualValue("");
                }}
              />

              <div className="form-grid">
                <NumberField label="Количество" value={quickSale.quantity} onChange={(value) => setQuickSaleField("quantity", value)} autoFocus />
                <NumberField label="Цена" value={quickSale.salePrice} onChange={(value) => setQuickSaleField("salePrice", value)} />
                <NumberField label="Сумма" value={quickSale.totalAmount} onChange={(value) => setQuickSaleField("totalAmount", value)} />
                <TextField label="Комментарий" value={quickSale.comment} onChange={(value) => setQuickSale((current) => ({ ...current, comment: value }))} />
              </div>

              <div className="inline-pills">
                <Segment
                  label="Оплата"
                  value={quickSale.paymentStatus}
                  options={[
                    { value: "paid", label: "Оплачено" },
                    { value: "partial", label: "Частично" },
                    { value: "debt", label: "В долг" }
                  ]}
                  onChange={(value) =>
                    setQuickSale((current) =>
                      recalculateSaleForm(
                        {
                          ...current,
                          paymentStatus: value as PaymentStatus,
                          paidAmount:
                            value === "paid"
                              ? current.totalAmount
                              : value === "debt"
                                ? "0"
                                : current.paidAmount
                        },
                        "paidAmount",
                        selectedProduct?.defaultSalePrice ?? 0
                      )
                    )
                  }
                />
              </div>

              {(quickSale.paymentStatus === "partial" || quickSale.paymentStatus === "debt") && (
                <div className="form-grid">
                  <NumberField label="Оплачено сейчас" value={quickSale.paidAmount} onChange={(value) => setQuickSale((current) => ({ ...current, paidAmount: value }))} />
                  <StatCard title="Остаток долга" value={currency(calcDebtAmount(quickSale), settings?.currency)} />
                </div>
              )}

              <div className="sticky-actions">
                <button className="primary-button" onClick={() => void submitQuickSale()}>
                  <Save size={18} /> Сохранить продажу
                </button>
                <button className="secondary-button" onClick={() => setQuickSale(initialQuickSaleState())}>
                  Очистить
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setCalculatorTarget("totalAmount");
                    setScreen("calculator");
                  }}
                >
                  Калькулятор
                </button>
              </div>
            </section>
          </section>
        )}

        {screen === "products" && (
          <section className="stack">
            <SearchField value={productSearch} onChange={setProductSearch} placeholder="Поиск товара" />
            {selectedProductDetail ? (
              <section className="section">
                <button className="back-link" onClick={() => setSelectedProductId("")}>
                  <ArrowLeft size={16} /> Назад к списку
                </button>
                <div className="detail-head">
                  <div>
                    <h2>{selectedProductDetail.name}</h2>
                    <p>{selectedProductDetail.category} • {selectedProductDetail.unit}</p>
                  </div>
                  <div className="chip-row">
                    <button className="secondary-button" onClick={() => {
                      setQuickSale((current) => ({
                        ...current,
                        productId: selectedProductDetail.id,
                        salePrice: String(selectedProductDetail.defaultSalePrice)
                      }));
                      setScreen("quickSale");
                    }}>Продать</button>
                    <button className="secondary-button" onClick={() => {
                      setReceiptDraft((current) => ({ ...current, productId: selectedProductDetail.id, unit: selectedProductDetail.unit }));
                      setReceiptFormOpen(true);
                    }}>Поступление</button>
                  </div>
                </div>
                <CardGrid
                  items={[
                    ["Остаток", `${number(selectedProductDetail.currentStock)} ${selectedProductDetail.unit}`],
                    ["Себестоимость", currency(selectedProductDetail.averageCost, settings?.currency)],
                    ["Цена продажи", currency(selectedProductDetail.defaultSalePrice, settings?.currency)],
                    ["Стоимость остатка", currency(productAnalytics(selectedProductDetail).stockCost, settings?.currency)],
                    ["Потенц. выручка", currency(productAnalytics(selectedProductDetail).potentialRevenue, settings?.currency)],
                    ["Потенц. прибыль", currency(productAnalytics(selectedProductDetail).potentialProfit, settings?.currency)]
                  ]}
                />
                <OperationList
                  operations={recentOps.filter((item) => item.productId === selectedProductDetail.id)}
                  products={products}
                  buyers={buyers}
                  emptyTitle="Нет истории по товару"
                  emptyAction={{ label: "Добавить поступление", onClick: () => setReceiptFormOpen(true) }}
                />
              </section>
            ) : (
              <>
                {visibleProducts.length === 0 ? (
                  <EmptyState
                    title="Нет товаров"
                    text="Добавь первый товар, и можно сразу открывать быструю продажу."
                    actionLabel="Добавить товар"
                    onAction={() => {
                      setProductDraft(emptyProduct());
                      setProductFormOpen(true);
                    }}
                  />
                ) : (
                  <div className="list">
                    {visibleProducts.map((item) => (
                      <article key={item.id} className="list-card">
                        <div className="list-card-head">
                          <div>
                            <h3>{item.name}</h3>
                            <p>{item.category}</p>
                          </div>
                          <button className="icon-button" onClick={() => setSelectedProductId(item.id)} title="Открыть карточку">
                            <ArrowLeft size={18} />
                          </button>
                        </div>
                        <div className="metric-row">
                          <span>{number(item.currentStock)} {item.unit}</span>
                          <span>{currency(item.defaultSalePrice, settings?.currency)}</span>
                          <span>{currency(item.averageCost, settings?.currency)}</span>
                        </div>
                        <div className="chip-row">
                          <button className="secondary-button" onClick={() => {
                            setQuickSale((current) => ({
                              ...current,
                              productId: item.id,
                              salePrice: String(item.defaultSalePrice)
                            }));
                            setScreen("quickSale");
                          }}>Продать</button>
                          <button className="secondary-button" onClick={() => {
                            setReceiptDraft((current) => ({ ...current, productId: item.id, unit: item.unit }));
                            setReceiptFormOpen(true);
                          }}>Поступление</button>
                          <button className="secondary-button" onClick={() => {
                            setWriteOffDraft((current) => ({ ...current, productId: item.id }));
                            setWriteOffFormOpen(true);
                          }}>Списать</button>
                          <button className="secondary-button" onClick={() => {
                            setProductDraft(item);
                            setProductFormOpen(true);
                          }}>Изменить</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <FloatingAddButton onClick={() => {
                  setProductDraft(emptyProduct());
                  setProductFormOpen(true);
                }} />
              </>
            )}
          </section>
        )}

        {screen === "receipts" && (
          <SimpleSection
            title="Поступления"
            actionLabel="Добавить поступление"
            onAction={() => setReceiptFormOpen(true)}
            empty={receipts.length === 0}
            emptyTitle="Нет поступлений"
            emptyText="Добавь поступление, чтобы остатки считались автоматически."
          >
            <div className="list">
              {[...receipts].sort((a, b) => b.date.localeCompare(a.date)).map((item) => (
                <article key={item.id} className="list-card compact">
                  <div className="list-card-head">
                    <strong>{products.find((product) => product.id === item.productId)?.name ?? "Товар"}</strong>
                    <span>{dateTime(item.date)}</span>
                  </div>
                  <div className="metric-row">
                    <span>{number(item.quantity)} {item.unit}</span>
                    <span>{currency(item.purchasePrice, settings?.currency)}</span>
                    <span>{currency(item.totalAmount, settings?.currency)}</span>
                  </div>
                  <p>{item.source}</p>
                </article>
              ))}
            </div>
          </SimpleSection>
        )}

        {screen === "expenses" && (
          <SimpleSection
            title="Расходы"
            actionLabel="Добавить расход"
            onAction={() => setExpenseFormOpen(true)}
            empty={expenses.length === 0}
            emptyTitle="Нет расходов"
            emptyText="Добавь расходы, чтобы прибыль считалась честно."
          >
            <div className="list">
              {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).map((item) => (
                <article key={item.id} className="list-card compact">
                  <div className="list-card-head">
                    <strong>{item.category}</strong>
                    <span>{dateTime(item.date)}</span>
                  </div>
                  <div className="metric-row">
                    <span>{currency(item.amount, settings?.currency)}</span>
                    <button
                      className="ghost-button danger"
                      onClick={() =>
                        setConfirm({
                          title: "Удалить расход",
                          text: "Расход будет удален без восстановления.",
                          action: async () => {
                            await deleteExpense(item.id);
                            addToast("Расход удален");
                          }
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p>{item.comment || "Без комментария"}</p>
                </article>
              ))}
            </div>
          </SimpleSection>
        )}

        {screen === "buyers" && (
          <section className="stack">
            <SearchField value={buyerSearch} onChange={setBuyerSearch} placeholder="Поиск покупателя" />
            {selectedBuyerDetail ? (
              <section className="section">
                <button className="back-link" onClick={() => setSelectedBuyerId("")}>
                  <ArrowLeft size={16} /> Назад к списку
                </button>
                <div className="detail-head">
                  <div>
                    <h2>{selectedBuyerDetail.name}</h2>
                    <p>{buyerTypeLabels[selectedBuyerDetail.type]} • {selectedBuyerDetail.phone || "Без телефона"}</p>
                  </div>
                  <button className="secondary-button" onClick={() => {
                    setQuickSale((current) => ({ ...current, buyerId: selectedBuyerDetail.id }));
                    setScreen("quickSale");
                  }}>Новая продажа</button>
                </div>
                <CardGrid
                  items={[
                    ["Сумма покупок", currency(reportBuyers.find((item) => item.buyer.id === selectedBuyerDetail.id)?.total ?? 0, settings?.currency)],
                    ["Покупок", String(reportBuyers.find((item) => item.buyer.id === selectedBuyerDetail.id)?.count ?? 0)],
                    ["Средний чек", currency(reportBuyers.find((item) => item.buyer.id === selectedBuyerDetail.id)?.averageCheck ?? 0, settings?.currency)],
                    ["Долг", currency(reportBuyers.find((item) => item.buyer.id === selectedBuyerDetail.id)?.debt ?? 0, settings?.currency)]
                  ]}
                />
                <OperationList
                  operations={recentOps.filter((item) => item.buyerId === selectedBuyerDetail.id)}
                  products={products}
                  buyers={buyers}
                  emptyTitle="Нет истории по покупателю"
                  emptyAction={{ label: "Сделать продажу", onClick: () => setScreen("quickSale") }}
                />
              </section>
            ) : (
              <>
                {visibleBuyers.length === 0 ? (
                  <EmptyState
                    title="Нет покупателей"
                    text="Добавь постоянных клиентов и оптовиков, чтобы вести долги и историю."
                    actionLabel="Добавить покупателя"
                    onAction={() => {
                      setBuyerDraft(emptyBuyer());
                      setBuyerFormOpen(true);
                    }}
                  />
                ) : (
                  <div className="list">
                    {visibleBuyers.map((item) => {
                      const buyerReport = reportBuyers.find((entry) => entry.buyer.id === item.id);
                      return (
                        <article key={item.id} className="list-card">
                          <div className="list-card-head">
                            <div>
                              <h3>{item.name}</h3>
                              <p>{buyerTypeLabels[item.type]} • {item.city || "Без города"}</p>
                            </div>
                            <button className="icon-button" onClick={() => setSelectedBuyerId(item.id)}>
                              <ArrowLeft size={18} />
                            </button>
                          </div>
                          <div className="metric-row">
                            <span>Долг: {currency(buyerReport?.debt ?? 0, settings?.currency)}</span>
                            <span>{item.phone || "Без телефона"}</span>
                          </div>
                          <div className="chip-row">
                            <button className="secondary-button" onClick={() => {
                              setQuickSale((current) => ({ ...current, buyerId: item.id }));
                              setScreen("quickSale");
                            }}>Продажа</button>
                            <button className="secondary-button" onClick={() => {
                              setBuyerDraft(item);
                              setBuyerFormOpen(true);
                            }}>Изменить</button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                <FloatingAddButton onClick={() => {
                  setBuyerDraft(emptyBuyer());
                  setBuyerFormOpen(true);
                }} />
              </>
            )}
          </section>
        )}

        {screen === "debts" && (
          <SimpleSection
            title="Долги"
            actionLabel="Открыть продажу"
            onAction={() => setScreen("quickSale")}
            empty={debtPayments.filter((item) => item.status === "active").length === 0}
            emptyTitle="Нет долгов"
            emptyText="Все продажи закрыты или оплачены полностью."
          >
            <CardGrid items={[["Общая сумма долгов", currency(summary.debts, settings?.currency)]]} />
            <div className="list">
              {debtPayments
                .filter((item) => item.status === "active")
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((item) => (
                  <article key={item.id} className="list-card">
                    <div className="list-card-head">
                      <div>
                        <h3>{buyers.find((buyer) => buyer.id === item.buyerId)?.name ?? "Покупатель"}</h3>
                        <p>{dateOnly(item.date)}</p>
                      </div>
                      <strong>{currency(item.remainingAmount, settings?.currency)}</strong>
                    </div>
                    <div className="metric-row">
                      <span>Всего: {currency(item.totalAmount, settings?.currency)}</span>
                      <span>Оплачено: {currency(item.paidAmount, settings?.currency)}</span>
                    </div>
                    <div className="chip-row">
                      <button className="secondary-button" onClick={() => {
                        setDebtPaymentTarget(item.id);
                        setDebtPaymentAmount("");
                        setDebtPaymentComment("");
                      }}>Оплата</button>
                      <button className="secondary-button" onClick={() => {
                        const buyer = buyers.find((buyerItem) => buyerItem.id === item.buyerId);
                        if (buyer) {
                          setSelectedBuyerId(buyer.id);
                          setScreen("buyers");
                        }
                      }}>Карточка</button>
                    </div>
                  </article>
                ))}
            </div>
          </SimpleSection>
        )}

        {screen === "history" && (
          <SimpleSection
            title="История операций"
            actionLabel="Обновить"
            onAction={() => addToast("История обновлена", "info")}
            empty={operationLogs.length === 0}
            emptyTitle="Нет операций"
            emptyText="История появится после первых поступлений, продаж и расходов."
          >
            <OperationList
              operations={recentOperations(operationLogs, 100)}
              products={products}
              buyers={buyers}
              emptyTitle="Нет операций"
              emptyAction={{ label: "Открыть продажу", onClick: () => setScreen("quickSale") }}
            />
          </SimpleSection>
        )}

        {screen === "reports" && (
          <section className="stack">
            <section className="section">
              <SectionTitle title="Период" />
              <div className="range-tabs">
                {(["today", "yesterday", "week", "month", "season"] as ReportRange[]).map((item) => (
                  <button
                    key={item}
                    className={`pill-button ${reportRange === item ? "active" : ""}`}
                    onClick={() => setReportRange(item)}
                  >
                    {item === "today" ? "Сегодня" : item === "yesterday" ? "Вчера" : item === "week" ? "Неделя" : item === "month" ? "Месяц" : "Сезон"}
                  </button>
                ))}
              </div>
              <CardGrid
                items={[
                  ["Выручка", currency(summary.revenue, settings?.currency)],
                  ["Закупка", currency(summary.purchase, settings?.currency)],
                  ["Расходы", currency(summary.expenses, settings?.currency)],
                  ["Списания", currency(summary.writeOffs, settings?.currency)],
                  ["Прибыль", currency(summary.profit, settings?.currency)],
                  ["Остаток", number(summary.stock)],
                  ["Продаж", String(summary.salesCount)],
                  ["Долги", currency(summary.debts, settings?.currency)]
                ]}
              />
            </section>
            <section className="section">
              <SectionTitle title="По товарам" />
              <div className="list">
                {reportProducts.map((item) => (
                  <article key={item.product.id} className="list-card compact">
                    <div className="list-card-head">
                      <strong>{item.product.name}</strong>
                      <span>{currency(item.revenue, settings?.currency)}</span>
                    </div>
                    <div className="metric-row">
                      <span>Закупили: {number(item.receivedQuantity)}</span>
                      <span>Продали: {number(item.soldQuantity)}</span>
                      <span>Осталось: {number(item.remainingStock)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className="section">
              <SectionTitle title="По покупателям" />
              <div className="list">
                {reportBuyers.map((item) => (
                  <article key={item.buyer.id} className="list-card compact">
                    <div className="list-card-head">
                      <strong>{item.buyer.name}</strong>
                      <span>{currency(item.total, settings?.currency)}</span>
                    </div>
                    <div className="metric-row">
                      <span>Покупок: {item.count}</span>
                      <span>Средний чек: {currency(item.averageCheck, settings?.currency)}</span>
                      <span>Долг: {currency(item.debt, settings?.currency)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {screen === "calculator" && (
          <section className="section calculator-screen">
            <div className="calculator-display">{calculatorExpression || "0"}</div>
            <div className="calculator-grid">
              {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "%", "+"].map((key) => (
                <button key={key} className="calc-key" onClick={() => setCalculatorExpression((current) => current + key)}>
                  {key}
                </button>
              ))}
              <button className="calc-key alt" onClick={() => setCalculatorExpression("")}>C</button>
              <button className="calc-key alt" onClick={() => setCalculatorExpression((current) => current.slice(0, -1))}>←</button>
              <button className="calc-key primary" onClick={() => {
                try {
                  setCalculatorExpression(String(evaluateExpression(calculatorExpression)));
                } catch {
                  addToast("Невозможно посчитать выражение", "error");
                }
              }}>=</button>
            </div>
            {calculatorTarget && (
              <button
                className="primary-button"
                onClick={() => {
                  const result = String(evaluateExpression(calculatorExpression));
                  setQuickSaleField(calculatorTarget, result);
                  setScreen("quickSale");
                  addToast("Результат подставлен");
                }}
              >
                Подставить результат
              </button>
            )}
          </section>
        )}

        {screen === "settings" && (
          <section className="stack">
            <section className="section">
              <SectionTitle title="Тема" />
              <div className="chip-row">
                <button className={`pill-button ${settings?.theme === "light" ? "active" : ""}`} onClick={() => void saveTheme("light")}>Светлая</button>
                <button className={`pill-button ${settings?.theme === "dark" ? "active" : ""}`} onClick={() => void saveTheme("dark")}>Темная</button>
                <button className={`pill-button ${settings?.theme === "system" ? "active" : ""}`} onClick={() => void saveTheme("system")}>Системная</button>
              </div>
            </section>
            <section className="section">
              <SectionTitle title="Быстрые кнопки" />
              <div className="chip-row">
                <button className="secondary-button" onClick={() => setQuickButtonEditorOpen(true)}>Изменить</button>
                <button className="secondary-button" onClick={() => void runSafely(resetQuickButtons, "Кнопки сброшены")}>
                  <RotateCcw size={16} /> Сбросить
                </button>
              </div>
            </section>
            <section className="section">
              <SectionTitle title="Экспорт и backup" />
              <div className="action-grid">
                <ActionButton icon={<Download size={18} />} text="Экспорт JSON" onClick={() => void runSafely(exportSnapshot, "JSON выгружен")} />
                <ActionButton icon={<FileDown size={18} />} text="Экспорт CSV" onClick={() => void runSafely(exportProductsCsv, "CSV выгружен")} />
                <label className="action-button">
                  <Upload size={18} />
                  Импорт JSON
                  <input
                    type="file"
                    accept="application/json"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setConfirm({
                        title: "Импорт данных",
                        text: "Текущие данные будут полностью заменены.",
                        action: async () => {
                          await importSnapshot(file);
                          addToast("Импорт завершен");
                        }
                      });
                    }}
                  />
                </label>
              </div>
            </section>
            <section className="section">
              <SectionTitle title="Опасные действия" />
              <button
                className="danger-button"
                onClick={() =>
                  setConfirm({
                    title: "Сбросить данные",
                    text: "Все локальные данные будут очищены и заменены демо-данными.",
                    action: async () => {
                      await clearAllData();
                      addToast("Данные сброшены");
                    }
                  })
                }
              >
                Очистить и заново заполнить
              </button>
            </section>
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        <NavButton icon={<House size={18} />} label="Главная" active={screen === "dashboard"} onClick={() => setScreen("dashboard")} />
        <NavButton icon={<ShoppingCart size={18} />} label="Продажа" active={screen === "quickSale"} onClick={() => setScreen("quickSale")} />
        <NavButton icon={<Package size={18} />} label="Товары" active={screen === "products"} onClick={() => setScreen("products")} />
        <NavButton icon={<Users size={18} />} label="Покупатели" active={screen === "buyers"} onClick={() => setScreen("buyers")} />
        <NavButton icon={<TrendingUp size={18} />} label="Отчеты" active={screen === "reports"} onClick={() => setScreen("reports")} />
        <NavButton icon={<Settings size={18} />} label="Еще" active={["settings", "expenses", "receipts", "debts", "history", "calculator"].includes(screen)} onClick={() => setScreen("settings")} />
      </nav>

      <div className="speed-dial">
        <button className="speed-chip" onClick={() => setScreen("receipts")}><ReceiptText size={16} /> Поступления</button>
        <button className="speed-chip" onClick={() => setScreen("expenses")}><Wallet size={16} /> Расходы</button>
        <button className="speed-chip" onClick={() => setScreen("debts")}><CircleDollarSign size={16} /> Долги</button>
        <button className="speed-chip" onClick={() => setScreen("history")}><History size={16} /> История</button>
      </div>

      {manualField && (
        <Modal title={manualField === "weight" ? "Свой вес" : manualField === "amount" ? "Своя сумма" : "Своя цена"} onClose={() => setManualField(null)}>
          <NumberField label="Значение" value={manualValue} onChange={setManualValue} inputRef={quickInputRef} autoFocus />
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setManualField(null)}>Отмена</button>
            <button className="primary-button" onClick={() => {
              applyQuickValue(manualField, parseNumberInput(manualValue));
              setManualField(null);
            }}>Подставить</button>
          </div>
        </Modal>
      )}

      {productFormOpen && (
        <Modal title={productDraft.createdAt === productDraft.updatedAt ? "Новый товар" : "Изменить товар"} onClose={() => setProductFormOpen(false)}>
          <div className="form-grid">
            <TextField label="Название" value={productDraft.name} onChange={(value) => setProductDraft((current) => ({ ...current, name: value }))} />
            <TextField label="Категория" value={productDraft.category} onChange={(value) => setProductDraft((current) => ({ ...current, category: value }))} />
            <SelectField
              label="Единица"
              value={productDraft.unit}
              onChange={(value) => setProductDraft((current) => ({ ...current, unit: value as Product["unit"] }))}
              options={[
                { value: "kg", label: "кг" },
                { value: "piece", label: "штука" },
                { value: "box", label: "ящик" },
                { value: "bag", label: "мешок" },
                { value: "net", label: "сетка" },
                { value: "other", label: "другое" }
              ]}
            />
            <NumberField label="Закупочная цена" value={String(productDraft.defaultPurchasePrice || "")} onChange={(value) => setProductDraft((current) => ({ ...current, defaultPurchasePrice: parseNumberInput(value) }))} />
            <NumberField label="Цена продажи" value={String(productDraft.defaultSalePrice || "")} onChange={(value) => setProductDraft((current) => ({ ...current, defaultSalePrice: parseNumberInput(value) }))} />
            <TextField label="Комментарий" value={productDraft.notes} onChange={(value) => setProductDraft((current) => ({ ...current, notes: value }))} />
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setProductFormOpen(false)}>Отменить</button>
            <button className="primary-button" onClick={() => void runSafely(async () => {
              if (!productDraft.name.trim()) throw new Error("Введите название товара");
              await saveProduct(productDraft);
              setProductFormOpen(false);
            }, "Товар сохранен")}>Сохранить</button>
            <button className="ghost-button danger" onClick={() => setConfirm({
              title: "Архивировать товар",
              text: "Товар исчезнет из активного списка, но история останется.",
              action: async () => {
                await archiveProduct(productDraft.id);
                setProductFormOpen(false);
                addToast("Товар архивирован");
              }
            })}><Archive size={16} /></button>
          </div>
        </Modal>
      )}

      {buyerFormOpen && (
        <Modal title={buyerDraft.createdAt === buyerDraft.updatedAt ? "Новый покупатель" : "Изменить покупателя"} onClose={() => setBuyerFormOpen(false)}>
          <div className="form-grid">
            <TextField label="Имя / название" value={buyerDraft.name} onChange={(value) => setBuyerDraft((current) => ({ ...current, name: value }))} />
            <TextField label="Телефон" value={buyerDraft.phone} onChange={(value) => setBuyerDraft((current) => ({ ...current, phone: value }))} />
            <SelectField
              label="Тип"
              value={buyerDraft.type}
              onChange={(value) => setBuyerDraft((current) => ({ ...current, type: value as Buyer["type"] }))}
              options={Object.entries(buyerTypeLabels).map(([value, label]) => ({ value, label }))}
            />
            <TextField label="Город / место" value={buyerDraft.city} onChange={(value) => setBuyerDraft((current) => ({ ...current, city: value }))} />
            <TextField label="Комментарий" value={buyerDraft.comment} onChange={(value) => setBuyerDraft((current) => ({ ...current, comment: value }))} />
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setBuyerFormOpen(false)}>Отменить</button>
            <button className="primary-button" onClick={() => void runSafely(async () => {
              if (!buyerDraft.name.trim()) throw new Error("Введите имя покупателя");
              await saveBuyer(buyerDraft);
              setBuyerFormOpen(false);
            }, "Покупатель сохранен")}>Сохранить</button>
            <button className="ghost-button danger" onClick={() => setConfirm({
              title: "Архивировать покупателя",
              text: "Покупатель скроется из выбора, но история останется.",
              action: async () => {
                await archiveBuyer(buyerDraft.id);
                setBuyerFormOpen(false);
                addToast("Покупатель архивирован");
              }
            })}><Archive size={16} /></button>
          </div>
        </Modal>
      )}

      {receiptFormOpen && (
        <Modal title="Добавить поступление" onClose={() => setReceiptFormOpen(false)}>
          <div className="form-grid">
            <SelectField
              label="Товар"
              value={receiptDraft.productId}
              onChange={(value) => {
                const product = activeProducts.find((item) => item.id === value);
                setReceiptDraft((current) => ({ ...current, productId: value, unit: product?.unit ?? current.unit }));
              }}
              options={activeProducts.map((item) => ({ value: item.id, label: item.name }))}
            />
            <TextField label="Дата" type="datetime-local" value={receiptDraft.date} onChange={(value) => setReceiptDraft((current) => ({ ...current, date: value }))} />
            <NumberField label="Количество" value={receiptDraft.quantity} onChange={(value) => setReceiptDraft((current) => ({ ...current, quantity: value }))} />
            <SelectField
              label="Единица"
              value={receiptDraft.unit}
              onChange={(value) => setReceiptDraft((current) => ({ ...current, unit: value as Product["unit"] }))}
              options={[
                { value: "kg", label: "кг" },
                { value: "piece", label: "штука" },
                { value: "box", label: "ящик" },
                { value: "bag", label: "мешок" },
                { value: "net", label: "сетка" },
                { value: "other", label: "другое" }
              ]}
            />
            <NumberField label="Цена закупки" value={receiptDraft.purchasePrice} onChange={(value) => {
              setReceiptDraft((current) => {
                const quantity = parseNumberInput(current.quantity);
                const purchasePrice = parseNumberInput(value);
                return {
                  ...current,
                  purchasePrice: value,
                  totalAmount: quantity && purchasePrice ? String(clampMoney(quantity * purchasePrice)) : current.totalAmount
                };
              });
            }} />
            <NumberField label="Итоговая сумма" value={receiptDraft.totalAmount} onChange={(value) => setReceiptDraft((current) => ({ ...current, totalAmount: value }))} />
            <SelectField label="Источник" value={receiptDraft.source} onChange={(value) => setReceiptDraft((current) => ({ ...current, source: value }))} options={receiptSources.map((item) => ({ value: item, label: item }))} />
            <TextField label="Комментарий" value={receiptDraft.comment} onChange={(value) => setReceiptDraft((current) => ({ ...current, comment: value }))} />
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setReceiptFormOpen(false)}>Отменить</button>
            <button className="primary-button" onClick={() => void runSafely(async () => {
              await addReceipt({
                productId: receiptDraft.productId,
                date: new Date(receiptDraft.date).toISOString(),
                quantity: parseNumberInput(receiptDraft.quantity),
                unit: receiptDraft.unit as Product["unit"],
                purchasePrice: parseNumberInput(receiptDraft.purchasePrice),
                totalAmount: parseNumberInput(receiptDraft.totalAmount),
                source: receiptDraft.source,
                comment: receiptDraft.comment
              });
              setReceiptFormOpen(false);
            }, "Поступление сохранено")}>Сохранить</button>
          </div>
        </Modal>
      )}

      {expenseFormOpen && (
        <Modal title="Добавить расход" onClose={() => setExpenseFormOpen(false)}>
          <div className="form-grid">
            <TextField label="Дата" type="datetime-local" value={expenseDraft.date.slice(0, 16)} onChange={(value) => setExpenseDraft((current) => ({ ...current, date: value }))} />
            <SelectField label="Категория" value={expenseDraft.category} onChange={(value) => setExpenseDraft((current) => ({ ...current, category: value }))} options={expenseCategories.map((item) => ({ value: item, label: item }))} />
            <NumberField label="Сумма" value={String(expenseDraft.amount || "")} onChange={(value) => setExpenseDraft((current) => ({ ...current, amount: parseNumberInput(value) }))} />
            <TextField label="Комментарий" value={expenseDraft.comment} onChange={(value) => setExpenseDraft((current) => ({ ...current, comment: value }))} />
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setExpenseFormOpen(false)}>Отменить</button>
            <button className="primary-button" onClick={() => void runSafely(async () => {
              if (expenseDraft.amount <= 0) throw new Error("Введите сумму расхода");
              await saveExpense({
                ...expenseDraft,
                date: new Date(expenseDraft.date).toISOString()
              });
              setExpenseFormOpen(false);
            }, "Расход сохранен")}>Сохранить</button>
          </div>
        </Modal>
      )}

      {writeOffFormOpen && (
        <Modal title="Добавить списание" onClose={() => setWriteOffFormOpen(false)}>
          <div className="form-grid">
            <SelectField label="Товар" value={writeOffDraft.productId} onChange={(value) => setWriteOffDraft((current) => ({ ...current, productId: value }))} options={activeProducts.map((item) => ({ value: item.id, label: item.name }))} />
            <TextField label="Дата" type="datetime-local" value={writeOffDraft.date} onChange={(value) => setWriteOffDraft((current) => ({ ...current, date: value }))} />
            <NumberField label="Количество" value={writeOffDraft.quantity} onChange={(value) => setWriteOffDraft((current) => ({ ...current, quantity: value }))} />
            <SelectField label="Причина" value={writeOffDraft.reason} onChange={(value) => setWriteOffDraft((current) => ({ ...current, reason: value }))} options={writeOffReasons.map((item) => ({ value: item, label: item }))} />
            <TextField label="Комментарий" value={writeOffDraft.comment} onChange={(value) => setWriteOffDraft((current) => ({ ...current, comment: value }))} />
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setWriteOffFormOpen(false)}>Отменить</button>
            <button className="primary-button" onClick={() => void runSafely(async () => {
              await addWriteOff({
                productId: writeOffDraft.productId,
                date: new Date(writeOffDraft.date).toISOString(),
                quantity: parseNumberInput(writeOffDraft.quantity),
                reason: writeOffDraft.reason,
                comment: writeOffDraft.comment
              });
              setWriteOffFormOpen(false);
            }, "Списание сохранено")}>Сохранить</button>
          </div>
        </Modal>
      )}

      {adjustmentFormOpen && (
        <Modal title="Корректировка остатка" onClose={() => setAdjustmentFormOpen(false)}>
          <div className="form-grid">
            <SelectField label="Товар" value={adjustmentDraft.productId} onChange={(value) => setAdjustmentDraft((current) => ({ ...current, productId: value }))} options={activeProducts.map((item) => ({ value: item.id, label: item.name }))} />
            <TextField label="Дата" type="datetime-local" value={adjustmentDraft.date} onChange={(value) => setAdjustmentDraft((current) => ({ ...current, date: value }))} />
            <NumberField label="Фактический остаток" value={adjustmentDraft.actualStock} onChange={(value) => setAdjustmentDraft((current) => ({ ...current, actualStock: value }))} />
            <TextField label="Причина" value={adjustmentDraft.reason} onChange={(value) => setAdjustmentDraft((current) => ({ ...current, reason: value }))} />
            <TextField label="Комментарий" value={adjustmentDraft.comment} onChange={(value) => setAdjustmentDraft((current) => ({ ...current, comment: value }))} />
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setAdjustmentFormOpen(false)}>Отменить</button>
            <button className="primary-button" onClick={() => void runSafely(async () => {
              await addStockAdjustment({
                productId: adjustmentDraft.productId,
                date: new Date(adjustmentDraft.date).toISOString(),
                actualStock: parseNumberInput(adjustmentDraft.actualStock),
                reason: adjustmentDraft.reason,
                comment: adjustmentDraft.comment
              });
              setAdjustmentFormOpen(false);
            }, "Остаток скорректирован")}>Сохранить</button>
          </div>
        </Modal>
      )}

      {quickButtonEditorOpen && (
        <Modal title="Настройка быстрых кнопок" onClose={() => setQuickButtonEditorOpen(false)}>
          <div className="editor-blocks">
            {(["weight", "amount", "price"] as QuickButtonType[]).map((type) => (
              <section key={type} className="section inset">
                <div className="list-card-head">
                  <strong>{type === "weight" ? "Вес" : type === "amount" ? "Сумма" : "Цена"}</strong>
                  <button className="secondary-button" onClick={() => {
                    setQuickButtonDraft({
                    id: makeId("qb"),
                    type,
                    value: 0,
                    label: "",
                    order: activeQuickButtons.filter((item) => item.type === type).length,
                    createdAt: nowIso(),
                    updatedAt: nowIso()
                  });
                    setQuickButtonDraftOpen(true);
                  }}>Добавить</button>
                </div>
                <div className="list">
                  {activeQuickButtons.filter((item) => item.type === type).map((item, index) => (
                    <article key={item.id} className="list-card compact">
                      <div className="list-card-head">
                        <strong>{item.label}</strong>
                        <span>{item.value}</span>
                      </div>
                      <div className="chip-row">
                        <button className="secondary-button" onClick={() => {
                          setQuickButtonDraft(item);
                          setQuickButtonDraftOpen(true);
                        }}>Изменить</button>
                        <button className="secondary-button" onClick={() => void runSafely(async () => {
                          await saveQuickButton({ ...item, order: Math.max(0, index - 1) });
                        }, "Порядок обновлен")}>Вверх</button>
                        <button className="ghost-button danger" onClick={() => setConfirm({
                          title: "Удалить кнопку",
                          text: "Кнопка исчезнет с экрана быстрой продажи.",
                          action: async () => {
                            await deleteQuickButton(item.id);
                            addToast("Кнопка удалена");
                          }
                        })}><Trash2 size={16} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setQuickButtonEditorOpen(false)}>Готово</button>
          </div>
        </Modal>
      )}

      {quickButtonDraftOpen && (
        <Modal title="Кнопка" onClose={() => setQuickButtonDraftOpen(false)}>
          <div className="form-grid">
            <SelectField
              label="Тип"
              value={quickButtonDraft.type}
              onChange={(value) => setQuickButtonDraft((current) => ({ ...current, type: value as QuickButtonType }))}
              options={[
                { value: "weight", label: "Вес" },
                { value: "amount", label: "Сумма" },
                { value: "price", label: "Цена" }
              ]}
            />
            <NumberField label="Значение" value={String(quickButtonDraft.value || "")} onChange={(value) => setQuickButtonDraft((current) => ({ ...current, value: parseNumberInput(value), label: formatQuickButtonLabel(current.type, parseNumberInput(value)) }))} />
            <TextField label="Подпись" value={quickButtonDraft.label} onChange={(value) => setQuickButtonDraft((current) => ({ ...current, label: value }))} />
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setQuickButtonDraftOpen(false)}>Отмена</button>
            <button className="primary-button" onClick={() => void runSafely(async () => {
              if (quickButtonDraft.value <= 0) throw new Error("Введите значение кнопки");
              await saveQuickButton({
                ...quickButtonDraft,
                label: quickButtonDraft.label || formatQuickButtonLabel(quickButtonDraft.type, quickButtonDraft.value)
              });
              setQuickButtonDraftOpen(false);
            }, "Кнопка сохранена")}>Сохранить</button>
          </div>
        </Modal>
      )}

      {debtPaymentTarget && (
        <Modal title="Оплата долга" onClose={() => setDebtPaymentTarget("")}>
          {(() => {
            const debt = debtPayments.find((item) => item.id === debtPaymentTarget);
            if (!debt) return null;
            return (
              <>
                <CardGrid
                  items={[
                    ["Покупатель", buyers.find((buyer) => buyer.id === debt.buyerId)?.name ?? "Покупатель"],
                    ["Остаток", currency(debt.remainingAmount, settings?.currency)],
                    ["Оплачено", currency(debt.paidAmount, settings?.currency)]
                  ]}
                />
                <div className="form-grid">
                  <NumberField label="Сумма оплаты" value={debtPaymentAmount} onChange={setDebtPaymentAmount} />
                  <TextField label="Комментарий" value={debtPaymentComment} onChange={setDebtPaymentComment} />
                </div>
                <div className="modal-actions">
                  <button className="secondary-button" onClick={() => setDebtPaymentTarget("")}>Отмена</button>
                  <button className="primary-button" onClick={() => void runSafely(async () => {
                    await addDebtPayment(debt.id, parseNumberInput(debtPaymentAmount), debtPaymentComment);
                    setDebtPaymentTarget("");
                  }, "Оплата сохранена")}>Сохранить</button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}

      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p>{confirm.text}</p>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setConfirm(null)}>Отмена</button>
            <button className="danger-button" onClick={() => void runSafely(async () => {
              await confirm.action();
              setConfirm(null);
            }, "Готово")}>Подтвердить</button>
          </div>
        </Modal>
      )}

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone}`}>{toast.text}</div>
        ))}
      </div>
    </div>
  );
}

function recalculateSaleForm(state: QuickSaleState, changedField: string, fallbackPrice: number): QuickSaleState {
  const quantity = parseNumberInput(state.quantity);
  const salePrice = parseNumberInput(state.salePrice) || fallbackPrice;
  const totalAmount = parseNumberInput(state.totalAmount);

  if (changedField === "mode") {
    return recalculateSaleForm({ ...state, salePrice: salePrice ? String(salePrice) : state.salePrice }, "salePrice", fallbackPrice);
  }

  if (state.mode === "by_quantity") {
    const computedTotal = quantity && salePrice ? clampMoney(quantity * salePrice) : 0;
    return { ...state, salePrice: salePrice ? String(salePrice) : "", totalAmount: computedTotal ? String(computedTotal) : "" };
  }

  if (state.mode === "by_amount") {
    const computedQuantity = totalAmount && salePrice ? clampMoney(totalAmount / salePrice) : 0;
    return { ...state, salePrice: salePrice ? String(salePrice) : "", quantity: computedQuantity ? String(computedQuantity) : "" };
  }

  if (changedField === "quantity" || changedField === "salePrice") {
    const computedTotal = quantity && salePrice ? clampMoney(quantity * salePrice) : totalAmount;
    return { ...state, salePrice: salePrice ? String(salePrice) : "", totalAmount: computedTotal ? String(computedTotal) : "" };
  }

  if (changedField === "totalAmount" && salePrice) {
    const computedQuantity = totalAmount ? clampMoney(totalAmount / salePrice) : quantity;
    return { ...state, salePrice: salePrice ? String(salePrice) : "", quantity: computedQuantity ? String(computedQuantity) : "" };
  }

  return { ...state, salePrice: salePrice ? String(salePrice) : "" };
}

function calcDebtAmount(state: QuickSaleState) {
  const total = parseNumberInput(state.totalAmount);
  const paid = state.paymentStatus === "paid" ? total : state.paymentStatus === "debt" ? 0 : parseNumberInput(state.paidAmount);
  return clampMoney(Math.max(total - paid, 0));
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-button" onClick={onClose}><ArrowLeft size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="section-title">{title}</h2>;
}

function CardGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="card-grid">
      {items.map(([title, value]) => (
        <StatCard key={title} title={title} value={value} />
      ))}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ActionButton({ icon, text, onClick }: { icon: ReactNode; text: string; onClick: () => void }) {
  return (
    <button className="action-button" onClick={onClick}>
      {icon}
      {text}
    </button>
  );
}

function QuickButtonsSection({
  title,
  buttons,
  onPress,
  manualLabel,
  onManual
}: {
  title: string;
  buttons: QuickButtonSetting[];
  onPress: (value: number) => void;
  manualLabel: string;
  onManual: () => void;
}) {
  return (
    <section className="section inset">
      <div className="list-card-head">
        <strong>{title}</strong>
        <button className="secondary-button" onClick={onManual}>{manualLabel}</button>
      </div>
      <div className="quick-grid">
        {buttons.map((item) => (
          <button key={item.id} className="quick-button" onClick={() => onPress(item.value)}>
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="search-field">
      <Search size={18} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  autoFocus,
  inputRef
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  inputRef?: { current: HTMLInputElement | null };
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Выбрать</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Segment({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="segment">
      <span>{label}</span>
      <div className="segment-row">
        {options.map((option) => (
          <button
            key={option.value}
            className={`segment-button ${value === option.value ? "active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  text,
  actionLabel,
  onAction
}: {
  title: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary-button" onClick={onAction}>{actionLabel}</button>
    </section>
  );
}

function SimpleSection({
  title,
  actionLabel,
  onAction,
  empty,
  emptyTitle,
  emptyText,
  children
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  empty: boolean;
  emptyTitle: string;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <section className="stack">
      <section className="section">
        <div className="list-card-head">
          <SectionTitle title={title} />
          <button className="secondary-button" onClick={onAction}>{actionLabel}</button>
        </div>
      </section>
      {empty ? <EmptyState title={emptyTitle} text={emptyText} actionLabel={actionLabel} onAction={onAction} /> : children}
    </section>
  );
}

function OperationList({
  operations,
  products,
  buyers,
  emptyTitle,
  emptyAction
}: {
  operations: { id: string; type: string; productId?: string; buyerId?: string; date: string; quantity?: number; amount?: number; comment?: string }[];
  products: Product[];
  buyers: Buyer[];
  emptyTitle: string;
  emptyAction: { label: string; onClick: () => void };
}) {
  if (operations.length === 0) {
    return <EmptyState title={emptyTitle} text="Записи появятся после первых действий." actionLabel={emptyAction.label} onAction={emptyAction.onClick} />;
  }

  return (
    <div className="list">
      {operations.map((item) => (
        <article key={item.id} className="list-card compact">
          <div className="list-card-head">
            <strong>{operationTitle(item.type)}</strong>
            <span>{dateTime(item.date)}</span>
          </div>
          <div className="metric-row">
            <span>{item.productId ? products.find((product) => product.id === item.productId)?.name ?? "Товар" : "Без товара"}</span>
            <span>{item.buyerId ? buyers.find((buyer) => buyer.id === item.buyerId)?.name ?? "Покупатель" : "—"}</span>
          </div>
          <div className="metric-row">
            {item.quantity !== undefined && <span>{number(item.quantity)}</span>}
            {item.amount !== undefined && <span>{currency(item.amount)}</span>}
          </div>
          {item.comment && <p>{item.comment}</p>}
        </article>
      ))}
    </div>
  );
}

function FloatingAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="fab" onClick={onClick} title="Добавить">
      <Plus size={22} />
    </button>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function operationTitle(type: string) {
  return type === "receipt"
    ? "Поступление"
    : type === "sale"
      ? "Продажа"
      : type === "expense"
        ? "Расход"
        : type === "writeOff"
          ? "Списание"
          : type === "adjustment"
            ? "Корректировка"
            : "Оплата долга";
}

export default App;
