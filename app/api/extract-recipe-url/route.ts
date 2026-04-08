import { NextRequest, NextResponse } from "next/server";

type ErrorCode =
  | "API_KEY_MISSING"
  | "INVALID_URL"
  | "FETCH_FAILED"
  | "GROQ_API_ERROR"
  | "NETWORK_ERROR"
  | "JSON_NOT_FOUND"
  | "JSON_PARSE_ERROR"
  | "NO_RECIPE_FOUND"
  | "UNEXPECTED_ERROR";

function apiError(message: string, code: ErrorCode, status: number, extra?: object) {
  console.error(`[${code}] ${message}`, extra ?? "");
  return NextResponse.json({ error: message, errorCode: code, ...extra }, { status });
}

/** テキストから最初の完全なJSONオブジェクト（括弧が釣り合っている）を抽出 */
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// ── JSON-LD（schema.org/Recipe）のパースと変換 ────────────────────

interface JsonLdRecipe {
  "@type": string | string[];
  name?: string;
  recipeIngredient?: string[];
  recipeInstructions?: unknown;
  recipeCategory?: string;
  recipeCuisine?: string;
  totalTime?: string;
  cookTime?: string;
  prepTime?: string;
  recipeYield?: string | string[];
}

function findRecipeJsonLd(html: string): JsonLdRecipe | null {
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const candidates: unknown[] = Array.isArray(data)
        ? data
        : data["@graph"]
          ? data["@graph"]
          : [data];
      for (const item of candidates) {
        const type = (item as JsonLdRecipe)["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t) => typeof t === "string" && t.toLowerCase().includes("recipe"))) {
          return item as JsonLdRecipe;
        }
      }
    } catch { /* 次のscriptタグへ */ }
  }
  return null;
}

function isoToReadable(iso?: string): string | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const hours = match[1] ? `${match[1]}時間` : "";
  const mins = match[2] ? `${match[2]}分` : "";
  return hours + mins || null;
}

function parseInstructions(instructions: unknown): string[] {
  if (!instructions) return [];
  if (typeof instructions === "string") {
    return instructions
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(instructions)) {
    return instructions.flatMap((item) => {
      if (typeof item === "string") return [item.trim()];
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        if (typeof obj.text === "string") return [obj.text.trim()];
        if (typeof obj.itemListElement !== "undefined") return parseInstructions(obj.itemListElement);
      }
      return [];
    }).filter(Boolean);
  }
  return [];
}

const GENRE_MAP: Record<string, string> = {
  和食: "和食", 洋食: "洋食", 中華: "中華", イタリアン: "イタリアン",
  韓国: "韓国料理", 肉: "肉・魚メイン", 魚: "肉・魚メイン",
  麺: "麺・ごはん", ごはん: "麺・ごはん", ご飯: "麺・ごはん",
  スープ: "スープ・汁物", 汁: "スープ・汁物",
  サラダ: "サラダ・和え物", デザート: "デザート・スイーツ", スイーツ: "デザート・スイーツ",
};

function guessGenre(category?: string, cuisine?: string): string {
  const src = `${category ?? ""} ${cuisine ?? ""}`;
  for (const [key, value] of Object.entries(GENRE_MAP)) {
    if (src.includes(key)) return value;
  }
  return "和食";
}

function convertJsonLdToRecipe(ld: JsonLdRecipe) {
  const steps = parseInstructions(ld.recipeInstructions);

  // 調理情報をstepsの先頭に追加
  const metaParts: string[] = [];
  const yield_ = Array.isArray(ld.recipeYield) ? ld.recipeYield[0] : ld.recipeYield;
  if (yield_) metaParts.push(yield_);
  const time = isoToReadable(ld.totalTime ?? ld.cookTime);
  if (time) metaParts.push(`調理時間${time}`);
  if (metaParts.length > 0) {
    steps.unshift(`【調理情報】${metaParts.join("・")}`);
  }

  return {
    title: ld.name ?? "不明な料理",
    genre: guessGenre(
      typeof ld.recipeCategory === "string" ? ld.recipeCategory : undefined,
      typeof ld.recipeCuisine === "string" ? ld.recipeCuisine : undefined,
    ),
    ingredients: ld.recipeIngredient ?? [],
    steps,
  };
}

// ── HTML → テキスト変換 ───────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ── Groq テキスト呼び出し ─────────────────────────────────────────

