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

export async function POST(req: NextRequest) {
  // 1. API キー確認
  if (!process.env.GROQ_API_KEY) {
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

  const pageNote = pages.length === 1
    ? "料理本の1ページが写っています。"
    : `料理本の${pages.length}ページが写っています。ページをまたいで1つのレシピが続いている場合はまとめて1つとして、ページ内に複数の別レシピがある場合はそれぞれ別々に読み取ってください。`;

  const prompt = `${pageNote}

【重要ルール】
1. レシピの区切りはAIが内容を見て判断すること。1ページに複数レシピがあれば別々に、複数ページに1レシピが続いていればまとめて1つにすること
2. 画像に書かれているテキストを一字一句そのまま正確に読み取ること。要約・省略・推測は絶対にしないこと
3. 材料は分量まで必ず含める（例：「醤油 大さじ1」「砂糖 小さじ2」）
4. 材料名の下や横に下処理・切り方などの注釈がある場合は丸括弧で追記する（例：「鶏ささみ 2本（3等分にそぎ切り）」「玉ねぎ 1個（薄切り）」）
5. 材料にA・Bなどのグループ記号がある場合は、そのグループに属する材料の先頭に【A】【B】を付ける（例：「【A】醤油 大さじ1」「【A】みりん 大さじ1」）。グループ記号自体は材料リストに単独で入れないこと
5. 手順は本に書いてある文章をそのまま書き写す
6. 赤線・緑線・色付きの枠などで囲まれたポイント・メモ・コツは「【ポイント】〇〇」の形式でstepsの末尾に追加する
8. 読み取れない文字があっても、読み取れた部分だけ正確に書く

必ず以下のJSON形式だけで返すこと（前後に余計なテキスト不要）:
{"recipes":[{"title":"料理名","genre":"和食","ingredients":["材料1 分量","【A】材料2 分量"],"steps":["手順1","手順2"]}]}

複数レシピの場合: {"recipes":[{"title":"レシピ1","genre":"和食","ingredients":[...],"steps":[...]},{"title":"レシピ2","genre":"洋食","ingredients":[...],"steps":[...]}]}

genreは以下から最も適切なものを1つ：和食, 洋食, 中華, イタリアン, 韓国料理, 肉・魚メイン, 麺・ごはん, スープ・汁物, サラダ・和え物, デザート・スイーツ`;

  const imageContents = pages.map((p) => ({
    type: "image_url" as const,
    image_url: { url: p },
  }));

  // 3. Groq API 呼び出し
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...imageContents,
            ],
          },
        ],
        temperature: 0.1,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(
      `Groq API への接続に失敗しました。ネットワークを確認してください。(${msg})`,
      "NETWORK_ERROR",
      503
    );
  }

  // 4. Groq API エラーレスポンス
  if (!res.ok) {
    let errBody: { error?: { message?: string; type?: string } } = {};
    try { errBody = await res.json(); } catch { /* ignore */ }

    const groqMsg = errBody.error?.message ?? "詳細不明";
    const groqType = errBody.error?.type ?? "";

    const statusMessages: Record<number, string> = {
      401: `APIキーが無効です (401)。GROQ_API_KEY を確認してください。`,
      429: `APIのレート制限に達しました (429)。しばらく待ってから再試行してください。`,
      500: `Groq APIサーバーエラー (500): ${groqMsg}`,
      503: `Groq APIが一時的に利用不可です (503)。しばらく待ってから再試行してください。`,
    };

    const message = statusMessages[res.status]
      ?? `Groq APIエラー (${res.status}): ${groqMsg}`;

    return apiError(message, "GROQ_API_ERROR", 502, { groqType, groqStatus: res.status });
  }

  // 5. レスポンス解析
  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = await res.json();
  } catch {
    return apiError("Groq APIのレスポンスを解析できませんでした", "UNEXPECTED_ERROR", 500);
  }

  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) {
    return apiError(
      "AIからの応答が空でした。写真を撮り直して再試行してください。",
      "EMPTY_RESPONSE",
      500
    );
  }

  // 6. JSON 抽出
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[JSON_NOT_FOUND] AI raw response:", text.slice(0, 500));
    return apiError(
      "AIの応答からレシピのJSONを抽出できませんでした。写真をより鮮明に撮り直してください。",
      "JSON_NOT_FOUND",
      500,
      { rawSnippet: text.slice(0, 200) }
    );
  }

  // 7. JSON パース
  let parsed: { recipes?: unknown[] };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[JSON_PARSE_ERROR] raw JSON:", jsonMatch[0].slice(0, 500));
    return apiError(
      "レシピデータの解析に失敗しました（不正なJSON）。写真を撮り直して再試行してください。",
      "JSON_PARSE_ERROR",
      500
    );
  }

  // 8. レシピ存在確認
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
