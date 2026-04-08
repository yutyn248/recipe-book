import { NextRequest, NextResponse } from "next/server";

type ErrorCode =
  | "API_KEY_MISSING"
  | "NO_IMAGES"
  | "GROQ_API_ERROR"
  | "EMPTY_RESPONSE"
  | "JSON_NOT_FOUND"
  | "JSON_PARSE_ERROR"
  | "NO_RECIPE_FOUND"
  | "NETWORK_ERROR"
  | "UNEXPECTED_ERROR";

function apiError(message: string, code: ErrorCode, status: number, extra?: object) {
  console.error(`[${code}] ${message}`, extra ?? "");
  return NextResponse.json({ error: message, errorCode: code, ...extra }, { status });
}

/** テキストから最初の完全なJSONオブジェクト（括弧が釣り合っている）を抽出する */
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

type GroqResult =
  | { ok: true; text: string }
  | { ok: false; type: "network"; msg: string }
  | { ok: false; type: "api"; status: number; groqMsg: string; groqType: string };

/** Groq Vision APIを1枚の画像で呼び出す */
async function callGroqVision(
  apiKey: string,
  imageUrl: string,
  promptText: string
): Promise<GroqResult> {
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
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 8192,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, type: "network", msg };
  }

  if (!res.ok) {
    let errBody: { error?: { message?: string; type?: string } } = {};
    try { errBody = await res.json(); } catch { /* ignore */ }
    return {
      ok: false,
      type: "api",
      status: res.status,
      groqMsg: errBody.error?.message ?? "詳細不明",
      groqType: errBody.error?.type ?? "",
    };
  }

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = await res.json();
  } catch {
    return { ok: false, type: "api", status: 500, groqMsg: "レスポンス解析失敗", groqType: "" };
  }

  return { ok: true, text: data.choices?.[0]?.message?.content ?? "" };
}

/** Groqエラーをエラーレスポンスに変換 */
function groqErrorResponse(result: Extract<GroqResult, { ok: false }>, pageLabel: string) {
  if (result.type === "network") {
    return apiError(
      `${pageLabel}の処理中にネットワークエラーが発生しました。(${result.msg})`,
      "NETWORK_ERROR",
      503
    );
  }
  const statusMessages: Record<number, string> = {
    401: `APIキーが無効です (401)。GROQ_API_KEY を確認してください。`,
    429: `APIのレート制限に達しました (429)。しばらく待ってから再試行してください。`,
    500: `Groq APIサーバーエラー (500): ${result.groqMsg}`,
    503: `Groq APIが一時的に利用不可です (503)。しばらく待ってから再試行してください。`,
  };
  const message = statusMessages[result.status]
    ?? `${pageLabel}の処理中にGroq APIエラーが発生しました (${result.status}): ${result.groqMsg}`;
  return apiError(message, "GROQ_API_ERROR", 502, { groqType: result.groqType, groqStatus: result.status });
}

// ── プロンプト定義 ────────────────────────────────────────────────

/** 1枚目（または1枚のみ）の抽出プロンプト */
const FIRST_PAGE_PROMPT = `料理本のページまたはレシピサイトのスクリーンショットが写っています。

【重要ルール】
1. レシピの区切りはAIが内容を見て判断すること。1ページに複数レシピがあれば別々に、複数ページに1レシピが続いていればまとめて1つにすること
2. 画像に書かれているテキストを一字一句そのまま正確に読み取ること。要約・省略・推測は絶対にしないこと
3. 材料は分量まで必ず含める（例：「醤油 大さじ1」「砂糖 小さじ2」）
4. 材料名の下や横に下処理・切り方などの注釈がある場合は丸括弧で追記する（例：「鶏ささみ 2本（3等分にそぎ切り）」「玉ねぎ 1個（薄切り）」）
5. 材料にA・Bなどのグループ記号がある場合は、そのグループに属する材料の先頭に【A】【B】を付ける（例：「【A】醤油 大さじ1」「【A】みりん 大さじ1」）。グループ記号自体は材料リストに単独で入れないこと
6. 手順は本に書いてある文章をそのまま書き写す
7. 赤線・緑線・色付きの枠などで囲まれたポイント・メモ・コツは「【ポイント】〇〇」の形式でstepsの末尾に追加する
8. 手順がページの途中で切れている場合は、読み取れた分だけそのまま書く（続きは次のページで補完する）
9. 読み取れない文字があっても、読み取れた部分だけ正確に書く（手書き文字も同様）。判読不能な箇所は「（不明）」と記載する
10. 画像にレシピが全く見当たらない場合（料理と無関係な写真など）は {"recipes": []} を返すこと
11. 2段組・複数カラムのレイアウトの場合、左のカラムを上から下まで読み切ってから右のカラムへ進むこと（横方向に読み混ぜないこと）
12. Webページのスクリーンショットの場合、ナビゲーション・ヘッダー・フッター・広告・コメント欄・関連記事など、レシピ本文以外の要素は完全に無視すること
13. ½・¼・¾などの分数記号は「1/2」「1/4」「3/4」のように変換して書くこと
14. 調理時間・人数・カロリーなどのメタ情報が記載されている場合は、stepsの先頭に「【調理情報】2人分・調理時間30分」のような形式で追加すること

必ず以下のJSON形式だけで返すこと（前後に余計なテキスト不要）:
{"recipes":[{"title":"料理名","genre":"和食","ingredients":["材料1 分量","【A】材料2 分量"],"steps":["【調理情報】2人分・30分","手順1","手順2"]}]}

複数レシピの場合: {"recipes":[{"title":"レシピ1","genre":"和食","ingredients":[...],"steps":[...]},{"title":"レシピ2","genre":"洋食","ingredients":[...],"steps":[...]}]}

genreは以下から最も適切なものを1つ：和食, 洋食, 中華, イタリアン, 韓国料理, 肉・魚メイン, 麺・ごはん, スープ・汁物, サラダ・和え物, デザート・スイーツ`;

