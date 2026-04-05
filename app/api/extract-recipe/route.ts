import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function toInlineData(base64: string) {
  return {
    mimeType: (base64.startsWith("data:image/png") ? "image/png" : "image/jpeg") as "image/png" | "image/jpeg",
    data: base64.replace(/^data:image\/\w+;base64,/, ""),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { pages } = await req.json() as { pages: string[] };

    if (!pages || pages.length === 0) {
      return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const pageNote = pages.length === 1
      ? "この画像から料理レシピを読み取ってください。"
      : `${pages.length}枚の画像は同じレシピのページです。すべてのページを合わせて1つのレシピとして読み取ってください。`;

    const prompt = `${pageNote}

以下のJSON形式のみで返してください。JSON以外のテキストは一切含めないでください。

{
  "title": "料理名",
  "genre": "和食",
  "ingredients": ["材料1（分量）", "材料2（分量）"],
  "steps": ["手順1", "手順2"],
  "foodPhotos": [
    {
      "pageIndex": 0,
      "region": {
        "topPercent": 0,
        "leftPercent": 0,
        "widthPercent": 100,
        "heightPercent": 50
      }
    }
  ]
}

genreは以下の中から最も適切なものを1つ選んでください：和食, 洋食, 中華, イタリアン, 韓国料理, 肉・魚メイン, 麺・ごはん, スープ・汁物, サラダ・和え物, デザート・スイーツ
foodPhotosについて：
- 各ページ内で料理・食材の写真が写っている部分を検出してください
- 1ページに複数の写真があれば複数エントリーを追加してください
- 写真がなければ空配列にしてください
- regionは画像全体に対するパーセンテージ（0〜100）で指定してください
- タイトル・材料・手順が読み取れない場合はそれぞれ「不明な料理」または空配列にしてください`;

    const contents = [
      prompt,
      ...pages.map((p) => ({ inlineData: toInlineData(p) })),
    ];

    const result = await model.generateContent(contents);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "レシピの解析に失敗しました" }, { status: 500 });
    }

    const recipe = JSON.parse(jsonMatch[0]);
    return NextResponse.json(recipe);
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json({ error: "AIの処理中にエラーが発生しました" }, { status: 500 });
  }
}
