import { Recipe } from "@/types/recipe";

const CACHE_KEY = "recipes_cache";

/**
 * 一覧・オフライン表示用キャッシュ（localStorage）には写真を含めない。
 * 一覧画面（RecipeCard）は写真を表示しないため表示上の影響はなく、
 * 写真込みで保存し続けるとlocalStorageの容量上限（QuotaExceededError）で
 * アプリがクラッシュするのを防げる。
 */
export function stripImagesForCache(recipe: Recipe): Recipe {
  return {
    ...recipe,
    blocks: recipe.blocks.filter((b) => b.type !== "hero" && b.type !== "photo"),
    originalImages: [],
  };
}

export function getCachedRecipes(): Recipe[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 容量上限などで書き込みに失敗しても、アプリの動作自体は継続する */
export function setCachedRecipes(recipes: Recipe[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(recipes.map(stripImagesForCache)));
  } catch {
    // 書き込み失敗は無視する（キャッシュはあくまで補助的なもの）
  }
}

/** オフライン時のフォールバック用。写真は含まれない（テキスト部分のみ） */
export function findRecipeInCache(id: string): Recipe | null {
  return getCachedRecipes().find((r) => r.id === id) ?? null;
}
