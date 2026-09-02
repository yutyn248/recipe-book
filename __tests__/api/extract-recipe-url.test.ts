import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/extract-recipe-url/route";

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
  return new NextRequest("http://localhost/api/extract-recipe-url", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function pageOkResponse(html: string) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(html),
  };
}

function geminiOkResponse(content: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: content }] } }] }),
  };
}

function geminiErrorResponse(status: number, message = "Error") {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve({ error: { message } }),
  };
}

const minimalJsonLdHtml = (recipe: object) => `
<html>
<head>
<script type="application/ld+json">
${JSON.stringify(recipe)}
</script>
</head>
<body>レシピページ</body>
</html>
`;

const validJsonLd = {
  "@type": "Recipe",
  name: "唐揚げ",
  recipeIngredient: ["鶏肉 300g", "醤油 大さじ2"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "鶏肉を切る" },
    { "@type": "HowToStep", text: "揚げる" },
  ],
  recipeCategory: "和食",
};

// ── バリデーション ────────────────────────────────────────────────
describe("バリデーション", () => {
  it("GEMINI_API_KEY が未設定の場合 500 を返す", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.errorCode).toBe("API_KEY_MISSING");
  });

  it("URLが不正な場合 400 を返す", async () => {
    const res = await POST(makeRequest({ url: "not-a-url" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe("INVALID_URL");
  });

  it("httpでもhttpsでもないURLは 400 を返す", async () => {
    const res = await POST(makeRequest({ url: "ftp://example.com/recipe" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe("INVALID_URL");
  });
});

// ── JSON-LD 抽出（高速パス） ────────────────────────────────────────────
describe("JSON-LD抽出", () => {
  it("schema.org/Recipe のJSON-LDがあれば直接パースして返す", async () => {
    mockFetch.mockResolvedValueOnce(pageOkResponse(minimalJsonLdHtml(validJsonLd)));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("json-ld");
    expect(body.recipes[0].title).toBe("唐揚げ");
    expect(body.recipes[0].ingredients).toContain("鶏肉 300g");
    expect(body.recipes[0].steps).toContain("鶏肉を切る");
    // Gemini APIは呼ばれない
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("@graphラッパーのJSON-LDも対応する", async () => {
    const graphLd = {
      "@graph": [
        { "@type": "WebSite", name: "example" },
        { ...validJsonLd, name: "味噌汁" },
      ],
    };
    mockFetch.mockResolvedValueOnce(pageOkResponse(minimalJsonLdHtml(graphLd)));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("json-ld");
    expect(body.recipes[0].title).toBe("味噌汁");
  });

  it("JSON-LDが配列の場合でもRecipeタイプを見つける", async () => {
    const arrayLd = [
      { "@type": "BreadcrumbList" },
      { ...validJsonLd, name: "カレー" },
    ];
    mockFetch.mockResolvedValueOnce(pageOkResponse(minimalJsonLdHtml(arrayLd)));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes[0].title).toBe("カレー");
  });

  it("totalTimeがあれば調理情報をsteps先頭に追加する", async () => {
    const ldWithTime = { ...validJsonLd, totalTime: "PT30M", recipeYield: "2人分" };
    mockFetch.mockResolvedValueOnce(pageOkResponse(minimalJsonLdHtml(ldWithTime)));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    const body = await res.json();
    expect(body.recipes[0].steps[0]).toContain("調理情報");
    expect(body.recipes[0].steps[0]).toContain("30分");
    expect(body.recipes[0].steps[0]).toContain("2人分");
  });

  it("JSON-LDのジャンル推定: 和食カテゴリは和食になる", async () => {
    const ldWashoku = { ...validJsonLd, recipeCategory: "和食" };
    mockFetch.mockResolvedValueOnce(pageOkResponse(minimalJsonLdHtml(ldWashoku)));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    const body = await res.json();
    expect(body.recipes[0].genre).toBe("和食");
  });

  it("JSON-LDのジャンル推定: イタリアン料理はイタリアンになる", async () => {
    const ldItalian = { ...validJsonLd, recipeCategory: undefined, recipeCuisine: "イタリアン" };
    mockFetch.mockResolvedValueOnce(pageOkResponse(minimalJsonLdHtml(ldItalian)));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    const body = await res.json();
    expect(body.recipes[0].genre).toBe("イタリアン");
  });

  it("JSON-LDの手順が文字列の場合も対応する", async () => {
    const ldStringInstructions = {
      ...validJsonLd,
      recipeInstructions: "まず切る\n次に炒める",
    };
    mockFetch.mockResolvedValueOnce(pageOkResponse(minimalJsonLdHtml(ldStringInstructions)));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    const body = await res.json();
    expect(body.recipes[0].steps).toContain("まず切る");
    expect(body.recipes[0].steps).toContain("次に炒める");
  });
});

// ── Gemini AI フォールバック ────────────────────────────────────────────
describe("GeminiAIフォールバック", () => {
  const plainHtml = "<html><body><p>唐揚げレシピ</p></body></html>";
  const validAiRecipe = {
    recipes: [{
      title: "唐揚げ",
      genre: "和食",
      ingredients: ["鶏肉 300g"],
      steps: ["鶏肉を切る", "揚げる"],
    }],
  };

  it("JSON-LDがなければGemini AIにフォールバックして source: ai を返す", async () => {
    mockFetch.mockResolvedValueOnce(pageOkResponse(plainHtml));
    mockFetch.mockResolvedValueOnce(geminiOkResponse(JSON.stringify(validAiRecipe)));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("ai");
    expect(body.recipes[0].title).toBe("唐揚げ");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("AIが余分なテキストを含んでいてもJSONを抽出できる", async () => {
    const messyResponse = `はい、以下のレシピです：\n${JSON.stringify(validAiRecipe)}\n以上です。`;
    mockFetch.mockResolvedValueOnce(pageOkResponse(plainHtml));
    mockFetch.mockResolvedValueOnce(geminiOkResponse(messyResponse));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes[0].title).toBe("唐揚げ");
  });

  it("AIがJSONを返さない場合 JSON_NOT_FOUND を返す", async () => {
    mockFetch.mockResolvedValueOnce(pageOkResponse(plainHtml));
    mockFetch.mockResolvedValueOnce(geminiOkResponse("このページにはレシピが見つかりませんでした。"));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    const body = await res.json();
    expect(body.errorCode).toBe("JSON_NOT_FOUND");
  });

  it("AIが空のrecipesを返した場合 NO_RECIPE_FOUND を返す", async () => {
    mockFetch.mockResolvedValueOnce(pageOkResponse(plainHtml));
    mockFetch.mockResolvedValueOnce(geminiOkResponse('{"recipes":[]}'));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    const body = await res.json();
    expect(body.errorCode).toBe("NO_RECIPE_FOUND");
  });

  it("AIが401を返した場合 AI_API_ERROR を返す", async () => {
    mockFetch.mockResolvedValueOnce(pageOkResponse(plainHtml));
    mockFetch.mockResolvedValueOnce(geminiErrorResponse(401, "Invalid API key"));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.errorCode).toBe("AI_API_ERROR");
  });

  it("AIへのfetchが失敗した場合 NETWORK_ERROR を返す", async () => {
    mockFetch.mockResolvedValueOnce(pageOkResponse(plainHtml));
    mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.errorCode).toBe("NETWORK_ERROR");
  });
});

// ── ページ取得エラー ────────────────────────────────────────────
describe("ページ取得エラー", () => {
  it("ページが404の場合 FETCH_FAILED を返す", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve("") });
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.errorCode).toBe("FETCH_FAILED");
  });

  it("ページへの接続が失敗した場合 FETCH_FAILED を返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.errorCode).toBe("FETCH_FAILED");
  });
});
