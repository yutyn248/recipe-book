export interface RecipeMeta {
  favorite?: boolean;
  rating?: number; // 1-5
  lastCookedAt?: string; // ISO date
}

const KEY = "recipe_meta";

function getMeta(): Record<string, RecipeMeta> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveMeta(data: Record<string, RecipeMeta>) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getRecipeMeta(id: string): RecipeMeta {
  return getMeta()[id] ?? {};
}

export function getAllMeta(): Record<string, RecipeMeta> {
  return getMeta();
}

export function setFavorite(id: string, favorite: boolean) {
  const data = getMeta();
  data[id] = { ...data[id], favorite };
  saveMeta(data);
}

export function setRating(id: string, rating: number | undefined) {
  const data = getMeta();
  data[id] = { ...data[id], rating };
  saveMeta(data);
}

export function recordCooked(id: string, rating?: number) {
  const data = getMeta();
  data[id] = { ...data[id], lastCookedAt: new Date().toISOString(), ...(rating !== undefined ? { rating } : {}) };
  saveMeta(data);
}
