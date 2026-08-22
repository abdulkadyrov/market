import type { AppSettings, BaseField, DiscountType, ProductView, SaleMode } from "./types";
import { toMoney, toWeight } from "./utils";
import { DEFAULT_PROFILE_ID } from "./profiles";

export interface SaleEditor {
  requestedQuantity?: number;
  requestedAmount: number;
  differenceAmount: number;
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
  activeProfileId: DEFAULT_PROFILE_ID,
  theme: "light",
  weightPrecision: 2,
  currencySymbol: "₽",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const createEmptySaleEditor = (product?: ProductView): SaleEditor => ({
  requestedAmount: 0,
  differenceAmount: 0,
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
  const requestedAmount = toMoney(Math.max(0, next.requestedAmount || 0));
  const differenceAmount = toMoney(finalTotalAmount - requestedAmount);
  const receivedAmount =
    next.receivedAmount !== undefined && next.receivedAmount > 0 ? toMoney(next.receivedAmount) : undefined;
  const changeAmount = receivedAmount !== undefined ? toMoney(Math.max(0, receivedAmount - finalTotalAmount)) : undefined;

  return {
    ...next,
    requestedAmount,
    differenceAmount,
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

export const editWeight = (editor: SaleEditor, quantity: number, precision: number) => {
  const requestedQuantity = Math.max(0, quantity);
  const requestedAmount = toMoney(requestedQuantity * Math.max(0, editor.salePrice));
  return recalcSaleEditor(
    clearDiscount(editor, precision),
    {
      requestedQuantity,
      requestedAmount,
      quantity: requestedQuantity,
      totalAmount: requestedAmount,
      activeBaseField: "quantity",
      mode: "by_weight"
    },
    precision
  );
};

export const editTotal = (editor: SaleEditor, totalAmount: number, precision: number) => {
  const requestedAmount = Math.max(0, totalAmount);
  return recalcSaleEditor(
    clearDiscount(editor, precision),
    {
      requestedQuantity: undefined,
      requestedAmount,
      totalAmount: requestedAmount,
      activeBaseField: "totalAmount",
      mode: "by_amount"
    },
    precision
  );
};

export const editPieceAmount = (editor: SaleEditor, totalAmount: number, precision: number) => {
  const requestedAmount = Math.max(0, totalAmount);
  const quantity = editor.salePrice > 0 ? Math.ceil(requestedAmount / editor.salePrice) : 0;
  const actualAmount = toMoney(quantity * Math.max(0, editor.salePrice));

  return recalcSaleEditor(
    clearDiscount(editor, precision),
    {
      requestedQuantity: undefined,
      requestedAmount,
      quantity,
      totalAmount: actualAmount,
      activeBaseField: "quantity",
      mode: "by_amount"
    },
    precision
  );
};

export const editActualTotal = (editor: SaleEditor, totalAmount: number, precision: number) =>
  recalcSaleEditor(
    clearDiscount(editor, precision),
    {
      totalAmount: Math.max(0, totalAmount),
      activeBaseField: "totalAmount"
    },
    precision
  );

export const editPrice = (editor: SaleEditor, salePrice: number, precision: number) => {
  const next = { ...clearDiscount(editor, precision), salePrice: Math.max(0, salePrice) };
  if (next.mode === "by_weight" && next.requestedQuantity) {
    return editWeight(next, next.requestedQuantity, precision);
  }
  if (next.mode === "by_amount" && next.requestedAmount) {
    return editTotal(next, next.requestedAmount, precision);
  }
  return recalcSaleEditor(next, {}, precision);
};

export const setReceivedAmount = (editor: SaleEditor, receivedAmount: number, precision: number) =>
  recalcSaleEditor(editor, { receivedAmount: Math.max(0, receivedAmount) }, precision);

export const calculatePriceDiscount = (originalPrice: number, salePrice: number, quantity: number) =>
  toMoney(Math.max(0, originalPrice - salePrice) * Math.max(0, quantity));

export const calculateWriteOffQuantity = (
  inputMode: "weight" | "packages",
  quantity: number,
  packageCount: number,
  packageWeight: number,
  precision: number
) =>
  toWeight(
    inputMode === "packages"
      ? Math.max(0, packageCount) * Math.max(0, packageWeight)
      : Math.max(0, quantity),
    precision
  );
