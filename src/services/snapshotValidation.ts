import type { AppSnapshot } from "../types";
import {
  createDefaultBazaarLocations,
  createDefaultProfile,
  DEFAULT_BAZAAR_LOCATION_ID,
  DEFAULT_PROFILE_ID
} from "../profiles";

type JsonRecord = Record<string, unknown>;

const collections = [
  "bazaarLocations",
  "storeProfiles",
  "stockGroups",
  "products",
  "receipts",
  "sales",
  "expenses",
  "writeOffs",
  "quickButtonSettings",
  "appSettings"
] as const;

const units = new Set(["kg", "piece", "box", "bag", "net", "other"]);

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fail = (path: string, message: string): never => {
  throw new Error(`Некорректный импорт: ${path} — ${message}`);
};

const requireString = (record: JsonRecord, key: string, path: string, allowEmpty = true) => {
  const value = record[key];
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    fail(`${path}.${key}`, allowEmpty ? "ожидалась строка" : "поле не должно быть пустым");
  }
  return value as string;
};

const optionalString = (record: JsonRecord, key: string, path: string) => {
  const value = record[key];
  if (value !== undefined && typeof value !== "string") {
    fail(`${path}.${key}`, "ожидалась строка");
  }
  return value as string | undefined;
};

const requireNumber = (
  record: JsonRecord,
  key: string,
  path: string,
  { positive = false }: { positive?: boolean } = {}
) => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (positive && value <= 0)) {
    fail(`${path}.${key}`, positive ? "ожидалось положительное число" : "ожидалось неотрицательное число");
  }
  return value as number;
};

const optionalNumber = (record: JsonRecord, key: string, path: string) => {
  const value = record[key];
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
    fail(`${path}.${key}`, "ожидалось неотрицательное число");
  }
  return value as number | undefined;
};

const optionalSignedNumber = (record: JsonRecord, key: string, path: string) => {
  const value = record[key];
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
    fail(`${path}.${key}`, "ожидалось число");
  }
  return value as number | undefined;
};

const requireBoolean = (record: JsonRecord, key: string, path: string) => {
  const value = record[key];
  if (typeof value !== "boolean") {
    fail(`${path}.${key}`, "ожидалось логическое значение");
  }
  return value as boolean;
};

const optionalBoolean = (record: JsonRecord, key: string, path: string) => {
  const value = record[key];
  if (value !== undefined && typeof value !== "boolean") {
    fail(`${path}.${key}`, "ожидалось логическое значение");
  }
  return value as boolean | undefined;
};

const requireEnum = (record: JsonRecord, key: string, allowed: Set<string>, path: string) => {
  const value = requireString(record, key, path, false);
  if (!allowed.has(value)) {
    fail(`${path}.${key}`, `неподдерживаемое значение «${value}»`);
  }
  return value;
};

const requireRows = (root: JsonRecord, collection: (typeof collections)[number]) => {
  const rows = root[collection];
  if (!Array.isArray(rows)) {
    fail(collection, "ожидался массив");
  }
  return (rows as unknown[]).map((row, index) => {
    if (!isRecord(row)) {
      fail(`${collection}[${index}]`, "ожидался объект");
    }
    return row as JsonRecord;
  });
};

const validateCommon = (record: JsonRecord, path: string) => {
  requireString(record, "id", path, false);
  requireString(record, "createdAt", path, false);
  requireString(record, "updatedAt", path, false);
};

const assertUniqueIds = (rows: JsonRecord[], collection: string) => {
  const ids = new Set<string>();
  rows.forEach((row, index) => {
    const id = requireString(row, "id", `${collection}[${index}]`, false);
    if (ids.has(id)) {
      fail(`${collection}[${index}].id`, `повторяющийся id «${id}»`);
    }
    ids.add(id);
  });
  return ids;
};

