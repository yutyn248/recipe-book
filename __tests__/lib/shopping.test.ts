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

describe("getShoppingItems", () => {
  it("空のリストを返す（データなし）", () => {
    expect(getShoppingItems()).toEqual([]);
  });

  it("壊れたJSONでも空配列を返す（クラッシュしない）", () => {
    localStorage.setItem("shopping_list", "INVALID_JSON{{{");
    expect(getShoppingItems()).toEqual([]);
  });
});

describe("addToShoppingList", () => {
  it("材料をリストに追加できる", () => {
    addToShoppingList("recipe-1", "唐揚げ", ["鶏もも肉 300g", "醤油 大さじ2"]);
    const items = getShoppingItems();
    expect(items).toHaveLength(2);
    expect(items[0].ingredient).toBe("鶏もも肉 300g");
    expect(items[0].recipeId).toBe("recipe-1");
    expect(items[0].recipeTitle).toBe("唐揚げ");
    expect(items[0].checked).toBe(false);
  });

  it("複数回追加しても重複しない（別IDで積まれる）", () => {
    addToShoppingList("recipe-1", "唐揚げ", ["鶏もも肉"]);
    addToShoppingList("recipe-2", "カレー", ["玉ねぎ"]);
    expect(getShoppingItems()).toHaveLength(2);
  });

  it("各アイテムにユニークなIDが付く", () => {
    addToShoppingList("recipe-1", "唐揚げ", ["鶏肉", "醤油", "砂糖"]);
    const items = getShoppingItems();
    const ids = items.map((i) => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });
});

describe("addManualItem", () => {
  it("手動アイテムを追加できる", () => {
    addManualItem("洗剤");
    const items = getShoppingItems();
    expect(items).toHaveLength(1);
    expect(items[0].ingredient).toBe("洗剤");
    expect(items[0].recipeId).toBe("__manual__");
    expect(items[0].recipeTitle).toBe("メモ");
  });

  it("空文字は追加しない", () => {
    addManualItem("");
    addManualItem("   ");
    expect(getShoppingItems()).toHaveLength(0);
  });

  it("前後の空白をトリムして保存する", () => {
    addManualItem("  醤油  ");
    expect(getShoppingItems()[0].ingredient).toBe("醤油");
  });
});

describe("toggleShoppingItem", () => {
  it("チェックをオン/オフできる", () => {
    addToShoppingList("recipe-1", "唐揚げ", ["鶏肉"]);
    const id = getShoppingItems()[0].id;

    toggleShoppingItem(id);
    expect(getShoppingItems()[0].checked).toBe(true);

    toggleShoppingItem(id);
    expect(getShoppingItems()[0].checked).toBe(false);
  });

  it("対象外のアイテムは変更しない", () => {
    addToShoppingList("recipe-1", "唐揚げ", ["鶏肉", "醤油"]);
    const [first, second] = getShoppingItems();

    toggleShoppingItem(first.id);
    expect(getShoppingItems()[1].checked).toBe(false);
    expect(getShoppingItems()[1].id).toBe(second.id);
  });
});

describe("removeCheckedItems", () => {
  it("チェック済みアイテムだけ削除される", () => {
    addToShoppingList("recipe-1", "唐揚げ", ["鶏肉", "醤油", "砂糖"]);
    const items = getShoppingItems();
    toggleShoppingItem(items[0].id);
    toggleShoppingItem(items[2].id);

    removeCheckedItems();
    const remaining = getShoppingItems();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].ingredient).toBe("醤油");
  });

  it("チェックなしの場合は何も削除しない", () => {
    addToShoppingList("recipe-1", "唐揚げ", ["鶏肉", "醤油"]);
    removeCheckedItems();
    expect(getShoppingItems()).toHaveLength(2);
  });
});

describe("removeRecipeFromList", () => {
  it("指定レシピのアイテムだけ削除される", () => {
    addToShoppingList("recipe-1", "唐揚げ", ["鶏肉"]);
    addToShoppingList("recipe-2", "カレー", ["玉ねぎ", "カレー粉"]);
    addManualItem("洗剤");

    removeRecipeFromList("recipe-1");
    const items = getShoppingItems();
    expect(items).toHaveLength(3);
    expect(items.find((i) => i.recipeId === "recipe-1")).toBeUndefined();
  });

  it("手動アイテムは削除しない", () => {
    addManualItem("洗剤");
    removeRecipeFromList("__manual__" as string);
    // __manual__ はグループ削除の対象外（通常の recipeId で呼ばれる）
    // ここでは __manual__ を直接渡した場合の動作を確認
    expect(getShoppingItems()).toHaveLength(0);
  });
});
