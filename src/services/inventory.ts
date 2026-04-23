import { db } from "../db";
import type {
  Buyer,
  DebtPayment,
  Expense,
  OperationLog,
  PaymentStatus,
  Product,
  QuickButtonSetting,
  Receipt,
  Sale,
  SaleMode,
  SaleType,
  StockAdjustment,
  WriteOff
} from "../types";
import { clampMoney, formatQuickButtonLabel, makeId, nowIso } from "../utils";

export interface SaleDraft {
  productId: string;
  buyerId?: string;
  date: string;
  quantity: number;
  salePrice: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  saleType: SaleType;
  mode: SaleMode;
  comment: string;
}

const addOperation = async (operation: OperationLog) => {
  await db.operationLogs.add(operation);
};

export const saveProduct = async (input: Omit<Product, "createdAt" | "updatedAt" | "currentStock" | "averageCost"> & Partial<Pick<Product, "createdAt" | "updatedAt" | "currentStock" | "averageCost">>) => {
  const timestamp = nowIso();
  const payload: Product = {
    currentStock: input.currentStock ?? 0,
    averageCost: input.averageCost ?? input.defaultPurchasePrice ?? 0,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
    ...input
  };

  await db.products.put(payload);
  return payload;
};

export const archiveProduct = async (productId: string) => {
  const product = await db.products.get(productId);
  if (!product) return;
  await db.products.put({
    ...product,
    isArchived: true,
    updatedAt: nowIso()
  });
};

export const saveBuyer = async (input: Omit<Buyer, "createdAt" | "updatedAt"> & Partial<Pick<Buyer, "createdAt" | "updatedAt">>) => {
  const timestamp = nowIso();
  const payload: Buyer = {
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
    ...input
  };

  await db.buyers.put(payload);
  return payload;
};

export const archiveBuyer = async (buyerId: string) => {
  const buyer = await db.buyers.get(buyerId);
  if (!buyer) return;
  await db.buyers.put({
    ...buyer,
    isArchived: true,
    updatedAt: nowIso()
  });
};

