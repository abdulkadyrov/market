import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Archive,
  Boxes,
  Calculator,
  Check,
  ClipboardList,
  Download,
  History,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Settings,
  ShoppingBasket,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X
} from "lucide-react";
import { db } from "./db";
import {
  applyDiscount,
  clearDiscount,
  createEmptySaleEditor,
  defaultSettings,
  editPrice,
  editTotal,
  editWeight,
  roundSaleTotal,
  setReceivedAmount,
  type SaleEditor
} from "./logic";
import { seedDatabase } from "./seed";
import { exportSnapshot, importSnapshot } from "./services/exportImport";
import "./styles.css";
import type {
  AppSettings,
  BaseField,
  DiscountType,
  Expense,
  Product,
  ProductView,
  QuickButtonSetting,
  Receipt as ReceiptEntity,
  Sale,
  SaleMode,
  StockGroup,
  WriteOff
} from "./types";
import {
  downloadTextFile,
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
  | "salePrice"
  | "discountAmount"
  | "discountPercent"
  | "receivedAmount"
  | "roundAmount";

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
}

interface ProductDraft extends Product {}

interface GroupDraft extends StockGroup {}

interface ReceiptDraft {
  id: string;
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
  targetType: "group" | "product";
  targetId: string;
  date: string;
  quantity: string;
  reason: string;
  comment: string;
}

interface ExpenseDraft extends Expense {}

const screens: Array<{ id: Screen; label: string; icon: typeof ShoppingBasket }> = [
  { id: "sale", label: "Продажа", icon: ShoppingBasket },
  { id: "products", label: "Товары", icon: Package },
  { id: "groups", label: "Партии", icon: Boxes },
  { id: "receipts", label: "Поступ.", icon: Receipt },
  { id: "history", label: "История", icon: History },
  { id: "reports", label: "Отчеты", icon: TrendingUp },
  { id: "settings", label: "Еще", icon: Settings }
];