export const parseSnapshot = (value: unknown): AppSnapshot => {
  if (!isRecord(value)) {
    fail("файл", "ожидался JSON-объект");
  }
  const inputRoot = value as JsonRecord;
  if (inputRoot.schemaVersion !== undefined && (typeof inputRoot.schemaVersion !== "number" || inputRoot.schemaVersion > 4)) {
    fail("schemaVersion", "версия файла новее поддерживаемой");
  }
  const root = normalizeLegacySnapshot(inputRoot);

  const rows = Object.fromEntries(collections.map((name) => [name, requireRows(root, name)])) as Record<
    (typeof collections)[number],
    JsonRecord[]
  >;

  const ids = Object.fromEntries(collections.map((name) => [name, assertUniqueIds(rows[name], name)])) as Record<
    (typeof collections)[number],
    Set<string>
  >;

  rows.bazaarLocations.forEach((row, index) => {
    const path = `bazaarLocations[${index}]`;
    validateCommon(row, path);
    requireString(row, "city", path, false);
    requireString(row, "marketName", path, false);
    requireString(row, "pointName", path);
    requireBoolean(row, "isArchived", path);
  });

  rows.storeProfiles.forEach((row, index) => {
    const path = `storeProfiles[${index}]`;
    validateCommon(row, path);
    const bazaarLocationId = requireString(row, "bazaarLocationId", path, false);
    if (!ids.bazaarLocations.has(bazaarLocationId)) {
      fail(`${path}.bazaarLocationId`, "базар или место не найдено");
    }
    requireString(row, "name", path, false);
    requireString(row, "city", path, false);
    requireString(row, "marketName", path, false);
    requireString(row, "pointName", path);
    requireBoolean(row, "isArchived", path);
  });

  const requireProfile = (row: JsonRecord, path: string) => {
    const profileId = requireString(row, "profileId", path, false);
    if (!ids.storeProfiles.has(profileId)) {
      fail(`${path}.profileId`, "профиль не найден");
    }
    return profileId;
  };

  const stockGroupProfiles = new Map<string, string>();
  const productProfiles = new Map<string, string>();

  rows.stockGroups.forEach((row, index) => {
    const path = `stockGroups[${index}]`;
    validateCommon(row, path);
    const profileId = requireProfile(row, path);
    stockGroupProfiles.set(requireString(row, "id", path, false), profileId);
    requireString(row, "name", path, false);
    requireEnum(row, "unit", units, path);
    requireNumber(row, "currentStock", path);
    requireNumber(row, "averageCost", path);
    requireString(row, "notes", path);
  });

  rows.products.forEach((row, index) => {
    const path = `products[${index}]`;
    validateCommon(row, path);
    const profileId = requireProfile(row, path);
    productProfiles.set(requireString(row, "id", path, false), profileId);
    requireString(row, "name", path, false);
    requireString(row, "variant", path);
    requireString(row, "category", path, false);
    requireEnum(row, "unit", units, path);
    requireNumber(row, "currentStock", path);
    optionalBoolean(row, "isUnlimitedStock", path);
    requireNumber(row, "averageCost", path);
    requireNumber(row, "defaultSalePrice", path);
    requireString(row, "notes", path);
    requireBoolean(row, "isArchived", path);
    const stockGroupId = optionalString(row, "stockGroupId", path);
    if (stockGroupId && !ids.stockGroups.has(stockGroupId)) {
      fail(`${path}.stockGroupId`, "партия не найдена");
    }
    if (stockGroupId && stockGroupProfiles.get(stockGroupId) !== profileId) {
      fail(`${path}.stockGroupId`, "партия принадлежит другому профилю");
    }
  });

  rows.receipts.forEach((row, index) => {
    const path = `receipts[${index}]`;
    validateCommon(row, path);
    const profileId = requireProfile(row, path);
    requireString(row, "date", path, false);
    requireNumber(row, "quantity", path, { positive: true });
    requireNumber(row, "purchasePrice", path, { positive: true });
    requireNumber(row, "totalAmount", path);
    requireString(row, "source", path);
    requireString(row, "comment", path);
    validateTarget(row, path, ids.stockGroups, ids.products);
    validateTargetProfile(row, path, profileId, stockGroupProfiles, productProfiles);
  });

  rows.sales.forEach((row, index) => {
    const path = `sales[${index}]`;
    validateCommon(row, path);
    const profileId = requireProfile(row, path);
    const productId = requireString(row, "productId", path, false);
    if (!ids.products.has(productId)) {
      fail(`${path}.productId`, "товар не найден");
    }
    if (productProfiles.get(productId) !== profileId) {
      fail(`${path}.productId`, "товар принадлежит другому профилю");
    }
    const stockGroupId = optionalString(row, "stockGroupId", path);
    if (stockGroupId && !ids.stockGroups.has(stockGroupId)) {
      fail(`${path}.stockGroupId`, "партия не найдена");
    }
    if (stockGroupId && stockGroupProfiles.get(stockGroupId) !== profileId) {
      fail(`${path}.stockGroupId`, "партия принадлежит другому профилю");
    }
    optionalString(row, "saleBatchId", path);
    requireString(row, "date", path, false);
    optionalNumber(row, "requestedQuantity", path);
    optionalNumber(row, "requestedAmount", path);
    optionalSignedNumber(row, "differenceAmount", path);
    requireNumber(row, "quantity", path, { positive: true });
    requireNumber(row, "salePrice", path, { positive: true });
    optionalNumber(row, "originalSalePrice", path);
    optionalNumber(row, "priceDiscountAmount", path);
    optionalBoolean(row, "isDiscounted", path);
    requireNumber(row, "totalAmount", path);
    requireNumber(row, "originalTotalAmount", path);
    optionalString(row, "discountType", path);
    optionalNumber(row, "discountValue", path);
    optionalNumber(row, "discountAmount", path);
    requireNumber(row, "finalTotalAmount", path);
    optionalNumber(row, "receivedAmount", path);
    optionalNumber(row, "changeAmount", path);
    requireEnum(row, "mode", new Set(["by_weight", "by_amount"]), path);
    requireEnum(row, "activeBaseField", new Set(["quantity", "totalAmount"]), path);
    requireNumber(row, "costOfGoodsSold", path);
    requireString(row, "comment", path);
  });

  rows.expenses.forEach((row, index) => {
    const path = `expenses[${index}]`;
    validateCommon(row, path);
    requireProfile(row, path);
    requireString(row, "date", path, false);
    requireString(row, "category", path, false);
    requireNumber(row, "amount", path, { positive: true });
    requireString(row, "comment", path);
  });

  rows.writeOffs.forEach((row, index) => {
    const path = `writeOffs[${index}]`;
    validateCommon(row, path);
    const profileId = requireProfile(row, path);
    requireString(row, "date", path, false);
    const inputMode = optionalString(row, "inputMode", path);
    if (inputMode && !new Set(["weight", "packages"]).has(inputMode)) {
      fail(`${path}.inputMode`, "ожидалось weight или packages");
    }
    const packageCount = optionalNumber(row, "packageCount", path);
    const packageWeight = optionalNumber(row, "packageWeight", path);
    optionalString(row, "packageLabel", path);
    if (inputMode === "packages" && (!packageCount || !packageWeight)) {
      fail(path, "для упаковок нужны количество и вес одной упаковки");
    }
    requireNumber(row, "quantity", path, { positive: true });
    requireString(row, "reason", path, false);
    requireString(row, "comment", path);
    requireNumber(row, "costAmount", path);
    validateTarget(row, path, ids.stockGroups, ids.products);
    validateTargetProfile(row, path, profileId, stockGroupProfiles, productProfiles);
  });

  rows.quickButtonSettings.forEach((row, index) => {
    const path = `quickButtonSettings[${index}]`;
    validateCommon(row, path);
    requireEnum(row, "type", new Set(["weight", "amount", "discount", "round"]), path);
    requireNumber(row, "value", path);
    requireString(row, "label", path, false);
    requireNumber(row, "order", path);
  });

  rows.appSettings.forEach((row, index) => {
    const path = `appSettings[${index}]`;
    validateCommon(row, path);
    const activeProfileId = requireString(row, "activeProfileId", path, false);
    if (!ids.storeProfiles.has(activeProfileId)) {
      fail(`${path}.activeProfileId`, "профиль не найден");
    }
    requireEnum(row, "theme", new Set(["light", "contrast"]), path);
    requireNumber(row, "weightPrecision", path);
    requireString(row, "currencySymbol", path, false);
  });

  return {
    schemaVersion: 4,
    exportedAt: typeof root.exportedAt === "string" ? root.exportedAt : new Date().toISOString(),
    bazaarLocations: rows.bazaarLocations,
    storeProfiles: rows.storeProfiles,
    stockGroups: rows.stockGroups,
    products: rows.products,
    receipts: rows.receipts,
    sales: rows.sales,
    expenses: rows.expenses,
    writeOffs: rows.writeOffs,
    quickButtonSettings: rows.quickButtonSettings,
    appSettings: rows.appSettings
  } as unknown as AppSnapshot;
};