export const addReceipt = async (input: Omit<Receipt, "id" | "createdAt" | "updatedAt">) => {
  const product = await db.products.get(input.productId);
  if (!product) {
    throw new Error("Товар не найден");
  }

  const timestamp = nowIso();
  const receipt: Receipt = {
    id: makeId("receipt"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...input,
    totalAmount: clampMoney(input.totalAmount)
  };

  const newStock = clampMoney(product.currentStock + receipt.quantity);
  const currentStockValue = product.currentStock * product.averageCost;
  const newAverageCost = newStock > 0 ? clampMoney((currentStockValue + receipt.totalAmount) / newStock) : product.averageCost;

  await db.transaction("rw", db.receipts, db.products, db.operationLogs, async () => {
    await db.receipts.add(receipt);
    await db.products.put({
      ...product,
      currentStock: newStock,
      averageCost: newAverageCost,
      updatedAt: timestamp
    });
    await addOperation({
      id: makeId("op"),
      type: "receipt",
      entityId: receipt.id,
      productId: receipt.productId,
      date: receipt.date,
      quantity: receipt.quantity,
      price: receipt.purchasePrice,
      amount: receipt.totalAmount,
      comment: receipt.comment
    });
  });
};

export const addSale = async (draft: SaleDraft) => {
  const product = await db.products.get(draft.productId);
  if (!product) {
    throw new Error("Выберите товар");
  }

  if (draft.quantity <= 0 || draft.salePrice <= 0 || draft.totalAmount <= 0) {
    throw new Error("Проверьте количество, цену и сумму");
  }

  if (draft.quantity > product.currentStock) {
    throw new Error("Продажа больше остатка товара");
  }

  if ((draft.paymentStatus === "partial" || draft.paymentStatus === "debt") && !draft.buyerId) {
    throw new Error("Для долга нужно выбрать покупателя");
  }

  const paidAmount =
    draft.paymentStatus === "paid"
      ? draft.totalAmount
      : draft.paymentStatus === "debt"
        ? 0
        : clampMoney(draft.paidAmount);

  if (paidAmount > draft.totalAmount) {
    throw new Error("Оплачено сейчас не может быть больше суммы продажи");
  }

  const debtAmount = clampMoney(draft.totalAmount - paidAmount);
  const timestamp = nowIso();
  const sale: Sale = {
    id: makeId("sale"),
    buyerId: draft.buyerId,
    productId: draft.productId,
    date: draft.date,
    quantity: clampMoney(draft.quantity),
    salePrice: clampMoney(draft.salePrice),
    totalAmount: clampMoney(draft.totalAmount),
    paymentStatus: debtAmount === 0 ? "paid" : draft.paymentStatus,
    paidAmount,
    debtAmount,
    saleType: draft.saleType,
    mode: draft.mode,
    comment: draft.comment,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.transaction(
    "rw",
    db.sales,
    db.products,
    db.debtPayments,
    db.operationLogs,
    async () => {
      await db.sales.add(sale);
      await db.products.put({
        ...product,
        currentStock: clampMoney(product.currentStock - sale.quantity),
        updatedAt: timestamp
      });
      await addOperation({
        id: makeId("op"),
        type: "sale",
        entityId: sale.id,
        productId: sale.productId,
        buyerId: sale.buyerId,
        date: sale.date,
        quantity: sale.quantity,
        price: sale.salePrice,
        amount: sale.totalAmount,
        comment: sale.comment
      });

      if (sale.debtAmount > 0 && sale.buyerId) {
        const debt: DebtPayment = {
          id: makeId("debt"),
          saleId: sale.id,
          buyerId: sale.buyerId,
          date: sale.date,
          totalAmount: sale.totalAmount,
          paidAmount: sale.paidAmount,
          remainingAmount: sale.debtAmount,
          status: sale.debtAmount > 0 ? "active" : "closed",
          comment: sale.comment,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        await db.debtPayments.add(debt);
      }
    }
  );
};

export const addDebtPayment = async (debtId: string, amount: number, comment: string) => {
  const debt = await db.debtPayments.get(debtId);
  if (!debt) {
    throw new Error("Долг не найден");
  }

  if (amount <= 0 || amount > debt.remainingAmount) {
    throw new Error("Сумма оплаты должна быть больше нуля и не больше остатка долга");
  }

  const sale = await db.sales.get(debt.saleId);
  const timestamp = nowIso();
  const paidAmount = clampMoney(debt.paidAmount + amount);
  const remainingAmount = clampMoney(debt.totalAmount - paidAmount);

  await db.transaction("rw", db.debtPayments, db.sales, db.operationLogs, async () => {
    await db.debtPayments.put({
      ...debt,
      paidAmount,
      remainingAmount,
      status: remainingAmount === 0 ? "closed" : "active",
      comment: comment || debt.comment,
      updatedAt: timestamp
    });

    if (sale) {
      await db.sales.put({
        ...sale,
        paymentStatus: remainingAmount === 0 ? "paid" : "partial",
        paidAmount,
        debtAmount: remainingAmount,
        updatedAt: timestamp
      });
    }

    await addOperation({
      id: makeId("op"),
      type: "debtPayment",
      entityId: debt.id,
      buyerId: debt.buyerId,
      date: timestamp,
      amount,
      comment
    });
  });
};

export const saveExpense = async (input: Omit<Expense, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Expense, "id" | "createdAt">>) => {
  const timestamp = nowIso();
  const expense: Expense = {
    id: input.id ?? makeId("expense"),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
    ...input
  };

  await db.transaction("rw", db.expenses, db.operationLogs, async () => {
    await db.expenses.put(expense);
    await addOperation({
      id: makeId("op"),
      type: "expense",
      entityId: expense.id,
      date: expense.date,
      amount: expense.amount,
      comment: expense.comment
    });
  });
};

export const deleteExpense = async (expenseId: string) => {
  await db.expenses.delete(expenseId);
};

export const addWriteOff = async (input: Omit<WriteOff, "id" | "createdAt" | "updatedAt">) => {
  const product = await db.products.get(input.productId);
  if (!product) throw new Error("Товар не найден");
  if (input.quantity > product.currentStock) throw new Error("Списание больше остатка");
  const timestamp = nowIso();
  const payload: WriteOff = {
    id: makeId("writeoff"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...input
  };

  await db.transaction("rw", db.writeOffs, db.products, db.operationLogs, async () => {
    await db.writeOffs.add(payload);
    await db.products.put({
      ...product,
      currentStock: clampMoney(product.currentStock - input.quantity),
      updatedAt: timestamp
    });
    await addOperation({
      id: makeId("op"),
      type: "writeOff",
      entityId: payload.id,
      productId: payload.productId,
      date: payload.date,
      quantity: payload.quantity,
      comment: payload.reason
    });
  });
};

export const addStockAdjustment = async (input: Omit<StockAdjustment, "id" | "createdAt" | "updatedAt" | "previousStock">) => {
  const product = await db.products.get(input.productId);
  if (!product) throw new Error("Товар не найден");
  const timestamp = nowIso();
  const payload: StockAdjustment = {
    id: makeId("adjustment"),
    previousStock: product.currentStock,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...input
  };

  await db.transaction("rw", db.stockAdjustments, db.products, db.operationLogs, async () => {
    await db.stockAdjustments.add(payload);
    await db.products.put({
      ...product,
      currentStock: payload.actualStock,
      updatedAt: timestamp
    });
    await addOperation({
      id: makeId("op"),
      type: "adjustment",
      entityId: payload.id,
      productId: payload.productId,
      date: payload.date,
      quantity: payload.actualStock,
      comment: payload.reason,
      meta: JSON.stringify({
        previousStock: payload.previousStock,
        actualStock: payload.actualStock
      })
    });
  });
};

export const saveQuickButton = async (input: Omit<QuickButtonSetting, "createdAt" | "updatedAt" | "label"> & Partial<Pick<QuickButtonSetting, "createdAt" | "updatedAt" | "label">>) => {
  const timestamp = nowIso();
  const payload: QuickButtonSetting = {
    ...input,
    label: input.label ?? formatQuickButtonLabel(input.type, input.value),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp
  };
  await db.quickButtonSettings.put(payload);
};

export const deleteQuickButton = async (id: string) => {
  await db.quickButtonSettings.delete(id);
};
