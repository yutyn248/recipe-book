/**
 * 統合テスト: 買い物リストの一連のフロー
 * レシピから追加 → チェック → 削除 → 手動追加の組み合わせを確認
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getShoppingItems,
  addToShoppingList,
  addManualItem,
  toggleShoppingItem,
  removeCheckedItems,
  removeRecipeFromList,
} from "@/lib/shopping";

beforeEach(() => {
  localStorage.clear();
});

describe("買い物フロー統合テスト", () => {
  it("レシピ2つ + 手動アイテム → 一部チェック → 購入済み削除の流れ", () => {
    // 1. レシピ2つから材料を追加
    addToShoppingList("r1", "唐揚げ", ["鶏肉", "醤油", "砂糖"]);
    addToShoppingList("r2", "味噌汁", ["豆腐", "わかめ"]);
    addManualItem("スポンジ");

    let items = getShoppingItems();
    expect(items).toHaveLength(6);

    // 2. 購入済みチェック
    toggleShoppingItem(items[0].id); // 鶏肉 ✓
    toggleShoppingItem(items[3].id); // 豆腐 ✓
    toggleShoppingItem(items[5].id); // スポンジ ✓

    // 3. チェック済みを削除
    removeCheckedItems();
    items = getShoppingItems();
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.ingredient)).toEqual(["醤油", "砂糖", "わかめ"]);
  });

  it("レシピごと削除する流れ", () => {
    addToShoppingList("r1", "唐揚げ", ["鶏肉", "醤油"]);
    addToShoppingList("r2", "カレー", ["玉ねぎ", "カレー粉"]);
    addManualItem("洗剤");

    removeRecipeFromList("r1");

    const items = getShoppingItems();
    expect(items).toHaveLength(3); // r2の2つ + 手動1つ
    expect(items.every((i) => i.recipeId !== "r1")).toBe(true);
  });

  it("同じレシピを2回追加してから一括削除できる", () => {
    addToShoppingList("r1", "唐揚げ", ["鶏肉"]);
    addToShoppingList("r1", "唐揚げ", ["醤油"]); // 追加忘れで再追加
    expect(getShoppingItems()).toHaveLength(2);

    removeRecipeFromList("r1");
    expect(getShoppingItems()).toHaveLength(0);
  });
});

describe("recipe-meta と shopping の組み合わせ", () => {
  it("買い物リストが空でも recipe-meta は独立して動作する", async () => {
    const { setFavorite, getRecipeMeta } = await import("@/lib/recipe-meta");
    setFavorite("r1", true);
    expect(getShoppingItems()).toHaveLength(0);
    expect(getRecipeMeta("r1").favorite).toBe(true);
  });
});