function normalizeLegacySnapshot(root: JsonRecord): JsonRecord {
  const version = typeof root.schemaVersion === "number" ? root.schemaVersion : 1;
  if (version >= 4) {
    return root;
  }

  const timestamp = typeof root.exportedAt === "string" ? root.exportedAt : new Date().toISOString();
  const tenantCollections = ["stockGroups", "products", "receipts", "sales", "expenses", "writeOffs"];
  const migrated: JsonRecord = { ...root };

  if (version < 3) {
    migrated.storeProfiles = [createDefaultProfile(timestamp)];

    for (const collection of tenantCollections) {
      if (!Array.isArray(root[collection])) {
        continue;
      }
      const rows = root[collection] as unknown[];
      migrated[collection] = rows.map((row) =>
        isRecord(row) ? { ...row, profileId: typeof row.profileId === "string" ? row.profileId : DEFAULT_PROFILE_ID } : row
      );
    }

    const settingsRows = Array.isArray(root.appSettings) ? (root.appSettings as unknown[]) : [];
    migrated.appSettings = settingsRows.map((row) =>
      isRecord(row)
        ? { ...row, activeProfileId: typeof row.activeProfileId === "string" ? row.activeProfileId : DEFAULT_PROFILE_ID }
        : row
    );
  }

  const profileRows = Array.isArray(migrated.storeProfiles) ? (migrated.storeProfiles as unknown[]) : [];
  const locations: JsonRecord[] = [];
  const locationIdByKey = new Map<string, string>();
  migrated.storeProfiles = profileRows.map((row, index) => {
    if (!isRecord(row)) {
      return row;
    }
    const key = [row.city, row.marketName, row.pointName].join("|").toLocaleLowerCase("ru");
    let locationId = locationIdByKey.get(key);
    if (!locationId) {
      locationId = index === 0 ? DEFAULT_BAZAAR_LOCATION_ID : `bazaar_${String(row.id || index)}`;
      locationIdByKey.set(key, locationId);
      locations.push({
        id: locationId,
        city: typeof row.city === "string" ? row.city : "Махачкала",
        marketName: typeof row.marketName === "string" ? row.marketName : "Базар",
        pointName: typeof row.pointName === "string" ? row.pointName : "",
        isArchived: false,
        createdAt: typeof row.createdAt === "string" ? row.createdAt : timestamp,
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : timestamp
      });
    }
    return { ...row, bazaarLocationId: locationId };
  });
  migrated.bazaarLocations = locations.length > 0 ? locations : createDefaultBazaarLocations(timestamp).slice(0, 1);
  migrated.schemaVersion = 4;
  return migrated;
}