const emptyProductDraft = (): ProductDraft => ({
  id: makeId("product"),
  name: "",
  variant: "",
  category: "Овощи",
  unit: "kg",
  currentStock: 0,
  averageCost: 0,
  defaultSalePrice: 0,
  notes: "",
  isArchived: false,
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const emptyGroupDraft = (): GroupDraft => ({
  id: makeId("group"),
  name: "",
  unit: "kg",
  currentStock: 0,
  averageCost: 0,
  notes: "",
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const emptyReceiptDraft = (): ReceiptDraft => ({
  id: makeId("receipt"),
  targetType: "group",
  targetId: "",
  date: nowIso(),
  quantity: "",
  purchasePrice: "",
  totalAmount: "",
  source: "",
  comment: ""
});

const emptyWriteOffDraft = (): WriteOffDraft => ({
  id: makeId("writeoff"),
  targetType: "group",
  targetId: "",
  date: nowIso(),
  quantity: "",
  reason: "Порча",
  comment: ""
});

const emptyExpenseDraft = (): ExpenseDraft => ({
  id: makeId("expense"),
  date: nowIso(),
  category: "Прочее",
  amount: 0,
  comment: "",
  createdAt: nowIso(),
  updatedAt: nowIso()
});

function App() {
  const [screen, setScreen] = useState<Screen>("sale");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saleEditor, setSaleEditor] = useState<SaleEditor>(createEmptySaleEditor());
  const [keypad, setKeypad] = useState<KeypadState | null>(null);
  const [toolPanel, setToolPanel] = useState<"discount" | "round" | "change" | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);
  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft | null>(null);
  const [writeOffDraft, setWriteOffDraft] = useState<WriteOffDraft | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null);
  const [historyRange, setHistoryRange] = useState<"today" | "7d" | "30d" | "all">("today");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stockGroups = useLiveQuery(() => db.stockGroups.toArray(), [], []) ?? [];
  const products = useLiveQuery(() => db.products.orderBy("createdAt").toArray(), [], []) ?? [];
  const receipts = useLiveQuery(() => db.receipts.orderBy("date").reverse().toArray(), [], []) ?? [];
  const sales = useLiveQuery(() => db.sales.orderBy("date").reverse().toArray(), [], []) ?? [];
  const expenses = useLiveQuery(() => db.expenses.orderBy("date").reverse().toArray(), [], []) ?? [];
  const writeOffs = useLiveQuery(() => db.writeOffs.orderBy("date").reverse().toArray(), [], []) ?? [];
  const quickButtons = useLiveQuery(() => db.quickButtonSettings.orderBy("order").toArray(), [], []) ?? [];
  const appSettings = useLiveQuery(() => db.appSettings.get("main"), [], defaultSettings);

  const settings = appSettings ?? defaultSettings;

  useEffect(() => {
    void seedDatabase();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

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

  const selectedProduct = selectedProductId ? productViewMap.get(selectedProductId) : undefined;

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
        subtext: `${formatWeight(item.quantity, settings.weightPrecision)} кг`
      })),
      ...receipts.map((item) => ({
        id: item.id,
        type: "receipt" as const,
        date: item.date,
        title: item.stockGroupId
          ? stockGroups.find((group) => group.id === item.stockGroupId)?.name ?? "Поступление"
          : productViewMap.get(item.productId ?? "")?.displayName ?? "Поступление",
        amount: item.totalAmount,
        subtext: `${formatWeight(item.quantity, settings.weightPrecision)} кг`
      })),
      ...writeOffs.map((item) => ({
        id: item.id,
        type: "writeOff" as const,
        date: item.date,
        title: item.stockGroupId
          ? stockGroups.find((group) => group.id === item.stockGroupId)?.name ?? "Списание"
          : productViewMap.get(item.productId ?? "")?.displayName ?? "Списание",
        amount: item.costAmount,
        subtext: `${formatWeight(item.quantity, settings.weightPrecision)} кг`
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
  }, [expenses, historyRange, productViewMap, receipts, sales, settings.weightPrecision, stockGroups, writeOffs]);

  const report = useMemo(() => {
    const revenue = sales.reduce((sum, item) => sum + item.finalTotalAmount, 0);
    const purchase = receipts.reduce((sum, item) => sum + item.totalAmount, 0);
    const expensesTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
    const writeOffTotal = writeOffs.reduce((sum, item) => sum + item.costAmount, 0);
    const cogs = sales.reduce((sum, item) => sum + item.costOfGoodsSold, 0);
    const stockValue =
      stockGroups.reduce((sum, item) => sum + item.currentStock * item.averageCost, 0) +
      products
        .filter((item) => !item.stockGroupId && !item.isArchived)
        .reduce((sum, item) => sum + item.currentStock * item.averageCost, 0);

    return {
      revenue,
      purchase,
      expenses: expensesTotal,
      writeOffs: writeOffTotal,
      cogs,
      profit: revenue - cogs - expensesTotal - writeOffTotal,
      stockValue
    };
  }, [expenses, products, receipts, sales, stockGroups, writeOffs]);

  const showToast = (text: string) => setToast({ id: makeId("toast"), text });

  const resetSale = (product = selectedProduct) => {
    setSaleEditor(createEmptySaleEditor(product));
    setKeypad(null);
    setToolPanel(null);
  };

  const chooseProduct = (productId: string) => {
    const product = productViewMap.get(productId);
    if (!product) {
      return;
    }
    setSelectedProductId(productId);
    resetSale(product);
  };

  const openKeypad = (field: KeypadField, title: string, value: number | string, suffix: string) => {
    setKeypad({
      field,
      title,
      suffix,
      value: String(value || "")
    });
  };

  const submitKeypad = () => {
    if (!keypad) {
      return;
    }

    const value = parseNumber(keypad.value);
    const precision = settings.weightPrecision;

    if (keypad.field === "quantity") {
      setSaleEditor((current) => editWeight(current, value, precision));
      setToolPanel(null);
    }

    if (keypad.field === "totalAmount") {
      setSaleEditor((current) => editTotal(current, value, precision));
      setToolPanel(null);
    }

    if (keypad.field === "salePrice") {
      setSaleEditor((current) => editPrice(current, value, precision));
      setToolPanel(null);
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
      setSaleEditor((current) => setReceivedAmount(current, value, precision));
      setToolPanel("change");
    }

    if (keypad.field === "roundAmount") {
      setSaleEditor((current) => roundSaleTotal(current, value, precision));
      setToolPanel(null);
    }

    setKeypad(null);
  };

  const appendKey = (key: string) => {
    setKeypad((current) => {
      if (!current) {
        return current;
      }
      if (key === "." && current.value.includes(".")) {
        return current;
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
      setSaleEditor((current) => editWeight(current, button.value, precision));
    }
    if (button.type === "amount") {
      setSaleEditor((current) => editTotal(current, button.value, precision));
    }
    if (button.type === "discount") {
      setSaleEditor((current) => applyDiscount(current, "amount", button.value, precision));
      setToolPanel("discount");
    }
    if (button.type === "round") {
      setSaleEditor((current) => roundSaleTotal(current, button.value, precision));
    }
  };

  const persistSale = async () => {
    if (!selectedProduct) {
      showToast("Выберите товар");
      return;
    }
    if (saleEditor.quantity <= 0 || saleEditor.salePrice <= 0 || saleEditor.finalTotalAmount <= 0) {
      showToast("Проверьте вес, цену и сумму");
      return;
    }
    if (selectedProduct.availableStock < saleEditor.quantity) {
      showToast("Недостаточно остатка");
      return;
    }

    const sale: Sale = {
      id: makeId("sale"),
      productId: selectedProduct.id,
      stockGroupId: selectedProduct.stockGroupId,
      date: nowIso(),
      quantity: saleEditor.quantity,
      salePrice: saleEditor.salePrice,
      totalAmount: saleEditor.totalAmount,
      originalTotalAmount: saleEditor.discountAmount ? saleEditor.originalTotalAmount : saleEditor.totalAmount,
      discountType: saleEditor.discountType,
      discountValue: saleEditor.discountValue,
      discountAmount: saleEditor.discountAmount,
      finalTotalAmount: saleEditor.finalTotalAmount,
      receivedAmount: saleEditor.receivedAmount,
      changeAmount: saleEditor.changeAmount,
      mode: saleEditor.mode,
      activeBaseField: saleEditor.activeBaseField,
      costOfGoodsSold: toMoney(saleEditor.quantity * selectedProduct.averageCost),
      comment: "",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    await db.transaction("rw", db.sales, db.products, db.stockGroups, async () => {
      await db.sales.add(sale);
      if (selectedProduct.stockGroupId) {
        const group = await db.stockGroups.get(selectedProduct.stockGroupId);
        if (!group) {
          throw new Error("Группа остатка не найдена");
        }
        await db.stockGroups.put({
          ...group,
          currentStock: toMoney(group.currentStock - saleEditor.quantity),
          updatedAt: nowIso()
        });
      } else {
        const product = await db.products.get(selectedProduct.id);
        if (!product) {
          throw new Error("Товар не найден");
        }
        await db.products.put({
          ...product,
          currentStock: toMoney(product.currentStock - saleEditor.quantity),
          updatedAt: nowIso()
        });
      }
    });

    showToast("Продано");
    resetSale(selectedProduct);
  };

  const saveProduct = async () => {
    if (!productDraft) {
      return;
    }
    if (!productDraft.name.trim()) {
      showToast("Введите название товара");
      return;
    }
    const payload: Product = {
      ...productDraft,
      stockGroupId: productDraft.stockGroupId || undefined,
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
    await db.stockGroups.put({
      ...groupDraft,
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

    const receipt: ReceiptEntity = {
      id: receiptDraft.id,
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
        if (!group) {
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
        if (!product) {
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
    const quantity = parseNumber(writeOffDraft.quantity);

    if (quantity <= 0) {
      showToast("Введите количество списания");
      return;
    }

    await db.transaction("rw", db.writeOffs, db.stockGroups, db.products, async () => {
      if (writeOffDraft.targetType === "group") {
        const group = await db.stockGroups.get(writeOffDraft.targetId);
        if (!group || group.currentStock < quantity) {
          throw new Error("Недостаточно остатка в группе");
        }
        await db.stockGroups.put({
          ...group,
          currentStock: toMoney(group.currentStock - quantity),
          updatedAt: nowIso()
        });
        await db.writeOffs.put({
          id: writeOffDraft.id,
          stockGroupId: writeOffDraft.targetId,
          date: writeOffDraft.date,
          quantity,
          reason: writeOffDraft.reason,
          comment: writeOffDraft.comment,
          costAmount: toMoney(quantity * group.averageCost),
          createdAt: nowIso(),
          updatedAt: nowIso()
        });
      } else {
        const product = await db.products.get(writeOffDraft.targetId);
        if (!product || product.currentStock < quantity) {
          throw new Error("Недостаточно остатка у товара");
        }
        await db.products.put({
          ...product,
          currentStock: toMoney(product.currentStock - quantity),
          updatedAt: nowIso()
        });
        await db.writeOffs.put({
          id: writeOffDraft.id,
          productId: writeOffDraft.targetId,
          date: writeOffDraft.date,
          quantity,
          reason: writeOffDraft.reason,
          comment: writeOffDraft.comment,
          costAmount: toMoney(quantity * product.averageCost),
          createdAt: nowIso(),
          updatedAt: nowIso()
        });
      }
    });

    setWriteOffDraft(null);
    showToast("Списание сохранено");
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
    const text = await file.text();
    const snapshot = JSON.parse(text);
    await importSnapshot(snapshot);
    event.target.value = "";
    setProductDraft(null);
    setGroupDraft(null);
    setReceiptDraft(null);
    setWriteOffDraft(null);
    setExpenseDraft(null);
    showToast("Импорт завершен");
  };

  const resetToDemo = async () => {
    await db.delete();
    window.location.reload();
  };

  const saveSettings = async (patch: Partial<AppSettings>) => {
    await db.appSettings.put({
      ...settings,
      ...patch,
      updatedAt: nowIso()
    });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">MVP PWA для базара</div>
          <h1>{screen === "sale" ? "Быстрая продажа" : screenLabel(screen)}</h1>
        </div>
        <button className="icon-button" type="button" onClick={() => resetSale()}>
          <RotateCcw size={20} />
        </button>
      </header>

      <main className="content">
        {screen === "sale" && (
          <>
            <Section className="ribbon-section">
              <div className="section-header">
                <h2>Товары</h2>
                <span>{productViews.length}</span>
              </div>
              <div className="product-ribbon">
                {productViews.map((product) => (
                  <button
                    key={product.id}
                    className={`product-chip ${product.id === selectedProductId ? "active" : ""}`}
                    type="button"
                    onClick={() => chooseProduct(product.id)}
                  >
                    <strong>{product.displayName}</strong>
                    <span>{formatMoney(product.defaultSalePrice)} ₽/кг</span>
                    <span>{product.sharedStockName ? `Группа: ${formatWeight(product.availableStock, settings.weightPrecision)} кг` : `Остаток: ${formatWeight(product.availableStock, settings.weightPrecision)} кг`}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section className="sale-focus">
              <div className="sale-head">
                <div>
                  <div className="eyebrow">Выбран товар</div>
                  <h2>{selectedProduct?.displayName ?? "Нет товара"}</h2>
                  <p className="muted">
                    {selectedProduct?.sharedStockName
                      ? `Общий остаток группы: ${formatWeight(selectedProduct.availableStock, settings.weightPrecision)} кг`
                      : `Остаток: ${formatWeight(selectedProduct?.availableStock ?? 0, settings.weightPrecision)} кг`}
                  </p>
                </div>
                <button
                  className="price-badge"
                  type="button"
                  onClick={() => openKeypad("salePrice", "Цена за кг", saleEditor.salePrice, "₽")}
                >
                  <span>ЦЕНА</span>
                  <strong>{formatMoney(saleEditor.salePrice)} ₽/кг</strong>
                </button>
              </div>

              <div className="mode-grid">
                <button
                  className={`mode-tile ${saleEditor.mode === "by_weight" ? "active" : ""}`}
                  type="button"
                  onClick={() => openKeypad("quantity", "Введите вес", saleEditor.quantity, "кг")}
                >
                  <span>ВЕС</span>
                  <strong>{saleEditor.quantity > 0 ? `${formatWeight(saleEditor.quantity, settings.weightPrecision)} кг` : "Введите кг"}</strong>
                </button>
                <button
                  className={`mode-tile ${saleEditor.mode === "by_amount" ? "active" : ""}`}
                  type="button"
                  onClick={() => openKeypad("totalAmount", "Введите сумму", saleEditor.totalAmount, "₽")}
                >
                  <span>СУММА</span>
                  <strong>{saleEditor.totalAmount > 0 ? `${formatMoney(saleEditor.totalAmount)} ₽` : "Введите ₽"}</strong>
                </button>
              </div>

              <div className="result-panel">
                <MetricCard label="Товар" value={selectedProduct?.displayName ?? "Нет"} />
                <MetricCard
                  label="Цена"
                  value={`${formatMoney(saleEditor.salePrice)} ₽/кг`}
                  buttonLabel="Изменить"
                  onClick={() => openKeypad("salePrice", "Изменить цену", saleEditor.salePrice, "₽")}
                />
                <MetricCard
                  label="Вес"
                  value={`${formatWeight(saleEditor.quantity, settings.weightPrecision)} кг`}
                  buttonLabel="Изменить"
                  onClick={() => openKeypad("quantity", "Изменить вес", saleEditor.quantity, "кг")}
                />
                <MetricCard
                  label="Сумма"
                  value={`${formatMoney(saleEditor.totalAmount)} ₽`}
                  buttonLabel="Изменить"
                  onClick={() => openKeypad("totalAmount", "Изменить сумму", saleEditor.totalAmount, "₽")}
                />
                {saleEditor.discountAmount ? (
                  <>
                    <MetricCard label="Было" value={`${formatMoney(saleEditor.originalTotalAmount)} ₽`} />
                    <MetricCard label="Скидка" value={`-${formatMoney(saleEditor.discountAmount)} ₽`} accent="danger" />
                    <MetricCard label="Итого" value={`${formatMoney(saleEditor.finalTotalAmount)} ₽`} accent="primary" />
                  </>
                ) : (
                  <MetricCard label="Итого" value={`${formatMoney(saleEditor.finalTotalAmount)} ₽`} accent="primary" />
                )}
              </div>

              <div className="quick-actions">
                <ActionButton onClick={() => openKeypad("quantity", "Изменить вес", saleEditor.quantity, "кг")}>Изменить вес</ActionButton>
                <ActionButton onClick={() => openKeypad("totalAmount", "Изменить сумму", saleEditor.totalAmount, "₽")}>Изменить сумму</ActionButton>
                <ActionButton onClick={() => openKeypad("salePrice", "Изменить цену", saleEditor.salePrice, "₽")}>Изменить цену</ActionButton>
                <ActionButton onClick={() => setToolPanel((current) => (current === "discount" ? null : "discount"))}>Скидка</ActionButton>
                <ActionButton onClick={() => setToolPanel((current) => (current === "round" ? null : "round"))}>Округлить</ActionButton>
                <ActionButton onClick={() => setToolPanel((current) => (current === "change" ? null : "change"))}>Расчет</ActionButton>
                <ActionButton
                  onClick={() => {
                    if (!selectedProduct) {
                      return;
                    }
                    resetSale(selectedProduct);
                  }}
                >
                  Очистить
                </ActionButton>
              </div>

              {quickButtons.length > 0 && (
                <div className="quick-button-row">
                  {quickButtons.map((button) => (
                    <button key={button.id} className="quick-pill" type="button" onClick={() => quickApply(button)}>
                      {button.label}
                    </button>
                  ))}
                </div>
              )}

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
                    <button className="secondary-button" type="button" onClick={() => openKeypad("discountAmount", "Скидка в рублях", saleEditor.discountValue ?? "", "₽")}>
                      Ввести ₽
                    </button>
                    <button className="secondary-button" type="button" onClick={() => openKeypad("discountPercent", "Скидка в процентах", saleEditor.discountValue ?? "", "%")}>
                      Ввести %
                    </button>
                    <button className="ghost-button" type="button" onClick={() => setSaleEditor((current) => clearDiscount(current, settings.weightPrecision))}>
                      Сбросить скидку
                    </button>
                  </div>
                </Panel>
              )}

              {toolPanel === "round" && (
                <Panel title="Округление">
                  <div className="quick-button-row">
                    <button className="quick-pill" type="button" onClick={() => setSaleEditor((current) => roundSaleTotal(current, Math.ceil(current.totalAmount), settings.weightPrecision))}>
                      До целого
                    </button>
                    <button className="quick-pill" type="button" onClick={() => setSaleEditor((current) => roundSaleTotal(current, Math.ceil(current.totalAmount / 50) * 50, settings.weightPrecision))}>
                      До 50
                    </button>
                    <button className="quick-pill" type="button" onClick={() => setSaleEditor((current) => roundSaleTotal(current, Math.ceil(current.totalAmount / 100) * 100, settings.weightPrecision))}>
                      До 100
                    </button>
                    <button className="quick-pill" type="button" onClick={() => setSaleEditor((current) => roundSaleTotal(current, Math.ceil(current.totalAmount / 500) * 500, settings.weightPrecision))}>
                      До 500
                    </button>
                  </div>
                  <div className="panel-actions">
                    <button className="secondary-button" type="button" onClick={() => openKeypad("roundAmount", "Новая сумма", saleEditor.totalAmount, "₽")}>
                      Ввести сумму
                    </button>
                  </div>
                </Panel>
              )}

              {toolPanel === "change" && (
                <Panel title="Расчет сдачи">
                  <div className="change-grid">
                    <MetricCard label="К оплате" value={`${formatMoney(saleEditor.finalTotalAmount)} ₽`} accent="primary" />
                    <MetricCard label="Получено" value={`${formatMoney(saleEditor.receivedAmount ?? 0)} ₽`} />
                    <MetricCard label="Сдача" value={`${formatMoney(saleEditor.changeAmount ?? 0)} ₽`} accent="primary" />
                  </div>
                  <div className="panel-actions">
                    <button className="secondary-button" type="button" onClick={() => openKeypad("receivedAmount", "Получено от клиента", saleEditor.receivedAmount ?? "", "₽")}>
                      Ввести сумму
                    </button>
                  </div>
                </Panel>
              )}

              <NumberPad
                keypad={keypad}
                onAppend={appendKey}
                onBackspace={backspaceKey}
                onClear={clearKeypad}
                onSubmit={submitKeypad}
                onClose={() => setKeypad(null)}
              />
            </Section>

            <div className="sell-bar">
              <button className="sell-button" type="button" onClick={() => void persistSale()}>
                ПРОДАТЬ
              </button>
            </div>
          </>
        )}

        {screen === "products" && (
          <>
            <Section>
              <div className="section-header">
                <h2>Товары</h2>
                <button className="primary-button" type="button" onClick={() => setProductDraft(emptyProductDraft())}>
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
                  <Field label="Цена продажи">
                    <input inputMode="decimal" value={String(productDraft.defaultSalePrice || "")} onChange={(event) => setProductDraft({ ...productDraft, defaultSalePrice: parseNumber(event.target.value) })} />
                  </Field>
                  <Field label="Связать с общей партией">
                    <select value={productDraft.stockGroupId ?? ""} onChange={(event) => setProductDraft({ ...productDraft, stockGroupId: event.target.value || undefined })}>
                      <option value="">Без общей партии</option>
                      {stockGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {!productDraft.stockGroupId && (
                    <>
                      <Field label="Текущий остаток">
                        <input inputMode="decimal" value={String(productDraft.currentStock || "")} onChange={(event) => setProductDraft({ ...productDraft, currentStock: parseNumber(event.target.value) })} />
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
                    subtitle={`${formatMoney(product.defaultSalePrice)} ₽/кг`}
                    meta={product.sharedStockName ? `Общая группа: ${product.sharedStockName}` : `Свободный товар`}
                    side={`${formatWeight(product.availableStock, settings.weightPrecision)} кг`}
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
              <button className="primary-button" type="button" onClick={() => setGroupDraft(emptyGroupDraft())}>
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
                  subtitle={`Остаток ${formatWeight(group.currentStock, settings.weightPrecision)} кг`}
                  meta={`Связанные товары: ${products.filter((item) => item.stockGroupId === group.id && !item.isArchived).map((item) => [item.name, item.variant].filter(Boolean).join(" ")).join(", ") || "нет"}`}
                  side={`${formatMoney(group.averageCost)} ₽/кг`}
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
                <button className="primary-button" type="button" onClick={() => setReceiptDraft(emptyReceiptDraft())}>
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
                  <Field label="Количество">
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
                    subtitle={`${formatWeight(receipt.quantity, settings.weightPrecision)} кг x ${formatMoney(receipt.purchasePrice)} ₽`}
                    meta={`${receipt.source || "Без источника"} · ${formatDateTime(receipt.date)}`}
                    side={`${formatMoney(receipt.totalAmount)} ₽`}
                  />
                ))}
              </div>
            </Section>

            <Section>
              <div className="section-header">
                <h2>Списания</h2>
                <button className="primary-button" type="button" onClick={() => setWriteOffDraft(emptyWriteOffDraft())}>
                  <Plus size={18} /> Списание
                </button>
              </div>
              {writeOffDraft && (
                <EditorCard title="Новое списание" onCancel={() => setWriteOffDraft(null)} onSave={() => void saveWriteOff()}>
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
                  <Field label="Количество">
                    <input inputMode="decimal" value={writeOffDraft.quantity} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, quantity: event.target.value })} />
                  </Field>
                  <Field label="Причина">
                    <input value={writeOffDraft.reason} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, reason: event.target.value })} />
                  </Field>
                  <Field label="Комментарий">
                    <textarea value={writeOffDraft.comment} onChange={(event) => setWriteOffDraft({ ...writeOffDraft, comment: event.target.value })} />
                  </Field>
                </EditorCard>
              )}
              <div className="list-stack">
                {writeOffs.map((item) => (
                  <ListCard
                    key={item.id}
                    title={item.stockGroupId ? stockGroups.find((group) => group.id === item.stockGroupId)?.name ?? "Партия" : productViewMap.get(item.productId ?? "")?.displayName ?? "Товар"}
                    subtitle={`${formatWeight(item.quantity, settings.weightPrecision)} кг`}
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
              <h2>Расходы</h2>
              <button className="primary-button" type="button" onClick={() => setExpenseDraft(emptyExpenseDraft())}>
                <Plus size={18} /> Добавить
              </button>
            </div>
            {expenseDraft && (
              <EditorCard title="Расход" onCancel={() => setExpenseDraft(null)} onSave={() => void saveExpense()}>
                <Field label="Категория">
                  <input value={expenseDraft.category} onChange={(event) => setExpenseDraft({ ...expenseDraft, category: event.target.value })} />
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
                <h2>Отчеты</h2>
                <span>По локальным данным</span>
              </div>
              <div className="stats-grid">
                <StatCard icon={<Wallet size={20} />} label="Выручка" value={`${formatMoney(report.revenue)} ₽`} />
                <StatCard icon={<Receipt size={20} />} label="Закупка" value={`${formatMoney(report.purchase)} ₽`} />
                <StatCard icon={<ClipboardList size={20} />} label="Расходы" value={`${formatMoney(report.expenses)} ₽`} />
                <StatCard icon={<Archive size={20} />} label="Списания" value={`${formatMoney(report.writeOffs)} ₽`} />
                <StatCard icon={<Boxes size={20} />} label="Остатки" value={`${formatMoney(report.stockValue)} ₽`} />
                <StatCard icon={<TrendingUp size={20} />} label="Прибыль" value={`${formatMoney(report.profit)} ₽`} />
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
                    subtitle={`${formatMoney(product.defaultSalePrice)} ₽/кг`}
                    meta={product.sharedStockName ? `Общая партия` : "Обычный товар"}
                    side={`${formatWeight(product.availableStock, settings.weightPrecision)} кг`}
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
                        title: "Сбросить данные?",
                        text: "Приложение перезагрузится и вернет демо-данные.",
                        action: () => resetToDemo()
                      })
                    }
                  >
                    <RotateCcw size={18} /> Demo reset
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

      <nav className="bottom-nav">
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
  accent?: "primary" | "danger";
}) {
  return (
    <div className={`metric-card ${accent ?? ""}`.trim()}>
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
  onAppend,
  onBackspace,
  onClear,
  onSubmit,
  onClose
}: {
  keypad: KeypadState | null;
  onAppend: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const numberKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"];

  return (
    <div className="number-pad">
      <div className="section-header">
        <div>
          <h3>{keypad?.title ?? "Панель ввода"}</h3>
          <p>{keypad ? keypad.suffix : "Выберите вес, сумму или цену"}</p>
        </div>
        {keypad ? (
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        ) : null}
      </div>
      <div className="pad-display">{keypad ? `${keypad.value || 0} ${keypad.suffix}` : "0"}</div>
      <div className="pad-grid">
        {numberKeys.map((key) => (
          <button key={key} className="pad-key" type="button" disabled={!keypad} onClick={() => onAppend(key)}>
            {key}
          </button>
        ))}
        <button className="pad-key utility" type="button" disabled={!keypad} onClick={onClear}>
          C
        </button>
        <button className="pad-key utility" type="button" disabled={!keypad} onClick={onBackspace}>
          ←
        </button>
        <button className="pad-key utility" type="button" disabled={!keypad} onClick={onSubmit}>
          кг
        </button>
        <button className="pad-key utility" type="button" disabled={!keypad} onClick={onSubmit}>
          ₽
        </button>
        <button className="pad-key confirm" type="button" disabled={!keypad} onClick={onSubmit}>
          OK
        </button>
      </div>
    </div>
  );
}

function screenLabel(screen: Screen) {
  const labels: Record<Screen, string> = {
    sale: "Быстрая продажа",
    products: "Товары",
    groups: "Общие партии",
    receipts: "Поступления и списания",
    writeOffs: "Списания",
    expenses: "Расходы",
    history: "История",
    reports: "Отчеты",
    settings: "Настройки"
  };

  return labels[screen];
}

function historyTypeLabel(type: "sale" | "receipt" | "expense" | "writeOff") {
  return {
    sale: "Продажа",
    receipt: "Поступление",
    expense: "Расход",
    writeOff: "Списание"
  }[type];
}

function targetLabel(item: ProductView | StockGroup) {
  return "displayName" in item ? item.displayName : item.name;
}

export default App;
