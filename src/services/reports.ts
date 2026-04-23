import type {
  Buyer,
  DebtPayment,
  Expense,
  OperationLog,
  Product,
  ProductAnalytics,
  Receipt,
  Sale,
  WriteOff
} from "../types";
import { clampMoney, seasonRangeStart } from "../utils";

export type ReportRange = "today" | "yesterday" | "week" | "month" | "season" | "custom";

export interface RangeValue {
  from: string;
  to: string;
}

export interface ReportSummary {
  revenue: number;
  purchase: number;
  expenses: number;
  writeOffs: number;
  profit: number;
  stock: number;
  salesCount: number;
  wholesaleSales: number;
  debts: number;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const resolveRange = (range: ReportRange, custom?: RangeValue): RangeValue => {
  const now = new Date();

  if (range === "custom" && custom) {
    return custom;
  }

  if (range === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const start = startOfDay(yesterday);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (range === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: startOfDay(start).toISOString(), to: now.toISOString() };
  }

  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString(), to: now.toISOString() };
  }

  if (range === "season") {
    return { from: seasonRangeStart(), to: now.toISOString() };
  }

  const start = startOfDay(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
};

const isWithin = (date: string, range: RangeValue) => {
  const value = new Date(date).getTime();
  return value >= new Date(range.from).getTime() && value <= new Date(range.to).getTime();
};

export const productAnalytics = (product: Product): ProductAnalytics => {
  const stockCost = clampMoney(product.currentStock * product.averageCost);
  const potentialRevenue = clampMoney(product.currentStock * product.defaultSalePrice);
  return {
    stockCost,
    potentialRevenue,
    potentialProfit: clampMoney(potentialRevenue - stockCost)
  };
};

export const buildSummary = (
  products: Product[],
  receipts: Receipt[],
  sales: Sale[],
  expenses: Expense[],
  writeOffs: WriteOff[],
  debts: DebtPayment[],
  range: RangeValue
): ReportSummary => {
  const filteredReceipts = receipts.filter((item) => isWithin(item.date, range));
  const filteredSales = sales.filter((item) => isWithin(item.date, range));
  const filteredExpenses = expenses.filter((item) => isWithin(item.date, range));
  const filteredWriteOffs = writeOffs.filter((item) => isWithin(item.date, range));

  const revenue = filteredSales.reduce((sum, item) => sum + item.totalAmount, 0);
  const purchase = filteredReceipts.reduce((sum, item) => sum + item.totalAmount, 0);
  const expensesTotal = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const writeOffsValue = filteredWriteOffs.reduce((sum, item) => {
    const product = products.find((productItem) => productItem.id === item.productId);
    return sum + item.quantity * (product?.averageCost ?? 0);
  }, 0);
  const costOfGoodsSold = filteredSales.reduce((sum, item) => {
    const product = products.find((productItem) => productItem.id === item.productId);
    return sum + item.quantity * (product?.averageCost ?? 0);
  }, 0);
  const stock = products.reduce((sum, item) => sum + item.currentStock, 0);
  const wholesaleSales = filteredSales.filter((item) => item.saleType === "wholesale").length;
  const debtsTotal = debts.filter((item) => item.status === "active").reduce((sum, item) => sum + item.remainingAmount, 0);

  return {
    revenue: clampMoney(revenue),
    purchase: clampMoney(purchase),
    expenses: clampMoney(expensesTotal),
    writeOffs: clampMoney(writeOffsValue),
    profit: clampMoney(revenue - costOfGoodsSold - expensesTotal - writeOffsValue),
    stock: clampMoney(stock),
    salesCount: filteredSales.length,
    wholesaleSales,
    debts: clampMoney(debtsTotal)
  };
};

export const groupByProduct = (products: Product[], receipts: Receipt[], sales: Sale[], writeOffs: WriteOff[], range: RangeValue) =>
  products.map((product) => {
    const received = receipts.filter((item) => item.productId === product.id && isWithin(item.date, range));
    const sold = sales.filter((item) => item.productId === product.id && isWithin(item.date, range));
    const lost = writeOffs.filter((item) => item.productId === product.id && isWithin(item.date, range));
    const revenue = sold.reduce((sum, item) => sum + item.totalAmount, 0);
    const cost = sold.reduce((sum, item) => sum + item.quantity * product.averageCost, 0);

    return {
      product,
      receivedQuantity: received.reduce((sum, item) => sum + item.quantity, 0),
      soldQuantity: sold.reduce((sum, item) => sum + item.quantity, 0),
      writeOffQuantity: lost.reduce((sum, item) => sum + item.quantity, 0),
      revenue: clampMoney(revenue),
      profit: clampMoney(revenue - cost),
      remainingStock: product.currentStock
    };
  });

export const groupByBuyer = (buyers: Buyer[], sales: Sale[], debts: DebtPayment[], range: RangeValue) =>
  buyers.map((buyer) => {
    const buyerSales = sales.filter((item) => item.buyerId === buyer.id && isWithin(item.date, range));
    const total = buyerSales.reduce((sum, item) => sum + item.totalAmount, 0);
    const debt = debts
      .filter((item) => item.buyerId === buyer.id && item.status === "active")
      .reduce((sum, item) => sum + item.remainingAmount, 0);

    return {
      buyer,
      total,
      count: buyerSales.length,
      averageCheck: buyerSales.length ? clampMoney(total / buyerSales.length) : 0,
      debt
    };
  });

export const recentOperations = (operations: OperationLog[], limit = 20) =>
  [...operations].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
