import type { BazaarLocation, StoreProfile } from "./types";

export const DEFAULT_PROFILE_ID = "profile_gazelle_1";
export const DEFAULT_BAZAAR_LOCATION_ID = "bazaar_east_makhachkala_12";
export const SECOND_BAZAAR_LOCATION_ID = "bazaar_big_isady_astrakhan_4_7";
export const SECOND_PROFILE_ID = "profile_gazelle_2";
export const FARMER_PROFILE_ID = "profile_gazelle_farmer";

export const bazaarCities = [
  "Урус-Мартан",
  "Аргун",
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
  name: "Синий газель",
  city: "Урус-Мартан",
  marketName: "Центральный базар",
  pointName: "Синяя точка",
  isArchived: false,
  createdAt: timestamp,
  updatedAt: timestamp
});

export const createDefaultBazaarLocations = (timestamp = new Date().toISOString()): BazaarLocation[] => [
  {
    id: DEFAULT_BAZAAR_LOCATION_ID,
    city: "Урус-Мартан",
    marketName: "Центральный базар",
    pointName: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: SECOND_BAZAAR_LOCATION_ID,
    city: "Аргун",
    marketName: "Центральный базар",
    pointName: "",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

export const createDefaultProfiles = (timestamp = new Date().toISOString()): StoreProfile[] => [
  createDefaultProfile(timestamp),
  {
    id: SECOND_PROFILE_ID,
    bazaarLocationId: SECOND_BAZAAR_LOCATION_ID,
    name: "Белый газель",
    city: "Аргун",
    marketName: "Центральный базар",
    pointName: "Белая точка",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: FARMER_PROFILE_ID,
    bazaarLocationId: DEFAULT_BAZAAR_LOCATION_ID,
    name: "Фермер газель",
    city: "Урус-Мартан",
    marketName: "Центральный базар",
    pointName: "Фермерский ряд",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

export const bazaarLocationLabel = (location?: BazaarLocation | null) =>
  location ? [location.city, location.marketName, location.pointName].filter(Boolean).join(" · ") : "Место не выбрано";

export const profileLocationLabel = (profile?: StoreProfile | null) =>
  profile ? [profile.city, profile.marketName, profile.pointName].filter(Boolean).join(" · ") : "Профиль не выбран";
