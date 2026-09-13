import Dexie, { type Table } from "dexie";
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
import {
  createDefaultBazaarLocations,
  createDefaultProfile,
  createDefaultProfiles,
  DEFAULT_PROFILE_ID,
  FARMER_PROFILE_ID
} from "./profiles";

export class MarketDatabase extends Dexie {
  bazaarLocations!: Table<BazaarLocation, string>;
  storeProfiles!: Table<StoreProfile, string>;
  stockGroups!: Table<StockGroup, string>;
  products!: Table<Product, string>;
  receipts!: Table<Receipt, string>;
  sales!: Table<Sale, string>;
  expenses!: Table<Expense, string>;
  writeOffs!: Table<WriteOff, string>;
  quickButtonSettings!: Table<QuickButtonSetting, string>;
  appSettings!: Table<AppSettings, string>;

  constructor() {
    super("market-bazaar-pwa-db");

    this.version(1).stores({
      stockGroups: "id, name, updatedAt",
      products: "id, name, variant, stockGroupId, isArchived, updatedAt",
      receipts: "id, stockGroupId, productId, date, updatedAt",
      sales: "id, productId, stockGroupId, date, updatedAt",
      expenses: "id, date, category, updatedAt",
      writeOffs: "id, stockGroupId, productId, date, updatedAt",
      quickButtonSettings: "id, type, order",
      appSettings: "id, updatedAt"
    });

    this.version(2).stores({
      stockGroups: "id, name, updatedAt",
      products: "id, name, variant, stockGroupId, isArchived, updatedAt",
      receipts: "id, stockGroupId, productId, date, updatedAt",
      sales: "id, productId, stockGroupId, date, updatedAt",
      expenses: "id, date, category, updatedAt",
      writeOffs: "id, stockGroupId, productId, date, updatedAt",
      quickButtonSettings: "id, type, order",
      appSettings: "id, updatedAt"
    });

    this.version(3)
      .stores({
        storeProfiles: "id, name, city, isArchived, updatedAt",
        stockGroups: "id, profileId, name, updatedAt",
        products: "id, profileId, name, variant, stockGroupId, isArchived, updatedAt",
        receipts: "id, profileId, stockGroupId, productId, date, updatedAt",
        sales: "id, profileId, productId, stockGroupId, date, updatedAt",
        expenses: "id, profileId, date, category, updatedAt",
        writeOffs: "id, profileId, stockGroupId, productId, date, updatedAt",
        quickButtonSettings: "id, type, order",
        appSettings: "id, activeProfileId, updatedAt"
      })
      .upgrade(async (transaction) => {
        const timestamp = new Date().toISOString();
        await transaction.table("storeProfiles").put(createDefaultProfile(timestamp));
        for (const tableName of ["stockGroups", "products", "receipts", "sales", "expenses", "writeOffs"]) {
          await transaction.table(tableName).toCollection().modify((row) => {
            if (!row.profileId) {
              row.profileId = DEFAULT_PROFILE_ID;
            }
          });
        }
        await transaction.table("appSettings").toCollection().modify((row) => {
          if (!row.activeProfileId) {
            row.activeProfileId = DEFAULT_PROFILE_ID;
          }
        });
      });

    this.version(4)
      .stores({
        bazaarLocations: "id, city, marketName, isArchived, updatedAt",
        storeProfiles: "id, bazaarLocationId, name, city, isArchived, updatedAt",
        stockGroups: "id, profileId, name, updatedAt",
        products: "id, profileId, name, variant, stockGroupId, isArchived, updatedAt",
        receipts: "id, profileId, stockGroupId, productId, date, updatedAt",
        sales: "id, profileId, productId, stockGroupId, date, isDiscounted, updatedAt",
        expenses: "id, profileId, date, category, updatedAt",
        writeOffs: "id, profileId, stockGroupId, productId, date, updatedAt",
        quickButtonSettings: "id, type, order",
        appSettings: "id, activeProfileId, updatedAt"
      })
      .upgrade(async (transaction) => {
        const timestamp = new Date().toISOString();
        const profiles = await transaction.table("storeProfiles").toArray();
        const locationByKey = new Map<string, string>();

        for (const profile of profiles) {
          const key = [profile.city, profile.marketName, profile.pointName].join("|").toLocaleLowerCase("ru");
          let locationId = locationByKey.get(key);
          if (!locationId) {
            locationId = `bazaar_${profile.id}`;
            locationByKey.set(key, locationId);
            await transaction.table("bazaarLocations").put({
              id: locationId,
              city: profile.city,
              marketName: profile.marketName,
              pointName: profile.pointName,
              isArchived: false,
              createdAt: timestamp,
              updatedAt: timestamp
            });
          }
          await transaction.table("storeProfiles").put({ ...profile, bazaarLocationId: locationId, updatedAt: timestamp });
        }
      });

    this.version(5)
      .stores({
        bazaarLocations: "id, city, marketName, isArchived, updatedAt",
        storeProfiles: "id, bazaarLocationId, name, city, isArchived, updatedAt",
        stockGroups: "id, profileId, name, updatedAt",
        products: "id, profileId, name, variant, stockGroupId, isArchived, updatedAt",
        receipts: "id, profileId, stockGroupId, productId, date, updatedAt",
        sales: "id, profileId, productId, stockGroupId, date, isDiscounted, updatedAt",
        expenses: "id, profileId, date, category, updatedAt",
        writeOffs: "id, profileId, stockGroupId, productId, date, updatedAt",
        quickButtonSettings: "id, type, order",
        appSettings: "id, activeProfileId, updatedAt"
      })
      .upgrade(async (transaction) => {
        const timestamp = new Date().toISOString();
        const profileTable = transaction.table("storeProfiles");
        const locationTable = transaction.table("bazaarLocations");

        for (const location of createDefaultBazaarLocations(timestamp)) {
          const existing = await locationTable.get(location.id);
          await locationTable.put({ ...existing, ...location, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp });
        }

        for (const profile of createDefaultProfiles(timestamp)) {
          const existing = await profileTable.get(profile.id);
          await profileTable.put({ ...existing, ...profile, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp });
        }

        const farmerProducts = await transaction.table("products").where("profileId").equals(FARMER_PROFILE_ID).count();
        if (farmerProducts === 0) {
          await transaction.table("products").bulkPut([
            {
              id: "product_cucumber_farmer",
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
              id: "product_tomato_farmer",
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
          ]);
        }
      });

    this.version(6)
      .stores({
        bazaarLocations: "id, city, marketName, isArchived, updatedAt",
        storeProfiles: "id, bazaarLocationId, name, city, isArchived, updatedAt",
        stockGroups: "id, profileId, name, updatedAt",
        products: "id, profileId, name, variant, stockGroupId, isArchived, updatedAt",
        receipts: "id, profileId, stockGroupId, productId, date, updatedAt",
        sales: "id, profileId, productId, stockGroupId, date, isDiscounted, updatedAt",
        expenses: "id, profileId, date, category, updatedAt",
        writeOffs: "id, profileId, stockGroupId, productId, date, updatedAt",
        quickButtonSettings: "id, type, order",
        appSettings: "id, activeProfileId, updatedAt"
      })
      .upgrade(async (transaction) => {
        const timestamp = new Date().toISOString();
        for (const id of ["bazaar_profile_gazelle_1", "bazaar_profile_gazelle_2"]) {
          const location = await transaction.table("bazaarLocations").get(id);
          if (location && ["Махачкала", "Астрахань"].includes(location.city)) {
            await transaction.table("bazaarLocations").put({ ...location, isArchived: true, updatedAt: timestamp });
          }
        }
      });
  }
}

export const db = new MarketDatabase();
