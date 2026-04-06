import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/extract-recipe/route";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubEnv("GROQ_API_KEY", "test-api-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/extract-recipe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function groqOkResponse(content: string) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  });
}

describe("POST /api/extract-recipe", () => {
  describe("バリデーション", () => {
    it("GROQ_API_KEY が未設定の場合 500 を返す", async () => {
      vi.stubEnv("GROQ_API_KEY", "");
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

  describe("Groq API エラーハンドリング", () => {
    it("401 の場合 APIキー無効エラーを返す", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: "Invalid API key" } }),
      });
      const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.errorCode).toBe("GROQ_API_ERROR");
      expect(body.error).toContain("401");
    });

    it("429 の場合レート制限エラーを返す", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: { message: "Rate limit exceeded" } }),
      });
      const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
      const body = await res.json();
      expect(body.error).toContain("429");
    });

    it("fetch 自体が失敗した場合 NETWORK_ERROR を返す", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));
      const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.errorCode).toBe("NETWORK_ERROR");
    });
  });

  describe("レスポンス解析", () => {
    it("AIの返答が空の場合 EMPTY_RESPONSE を返す", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: "" } }] }),
      });
      const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
      const body = await res.json();
      expect(body.errorCode).toBe("EMPTY_RESPONSE");
    });

    it("JSONが含まれない場合 JSON_NOT_FOUND を返す", async () => {
      mockFetch.mockResolvedValueOnce(groqOkResponse("レシピが見つかりませんでした。"));
      const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
      const body = await res.json();
      expect(body.errorCode).toBe("JSON_NOT_FOUND");
    });

    it("不正なJSONの場合 JSON_PARSE_ERROR を返す", async () => {
      mockFetch.mockResolvedValueOnce(groqOkResponse("{ invalid json }"));
      const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
      const body = await res.json();
      expect(body.errorCode).toBe("JSON_PARSE_ERROR");
    });

    it("タイトルがないレシピの場合 NO_RECIPE_FOUND を返す", async () => {
      mockFetch.mockResolvedValueOnce(groqOkResponse('{"recipes":[{"ingredients":[],"steps":[]}]}'));
      const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
      const body = await res.json();
      expect(body.errorCode).toBe("NO_RECIPE_FOUND");
    });

    it("正常な1レシピを返す", async () => {
      const validResponse = JSON.stringify({
        recipes: [{
          title: "唐揚げ",
          genre: "和食",
          ingredients: ["鶏もも肉 300g", "醤油 大さじ2"],
          steps: ["鶏肉を切る", "揚げる"],
        }],
      });
      mockFetch.mockResolvedValueOnce(groqOkResponse(validResponse));
      const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.recipes).toHaveLength(1);
      expect(body.recipes[0].title).toBe("唐揚げ");
      expect(body.recipes[0].ingredients).toHaveLength(2);
    });

    it("複数レシピを正常に返す", async () => {
      const validResponse = JSON.stringify({
        recipes: [
          { title: "唐揚げ", genre: "和食", ingredients: ["鶏肉"], steps: ["揚げる"] },
          { title: "カレー", genre: "洋食", ingredients: ["玉ねぎ"], steps: ["炒める"] },
        ],
      });
      mockFetch.mockResolvedValueOnce(groqOkResponse(validResponse));
      const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
      const body = await res.json();
      expect(body.recipes).toHaveLength(2);
    });

    it("AIが余分なテキストを含んでいてもJSONを抽出できる", async () => {
      const messyResponse = `こちらがレシピです：\n${ JSON.stringify({
        recipes: [{ title: "味噌汁", genre: "和食", ingredients: ["豆腐"], steps: ["煮る"] }],
      })}\n以上です。`;
      mockFetch.mockResolvedValueOnce(groqOkResponse(messyResponse));
      const res = await POST(makeRequest({ pages: ["data:image/jpeg;base64,abc"] }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.recipes[0].title).toBe("味噌汁");
    });
  });
});
