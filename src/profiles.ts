import type { StoreProfile } from "./types";

export const DEFAULT_PROFILE_ID = "profile_gazelle_1";

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
  name: "Газель №1",
  city: "Махачкала",
  marketName: "Восточный базар",
  pointName: "Точка 12",
  isArchived: false,
  createdAt: timestamp,
  updatedAt: timestamp
});

export const profileLocationLabel = (profile?: StoreProfile | null) =>
  profile ? [profile.city, profile.marketName, profile.pointName].filter(Boolean).join(" · ") : "Профиль не выбран";
