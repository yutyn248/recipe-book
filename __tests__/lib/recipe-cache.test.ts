import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  stripImagesForCache,
  getCachedRecipes,
  setCachedRecipes,
  findRecipeInCache,
} from "@/lib/recipe-cache";
import type { Recipe } from "@/types/recipe";

const recipeWithPhotos: Recipe = {
  id: "r1",
  title: "唐揚げ",
  genre: "和食",
  blocks: [
    { id: "b1", type: "hero", base64: "data:image/jpeg;base64,AAAA" },
    { id: "b2", type: "ingredients", items: ["鶏肉 300g"] },
    { id: "b3", type: "step", text: "切る" },
    { id: "b4", type: "photo", base64: "data:image/jpeg;base64,BBBB" },
    { id: "b5", type: "memo", text: "メモ" },
  ],
  originalImages: ["data:image/jpeg;base64,CCCC"],
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  localStorage.clear();
});

describe("stripImagesForCache", () => {
  it("hero・photoブロックとoriginalImagesを除外する", () => {
    const stripped = stripImagesForCache(recipeWithPhotos);
    expect(stripped.blocks.map((b) => b.type)).toEqual(["ingredients", "step", "memo"]);
    expect(stripped.originalImages).toEqual([]);
  });

  it("材料・手順・メモのテキストは保持する（一覧の検索・件数表示に必要）", () => {
    const stripped = stripImagesForCache(recipeWithPhotos);
    expect(stripped.title).toBe("唐揚げ");
    const ing = stripped.blocks.find((b) => b.type === "ingredients");
    expect(ing).toEqual({ id: "b2", type: "ingredients", items: ["鶏肉 300g"] });
  });
});

describe("setCachedRecipes / getCachedRecipes", () => {
  it("写真を除いた状態で保存・取得できる", () => {
    setCachedRecipes([recipeWithPhotos]);
    const cached = getCachedRecipes();
    expect(cached).toHaveLength(1);
    expect(cached[0].blocks.some((b) => b.type === "hero" || b.type === "photo")).toBe(false);
  });

  it("localStorageへの書き込みが失敗してもクラッシュしない（QuotaExceededError対策）", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => setCachedRecipes([recipeWithPhotos])).not.toThrow();
    setItemSpy.mockRestore();
  });

  it("壊れたキャッシュがあってもクラッシュせず空配列を返す", () => {
    localStorage.setItem("recipes_cache", "INVALID_JSON{{{");
    expect(getCachedRecipes()).toEqual([]);
  });

  it("キャッシュがない場合は空配列を返す", () => {
    expect(getCachedRecipes()).toEqual([]);
  });
});

describe("findRecipeInCache", () => {
  it("該当IDのレシピを見つけられる", () => {
    setCachedRecipes([recipeWithPhotos]);
    const found = findRecipeInCache("r1");
    expect(found?.title).toBe("唐揚げ");
  });

  it("見つからない場合はnullを返す", () => {
    setCachedRecipes([recipeWithPhotos]);
    expect(findRecipeInCache("missing")).toBeNull();
  });
});