/** 2枚目以降の精錬プロンプト */
function buildRefinePrompt(accumulatedJson: string, pageNum: number, totalPages: number): string {
  return `以下のJSONは${pageNum - 1}枚目までの画像から読み取ったレシピデータです：
${accumulatedJson}

これは${totalPages}枚中${pageNum}枚目の画像です。このページを読んで、上記のJSONを補完・完成させた完全なJSONを返してください。

【補完ルール】
1. 前のページで手順が途中（文の途中）で切れていた場合、このページに続きが写っていれば1つの手順として統合する
2. このページに同じ手順・材料が重複して写っている場合は1つにまとめる（前のページと完全に同じ内容は追加しない）
3. このページに新しい手順・材料があれば追加する
4. タイトル・材料・ジャンルはすでに正確に読み取れていれば変更しない
5. 画像に書かれている文章をそのまま使う（要約・省略・推測しない）
6. ポイント・メモ・コツは「【ポイント】〇〇」の形式でstepsの末尾に追加する
7. 2段組・複数カラムのレイアウトの場合、左のカラムを上から下まで読み切ってから右のカラムへ進むこと
8. Webページのスクリーンショットの場合、ナビゲーション・広告・コメント欄など本文以外は無視すること
9. ½・¼・¾などの分数記号は「1/2」「1/4」「3/4」に変換すること
10. 調理時間・人数などがある場合はstepsの先頭に「【調理情報】〇〇」として追加する

完成したJSONのみ返すこと（前後に余計なテキスト不要）:`;
}

// ── メインハンドラ ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. API キー確認
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return apiError(
      "GROQ_API_KEY が設定されていません。環境変数を確認してください。",
      "API_KEY_MISSING",
      500
    );
  }

  // 2. リクエスト解析
  let pages: string[];
  try {
    ({ pages } = await req.json() as { pages: string[] });
  } catch {
    return apiError("リクエストの解析に失敗しました", "UNEXPECTED_ERROR", 400);
  }

  if (!pages || pages.length === 0) {
    return apiError("画像が必要です", "NO_IMAGES", 400);
  }

  // 3. 1枚目を抽出
  const firstResult = await callGroqVision(apiKey, pages[0], FIRST_PAGE_PROMPT);
  if (!firstResult.ok) return groqErrorResponse(firstResult, "1枚目");

  if (!firstResult.text.trim()) {
    return apiError(
      "AIからの応答が空でした。写真を撮り直して再試行してください。",
      "EMPTY_RESPONSE",
      500
    );
  }

  // 4. 複数枚の場合：前の結果をコンテキストとして順番に精錬
  let finalText = firstResult.text;

  if (pages.length > 1) {
    // 1枚目でJSONが取れなかった場合（無関係画像など）は空のrecipesを起点にする
    let accumulatedJson = extractBalancedJson(finalText) ?? '{"recipes": []}';

    for (let i = 1; i < pages.length; i++) {
      const refinePrompt = buildRefinePrompt(accumulatedJson, i + 1, pages.length);
      const result = await callGroqVision(apiKey, pages[i], refinePrompt);

      if (!result.ok) return groqErrorResponse(result, `${i + 1}枚目`);
      if (!result.text.trim()) continue; // 空なら前の結果を維持

      const refined = extractBalancedJson(result.text);
      if (refined) {
        accumulatedJson = refined;
      } else {
        console.warn(`[PAGE_${i + 1}] JSON extraction failed, keeping previous result`);
      }
    }

    finalText = accumulatedJson;
  }

  // 5. JSON 抽出（括弧カウント方式）
  const extractedJson = extractBalancedJson(finalText);
  if (!extractedJson) {
    console.error("[JSON_NOT_FOUND] AI raw response:", finalText.slice(0, 500));
    return apiError(
      "AIの応答からレシピのJSONを抽出できませんでした。写真をより鮮明に撮り直してください。",
      "JSON_NOT_FOUND",
      500,
      { rawSnippet: finalText.slice(0, 200) }
    );
  }

  // 6. JSON パース（制御文字を除去してからパース）
  let parsed: { recipes?: unknown[] };
  try {
    const sanitized = extractedJson.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    parsed = JSON.parse(sanitized);
  } catch {
    console.error("[JSON_PARSE_ERROR] raw JSON:", extractedJson.slice(0, 500));
    return apiError(
      "レシピデータの解析に失敗しました。画像をより鮮明にして再試行してください。",
      "JSON_PARSE_ERROR",
      500
    );
  }

  // 7. レシピ存在確認
  const recipes = (parsed.recipes ?? [parsed]) as { title?: string }[];
  if (!recipes.length || !recipes[0]?.title) {
    return apiError(
      "レシピが見つかりませんでした。料理本のレシピページが写っているか確認してください。",
      "NO_RECIPE_FOUND",
      500
    );
  }

  return NextResponse.json({ recipes });
}