const URL_EXTRACTION_PROMPT = `以下はレシピサイトから取得したWebページのテキストです。このテキストからレシピを抽出してください。

【重要ルール】
1. レシピ以外のテキスト（広告・ナビゲーション・コメント・関連記事など）は完全に無視する
2. 材料は分量まで含める（例：「醤油 大さじ1」）
3. 材料にA・Bなどのグループ記号がある場合は【A】【B】を先頭に付ける
4. 手順はWebページに書かれている文章をそのまま書き写す
5. 調理時間・人数などのメタ情報はstepsの先頭に「【調理情報】2人分・調理時間30分」の形式で追加する
6. ½・¼などの分数記号は「1/2」「1/4」に変換する
7. レシピが見つからない場合は {"recipes": []} を返す

必ず以下のJSON形式だけで返すこと（前後に余計なテキスト不要）:
{"recipes":[{"title":"料理名","genre":"和食","ingredients":["材料1 分量"],"steps":["【調理情報】2人分・30分","手順1","手順2"]}]}

genreは以下から最も適切なものを1つ：和食, 洋食, 中華, イタリアン, 韓国料理, 肉・魚メイン, 麺・ごはん, スープ・汁物, サラダ・和え物, デザート・スイーツ

--- Webページのテキスト ---
`;

async function extractWithGroq(apiKey: string, pageText: string) {
  const truncated = pageText.slice(0, 12000);
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{ role: "user", content: URL_EXTRACTION_PROMPT + truncated }],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false as const, type: "network" as const, msg };
  }

  if (!res.ok) {
    let errBody: { error?: { message?: string; type?: string } } = {};
    try { errBody = await res.json(); } catch { /* ignore */ }
    return {
      ok: false as const,
      type: "api" as const,
      status: res.status,
      groqMsg: errBody.error?.message ?? "詳細不明",
    };
  }

  let data: { choices?: { message?: { content?: string } }[] };
  try { data = await res.json(); } catch {
    return { ok: false as const, type: "api" as const, status: 500, groqMsg: "レスポンス解析失敗" };
  }

  return { ok: true as const, text: data.choices?.[0]?.message?.content ?? "" };
}

// ── メインハンドラ ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return apiError("GROQ_API_KEY が設定されていません。", "API_KEY_MISSING", 500);
  }

  let url: string;
  try {
    ({ url } = await req.json() as { url: string });
  } catch {
    return apiError("リクエストの解析に失敗しました", "UNEXPECTED_ERROR", 400);
  }

  // URL バリデーション
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("invalid protocol");
  } catch {
    return apiError("有効なURLを入力してください（http:// または https:// で始まるURL）", "INVALID_URL", 400);
  }

  // ページ取得
  let html: string;
  try {
    const pageRes = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RecipeBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!pageRes.ok) {
      return apiError(
        `ページの取得に失敗しました (${pageRes.status})。URLが正しいか確認してください。`,
        "FETCH_FAILED",
        502
      );
    }
    html = await pageRes.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(
      `ページへの接続に失敗しました。URLが正しいか確認してください。(${msg})`,
      "FETCH_FAILED",
      502
    );
  }

  // JSON-LD でレシピが取れればそのまま返す
  const jsonLd = findRecipeJsonLd(html);
  if (jsonLd) {
    const recipe = convertJsonLdToRecipe(jsonLd);
    if (recipe.title && (recipe.ingredients.length > 0 || recipe.steps.length > 0)) {
      return NextResponse.json({ recipes: [recipe], source: "json-ld" });
    }
  }

  // JSON-LD がなければ Groq AI でテキスト解析
  const pageText = htmlToText(html);
  const result = await extractWithGroq(apiKey, pageText);

  if (!result.ok) {
    if (result.type === "network") {
      return apiError(`Groq APIへの接続に失敗しました。(${result.msg})`, "NETWORK_ERROR", 503);
    }
    const statusMessages: Record<number, string> = {
      401: "APIキーが無効です (401)。",
      429: "APIのレート制限に達しました (429)。しばらく待ってから再試行してください。",
    };
    const message = statusMessages[result.status] ?? `Groq APIエラー (${result.status}): ${result.groqMsg}`;
    return apiError(message, "GROQ_API_ERROR", 502);
  }

  const extracted = extractBalancedJson(result.text);
  if (!extracted) {
    return apiError("レシピのJSONを抽出できませんでした。", "JSON_NOT_FOUND", 500);
  }

  let parsed: { recipes?: unknown[] };
  try {
    const sanitized = extracted.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    parsed = JSON.parse(sanitized);
  } catch {
    return apiError("レシピデータの解析に失敗しました。", "JSON_PARSE_ERROR", 500);
  }

  const recipes = (parsed.recipes ?? []) as { title?: string }[];
  if (!recipes.length || !recipes[0]?.title) {
    return apiError(
      "このページからレシピが見つかりませんでした。レシピが掲載されているページのURLを入力してください。",
      "NO_RECIPE_FOUND",
      404
    );
  }

  return NextResponse.json({ recipes, source: "ai" });
}
