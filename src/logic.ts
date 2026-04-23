import type { AppSettings, BaseField, DiscountType, ProductView, SaleMode } from "./types";
import { toMoney, toWeight } from "./utils";

export interface SaleEditor {
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
}

export const defaultSettings: AppSettings = {
  id: "main",
  theme: "light",
  weightPrecision: 2,
  currencySymbol: "₽",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const createEmptySaleEditor = (product?: ProductView): SaleEditor => ({
  quantity: 0,
  salePrice: product?.defaultSalePrice ?? 0,
  totalAmount: 0,
  originalTotalAmount: 0,
  finalTotalAmount: 0,
  mode: "by_weight",
  activeBaseField: "quantity"
});

export const recalcSaleEditor = (
  editor: SaleEditor,
  patch: Partial<SaleEditor>,
  precision: number
): SaleEditor => {
  const next = { ...editor, ...patch };
  const price = Math.max(0, next.salePrice || 0);
  let quantity = Math.max(0, next.quantity || 0);
  let totalAmount = Math.max(0, next.totalAmount || 0);

  if (next.activeBaseField === "quantity") {
    totalAmount = toMoney(quantity * price);
  } else {
    quantity = price > 0 ? toWeight(totalAmount / price, precision) : 0;
  }

  const originalTotalAmount =
    patch.originalTotalAmount !== undefined
      ? Math.max(0, patch.originalTotalAmount)
      : next.discountAmount
        ? Math.max(totalAmount, next.originalTotalAmount)
        : totalAmount;

  const discountAmount = next.discountAmount ? Math.min(originalTotalAmount, Math.max(0, next.discountAmount)) : 0;
  const finalTotalAmount = toMoney(Math.max(0, totalAmount - discountAmount));
  const receivedAmount =
    next.receivedAmount !== undefined && next.receivedAmount > 0 ? toMoney(next.receivedAmount) : undefined;
  const changeAmount = receivedAmount !== undefined ? toMoney(Math.max(0, receivedAmount - finalTotalAmount)) : undefined;

  return {
    ...next,
    quantity,
    totalAmount,
    originalTotalAmount,
    discountType: discountAmount > 0 ? next.discountType : undefined,
    discountValue: discountAmount > 0 ? next.discountValue : undefined,
    discountAmount: discountAmount > 0 ? discountAmount : undefined,
    finalTotalAmount,
    receivedAmount,
    changeAmount
  };
};

export const clearDiscount = (editor: SaleEditor, precision: number) =>
  recalcSaleEditor(
    editor,
    {
      discountType: undefined,
      discountValue: undefined,
      discountAmount: undefined,
      originalTotalAmount: editor.totalAmount
    },
    precision
  );

export const applyDiscount = (
  editor: SaleEditor,
  type: DiscountType,
  value: number,
  precision: number
) => {
  const originalTotalAmount = editor.totalAmount;
  const safeValue = Math.max(0, value);
  const discountAmount =
    type === "amount" ? Math.min(originalTotalAmount, safeValue) : toMoney((originalTotalAmount * safeValue) / 100);

  return recalcSaleEditor(
    editor,
    {
      discountType: type,
      discountValue: safeValue,
      discountAmount,
      originalTotalAmount
    },
    precision
  );
};

export const roundSaleTotal = (editor: SaleEditor, target: number, precision: number) =>
  recalcSaleEditor(
    clearDiscount(editor, precision),
    {
      totalAmount: Math.max(0, target),
      activeBaseField: "totalAmount",
      mode: "by_amount"
    },
    precision
  );

export const editWeight = (editor: SaleEditor, quantity: number, precision: number) =>
  recalcSaleEditor(
    clearDiscount(editor, precision),
    {
      quantity: Math.max(0, quantity),
      activeBaseField: "quantity",
      mode: "by_weight"
    },
    precision
  );

export const editTotal = (editor: SaleEditor, totalAmount: number, precision: number) =>
  recalcSaleEditor(
    clearDiscount(editor, precision),
    {
      totalAmount: Math.max(0, totalAmount),
      activeBaseField: "totalAmount",
      mode: "by_amount"
    },
    precision
  );

export const editPrice = (editor: SaleEditor, salePrice: number, precision: number) =>
  recalcSaleEditor(clearDiscount(editor, precision), { salePrice: Math.max(0, salePrice) }, precision);

export const setReceivedAmount = (editor: SaleEditor, receivedAmount: number, precision: number) =>
  recalcSaleEditor(editor, { receivedAmount: Math.max(0, receivedAmount) }, precision);
