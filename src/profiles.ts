import type { BazaarLocation, StoreProfile } from "./types";

export const DEFAULT_PROFILE_ID = "profile_gazelle_1";
export const DEFAULT_BAZAAR_LOCATION_ID = "bazaar_east_makhachkala_12";
export const SECOND_BAZAAR_LOCATION_ID = "bazaar_big_isady_astrakhan_4_7";

export const bazaarCities = [
  "Махачкала",
  "Астрахань",
  "Грозный",
  "Краснодар",
  "Москва",
  "Ростов-на-Дону",
  "Волгоград"
];

export const createDefaultProfile = (timestamp = new Date().toISOString()): StoreProfile => ({
  id: DEFAULT_PROFILE_ID,
  bazaarLocationId: DEFAULT_BAZAAR_LOCATION_ID,
  name: "Газель №1",
  city: "Махачкала",
  marketName: "Восточный базар",
  pointName: "Точка 12",
  isArchived: false,
  createdAt: timestamp,
  updatedAt: timestamp
});

export const createDefaultBazaarLocations = (timestamp = new Date().toISOString()): BazaarLocation[] => [
  {
    id: DEFAULT_BAZAAR_LOCATION_ID,
    city: "Махачкала",
    marketName: "Восточный базар",
    pointName: "Точка 12",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: SECOND_BAZAAR_LOCATION_ID,
    city: "Астрахань",
    marketName: "Большие Исады",
    pointName: "Ряд 4 · точка 7",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

export const bazaarLocationLabel = (location?: BazaarLocation | null) =>
  location ? [location.city, location.marketName, location.pointName].filter(Boolean).join(" · ") : "Место не выбрано";

export const profileLocationLabel = (profile?: StoreProfile | null) =>
  profile ? [profile.city, profile.marketName, profile.pointName].filter(Boolean).join(" · ") : "Профиль не выбран";
