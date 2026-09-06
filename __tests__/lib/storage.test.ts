import { describe, it, expect, vi, beforeEach } from "vitest";
import { Recipe } from "@/types/recipe";

// supabase-jsのクエリビルダーは全メソッドがチェーン可能かつthenable。
// 呼び出すたびに指定した{data, error}へ解決するモックを作る。
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.order = chain;
  builder.eq = chain;
  builder.single = chain;
  builder.insert = chain;
  builder.update = chain;
  builder.delete = chain;
  builder.then = (resolve: (v: typeof result) => void) => resolve(result);
  return builder;
}

let nextResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => makeQueryBuilder(nextResult),
  },
}));

const { getRecipes, saveRecipe, getRecipeById, updateRecipe, deleteRecipe } = await import("@/lib/storage");

const validRow = {
  id: "r1",
  title: "唐揚げ",
  genre: "和食",
  blocks: [{ id: "b1", type: "step", text: "切る" }],
  original_images: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: null,
};

const validRecipe: Recipe = {
  id: "r1",
  title: "唐揚げ",
  genre: "和食",
  blocks: [{ id: "b1", type: "step", text: "切る" }],
  originalImages: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  nextResult = { data: null, error: null };
});

describe("getRecipes", () => {
  it("正常時はレシピ配列を返す", async () => {
    nextResult = { data: [validRow], error: null };
    const recipes = await getRecipes();
    expect(recipes).toHaveLength(1);
    expect(recipes[0].title).toBe("唐揚げ");
  });

  it("fetch失敗時はSupabase一時停止を疑う分かりやすいメッセージを投げる", async () => {
    nextResult = { data: null, error: { message: "TypeError: fetch failed" } };
    await expect(getRecipes()).rejects.toThrow(/一時停止/);
  });

  it("それ以外のエラーはそのまま内容を含めて投げる", async () => {
    nextResult = { data: null, error: { message: "permission denied" } };
    await expect(getRecipes()).rejects.toThrow(/permission denied/);
  });
});

describe("saveRecipe", () => {
  it("正常時はエラーを投げない", async () => {
    nextResult = { data: null, error: null };
    await expect(saveRecipe(validRecipe)).resolves.toBeUndefined();
  });

  it("失敗時はエラーを投げる", async () => {
    nextResult = { data: null, error: { message: "TypeError: fetch failed" } };
    await expect(saveRecipe(validRecipe)).rejects.toThrow(/一時停止/);
  });
});

describe("getRecipeById", () => {
  it("存在すればRecipeを返す", async () => {
    nextResult = { data: validRow, error: null };
    const r = await getRecipeById("r1");
    expect(r?.title).toBe("唐揚げ");
  });

  it("存在しない場合（PGRST116）はnullを返す（エラーにしない）", async () => {
    nextResult = { data: null, error: { code: "PGRST116", message: "no rows" } };
    const r = await getRecipeById("missing");
    expect(r).toBeNull();
  });

  it("通信エラーの場合は例外を投げる（nullを返さない）", async () => {
    nextResult = { data: null, error: { message: "TypeError: fetch failed" } };
    await expect(getRecipeById("r1")).rejects.toThrow(/一時停止/);
  });
});

describe("updateRecipe", () => {
  it("失敗時はエラーを投げる", async () => {
    nextResult = { data: null, error: { message: "TypeError: fetch failed" } };
    await expect(updateRecipe(validRecipe)).rejects.toThrow(/一時停止/);
  });
});

describe("deleteRecipe", () => {
  it("失敗時はエラーを投げる", async () => {
    nextResult = { data: null, error: { message: "TypeError: fetch failed" } };
    await expect(deleteRecipe("r1")).rejects.toThrow(/一時停止/);
  });

  it("正常時はエラーを投げない", async () => {
    nextResult = { data: null, error: null };
    await expect(deleteRecipe("r1")).resolves.toBeUndefined();
  });
});