function validateTarget(
  row: JsonRecord,
  path: string,
  stockGroupIds: Set<string>,
  productIds: Set<string>
) {
  const stockGroupId = optionalString(row, "stockGroupId", path);
  const productId = optionalString(row, "productId", path);
  if (Boolean(stockGroupId) === Boolean(productId)) {
    fail(path, "нужно указать ровно одну цель: товар или партию");
  }
  if (stockGroupId && !stockGroupIds.has(stockGroupId)) {
    fail(`${path}.stockGroupId`, "партия не найдена");
  }
  if (productId && !productIds.has(productId)) {
    fail(`${path}.productId`, "товар не найден");
  }
}

function validateTargetProfile(
  row: JsonRecord,
  path: string,
  profileId: string,
  stockGroupProfiles: Map<string, string>,
  productProfiles: Map<string, string>
) {
  const stockGroupId = optionalString(row, "stockGroupId", path);
  const productId = optionalString(row, "productId", path);
  if (stockGroupId && stockGroupProfiles.get(stockGroupId) !== profileId) {
    fail(`${path}.stockGroupId`, "партия принадлежит другому профилю");
  }
  if (productId && productProfiles.get(productId) !== profileId) {
    fail(`${path}.productId`, "товар принадлежит другому профилю");
  }
}
