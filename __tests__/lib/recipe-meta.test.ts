import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecipeMeta,
  getAllMeta,
  setFavorite,
  setRating,
  recordCooked,
} from "@/lib/recipe-meta";

beforeEach(() => {
  localStorage.clear();
});

describe("getRecipeMeta", () => {
  it("存在しないIDは空オブジェクトを返す", () => {
    expect(getRecipeMeta("unknown-id")).toEqual({});
  });

  it("壊れたJSONでも空オブジェクトを返す", () => {
    localStorage.setItem("recipe_meta", "BROKEN{{JSON");
    expect(getRecipeMeta("any-id")).toEqual({});
  });
});

describe("getAllMeta", () => {
  it("データなしは空オブジェクトを返す", () => {
    expect(getAllMeta()).toEqual({});
  });

  it("複数レシピのメタをまとめて返す", () => {
    setFavorite("recipe-1", true);
    setRating("recipe-2", 4);
    const meta = getAllMeta();
    expect(meta["recipe-1"]?.favorite).toBe(true);
    expect(meta["recipe-2"]?.rating).toBe(4);
  });
});

describe("setFavorite", () => {
  it("お気に入りをtrueにできる", () => {
    setFavorite("recipe-1", true);
    expect(getRecipeMeta("recipe-1").favorite).toBe(true);
  });

  it("お気に入りをfalseにできる", () => {
    setFavorite("recipe-1", true);
    setFavorite("recipe-1", false);
    expect(getRecipeMeta("recipe-1").favorite).toBe(false);
  });

  it("他レシピのメタを上書きしない", () => {
    setRating("recipe-1", 5);
    setFavorite("recipe-1", true);
    expect(getRecipeMeta("recipe-1").rating).toBe(5);
    expect(getRecipeMeta("recipe-1").favorite).toBe(true);
  });

  it("別レシピのデータを壊さない", () => {
    setFavorite("recipe-1", true);
    setFavorite("recipe-2", true);
    setFavorite("recipe-1", false);
    expect(getRecipeMeta("recipe-2").favorite).toBe(true);
  });
});

describe("setRating", () => {
  it("評価1〜5を保存できる", () => {
    for (const r of [1, 2, 3, 4, 5]) {
      setRating("recipe-1", r);
      expect(getRecipeMeta("recipe-1").rating).toBe(r);
    }
  });

  it("undefinedで評価を削除できる", () => {
    setRating("recipe-1", 4);
    setRating("recipe-1", undefined);
    expect(getRecipeMeta("recipe-1").rating).toBeUndefined();
  });
});

describe("recordCooked", () => {
  it("最終調理日が記録される", () => {
    const before = new Date().toISOString();
    recordCooked("recipe-1");
    const after = new Date().toISOString();
    const recorded = getRecipeMeta("recipe-1").lastCookedAt!;
    expect(recorded >= before).toBe(true);
    expect(recorded <= after).toBe(true);
  });

  it("評価なしで記録した場合、既存の評価を上書きしない", () => {
    setRating("recipe-1", 3);
    recordCooked("recipe-1");
    expect(getRecipeMeta("recipe-1").rating).toBe(3);
  });

  it("評価ありで記録すると評価も更新される", () => {
    recordCooked("recipe-1", 5);
    expect(getRecipeMeta("recipe-1").rating).toBe(5);
    expect(getRecipeMeta("recipe-1").lastCookedAt).toBeDefined();
  });

  it("評価を指定せずに再記録しても既存評価は保たれる", () => {
    recordCooked("recipe-1", 4);
    recordCooked("recipe-1");
    expect(getRecipeMeta("recipe-1").rating).toBe(4);
  });
});
