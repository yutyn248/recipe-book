import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/extract-recipe/route";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubEnv("GEMINI_API_KEY", "test-api-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  mockFetch.mockReset();
});

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/extract-recipe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function geminiOkResponse(content: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: content }] } }] }),
  };
}

function gemini429Response() {
  return {
    ok: false,
    status: 429,
    headers: { get: () => null },
    json: () => Promise.resolve({ error: { message: "Rate limit exceeded" } }),
  };
}

const validRecipe = (title: string) => ({
  title, genre: "和食", ingredients: ["鶏肉 300g"], steps: ["切る", "焼く"],
});

// ── バリデーション ────────────────────────────────────────────────
describe("バリデーション", () => {
  it("GEMINI_API_KEY が未設定の場合 500 を返す", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.errorCode).toBe("API_KEY_MISSING");
  });

  it("pages が空の場合 400 を返す", async () => {
    const res = await POST(makeRequest({ pages: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe("NO_IMAGES");
  });
});

// ── 1枚処理（基本） ────────────────────────────────────────────
describe("1枚処理", () => {
  it("正常な1レシピを返す", async () => {
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({ recipes: [validRecipe("唐揚げ")] })));
    const res = await POST(makeRequest({ pages: ["img1"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes).toHaveLength(1);
    expect(body.recipes[0].title).toBe("唐揚げ");
  });

  it("1ページに複数レシピがある場合すべて返す", async () => {
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({
      recipes: [validRecipe("唐揚げ"), validRecipe("味噌汁")],
    })));
    const res = await POST(makeRequest({ pages: ["img1"] }));
    const body = await res.json();
    expect(body.recipes).toHaveLength(2);
  });

  it("AIが余分なテキストを含んでいてもJSONを抽出できる", async () => {
    const messyResponse = `こちらがレシピです：\n${JSON.stringify({ recipes: [validRecipe("味噌汁")] })}\n以上です。`;
    mockFetch.mockResolvedValueOnce(geminiOkResponse(messyResponse));
    const res = await POST(makeRequest({ pages: ["img1"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes[0].title).toBe("味噌汁");
  });

  it("JSONの後に余計な波括弧があっても正しく抽出できる（最初の完全なJSONのみ取得）", async () => {
    const tricky = `${JSON.stringify({ recipes: [validRecipe("唐揚げ")] })} 注意: {NG}`;
    mockFetch.mockResolvedValueOnce(geminiOkResponse(tricky));
    const res = await POST(makeRequest({ pages: ["img1"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes[0].title).toBe("唐揚げ");
  });

  it("制御文字が含まれていてもパースできる", async () => {
    const withControl = JSON.stringify({ recipes: [validRecipe("唐揚げ")] }).replace("唐揚げ", "唐揚げ\x01\x08");
    mockFetch.mockResolvedValueOnce(geminiOkResponse(withControl));
    const res = await POST(makeRequest({ pages: ["img1"] }));
    expect(res.status).toBe(200);
  });
});

// ── 複数ページ処理 ────────────────────────────────────────────
describe("複数ページ処理", () => {
  it("2枚：1枚目のレシピを抽出し2枚目で精錬する（2回APIを呼ぶ）", async () => {
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({ recipes: [validRecipe("唐揚げ")] })));
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({ recipes: [validRecipe("唐揚げ")] })));
    const res = await POST(makeRequest({ pages: ["img1", "img2"] }));
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 10000);

  it("2枚目に新しいレシピがあれば追加される（今回の修正の核心）", async () => {
    // img1: レシピAとB、img2の精錬後: A、B、C、Dすべて返る
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({
      recipes: [validRecipe("唐揚げ"), validRecipe("味噌汁")],
    })));
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({
      recipes: [validRecipe("唐揚げ"), validRecipe("味噌汁"), validRecipe("カレー"), validRecipe("サラダ")],
    })));
    const res = await POST(makeRequest({ pages: ["img1", "img2"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes).toHaveLength(4);
    const titles = body.recipes.map((r: { title: string }) => r.title);
    expect(titles).toContain("カレー");
    expect(titles).toContain("サラダ");
  }, 10000);

  it("手順が2枚目で統合されても最終的なレシピが返る", async () => {
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({
      recipes: [{ title: "唐揚げ", genre: "和食", ingredients: ["鶏肉"], steps: ["鶏肉を切る（途中"] }],
    })));
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({
      recipes: [{ title: "唐揚げ", genre: "和食", ingredients: ["鶏肉"], steps: ["鶏肉を切る（完成）", "揚げる"] }],
    })));
    const res = await POST(makeRequest({ pages: ["img1", "img2"] }));
    const body = await res.json();
    expect(body.recipes[0].steps).toContain("揚げる");
  }, 10000);

  it("3枚：順番にAPIを呼んで最終結果を返す", async () => {
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({ recipes: [validRecipe("A")] })));
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({ recipes: [validRecipe("A"), validRecipe("B")] })));
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({ recipes: [validRecipe("A"), validRecipe("B"), validRecipe("C")] })));
    const res = await POST(makeRequest({ pages: ["p1", "p2", "p3"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  }, 15000);

  it("1枚目が無関係な写真でも2枚目でレシピを取得できる", async () => {
    mockFetch.mockResolvedValueOnce(geminiOkResponse('{"recipes": []}'));
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({ recipes: [validRecipe("唐揚げ")] })));
    const res = await POST(makeRequest({ pages: ["unrelated", "recipe"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes[0].title).toBe("唐揚げ");
  }, 10000);

  it("精錬ページでJSONが取れなくても前の結果を維持する", async () => {
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({ recipes: [validRecipe("唐揚げ")] })));
    mockFetch.mockResolvedValueOnce(geminiOkResponse("解析できませんでした"));
    const res = await POST(makeRequest({ pages: ["img1", "img2"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes[0].title).toBe("唐揚げ");
  }, 10000);
});

// ── 429 リトライ ────────────────────────────────────────────
describe("429 レート制限リトライ", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1回目429 → 2回目成功でリトライが機能する", async () => {
    mockFetch.mockResolvedValueOnce(gemini429Response());
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({ recipes: [validRecipe("唐揚げ")] })));
    const resPromise = POST(makeRequest({ pages: ["img1"] }));
    await vi.advanceTimersByTimeAsync(10000);
    const res = await resPromise;
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("2回目も429 → 3回目成功でリトライが機能する", async () => {
    mockFetch.mockResolvedValueOnce(gemini429Response());
    mockFetch.mockResolvedValueOnce(gemini429Response());
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify({ recipes: [validRecipe("唐揚げ")] })));
    const resPromise = POST(makeRequest({ pages: ["img1"] }));
    await vi.advanceTimersByTimeAsync(20000);
    const res = await resPromise;
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("3回連続429はエラーを返す（リトライ上限）", async () => {
    mockFetch.mockResolvedValue(gemini429Response());
    const resPromise = POST(makeRequest({ pages: ["img1"] }));
    await vi.advanceTimersByTimeAsync(20000);
    const res = await resPromise;
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.errorCode).toBe("AI_API_ERROR");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ── エラーハンドリング ────────────────────────────────────────────
describe("エラーハンドリング", () => {
  it("401 の場合 APIキー無効エラーを返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 401,
      headers: { get: () => null },
      json: () => Promise.resolve({ error: { message: "Invalid API key" } }),
    });
    const res = await POST(makeRequest({ pages: ["img1"] }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.errorCode).toBe("AI_API_ERROR");
    expect(body.error).toContain("401");
  });

  it("fetch 自体が失敗した場合 NETWORK_ERROR を返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));
    const res = await POST(makeRequest({ pages: ["img1"] }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.errorCode).toBe("NETWORK_ERROR");
  });

  it("AIの返答が空の場合 EMPTY_RESPONSE を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: "" }] } }] }),
    });
    const res = await POST(makeRequest({ pages: ["img1"] }));
    const body = await res.json();
    expect(body.errorCode).toBe("EMPTY_RESPONSE");
  });

  it("JSONが含まれない場合 JSON_NOT_FOUND を返す", async () => {
    mockFetch.mockResolvedValueOnce(geminiOkResponse("レシピが見つかりませんでした。"));
    const res = await POST(makeRequest({ pages: ["img1"] }));
    const body = await res.json();
    expect(body.errorCode).toBe("JSON_NOT_FOUND");
  });

  it("不正なJSONの場合 JSON_PARSE_ERROR を返す", async () => {
    mockFetch.mockResolvedValueOnce(geminiOkResponse("{ invalid json }"));
    const res = await POST(makeRequest({ pages: ["img1"] }));
    const body = await res.json();
    expect(body.errorCode).toBe("JSON_PARSE_ERROR");
  });

  it("タイトルがないレシピの場合 NO_RECIPE_FOUND を返す", async () => {
    mockFetch.mockResolvedValueOnce(geminiOkResponse('{"recipes":[{"ingredients":[],"steps":[]}]}'));
    const res = await POST(makeRequest({ pages: ["img1"] }));
    const body = await res.json();
    expect(body.errorCode).toBe("NO_RECIPE_FOUND");
  });
});
