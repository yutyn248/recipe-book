import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { pages } = await req.json() as { pages: string[] };

    if (!pages || pages.length === 0) {
      return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
    }

    const pageNote = pages.length === 1
      ? "この画像から料理レシピを読み取ってください。"
      : `${pages.length}枚の画像は同じレシピのページです。すべてのページを合わせて1つのレシピとして読み取ってください。`;

    const prompt = `${pageNote}

以下のJSON形式のみで返してください。JSON以外のテキストは一切含めないでください。

{
  "title": "料理名",
  "genre": "和食",
  "ingredients": ["材料1（分量）", "材料2（分量）"],
  "steps": ["手順1", "手順2"]
}

genreは以下の中から最も適切なものを1つ選んでください：和食, 洋食, 中華, イタリアン, 韓国料理, 肉・魚メイン, 麺・ごはん, スープ・汁物, サラダ・和え物, デザート・スイーツ
タイトル・材料・手順が読み取れない場合はそれぞれ「不明な料理」または空配列にしてください。`;

    const imageContents = pages.map((p) => ({
      type: "image_url" as const,
      image_url: { url: p },
    }));

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message ?? "Groq APIエラー");
    }

    const data = await res.json();
    const text = data.choices[0]?.message?.content ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "レシピの解析に失敗しました" }, { status: 500 });
    }

    const recipe = JSON.parse(jsonMatch[0]);
    return NextResponse.json(recipe);
  } catch (error) {
    console.error("Groq API error:", error);
    return NextResponse.json({ error: "AIの処理中にエラーが発生しました" }, { status: 500 });
  }
}
