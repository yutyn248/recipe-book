import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { pages } = await req.json() as { pages: string[] };

    if (!pages || pages.length === 0) {
      return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
    }

    const pageNote = pages.length === 1
      ? "画像に写っている料理本のページを読み取ってください。"
      : `${pages.length}枚の画像は同じレシピのページです。すべてのページを合わせて1つのレシピとして読み取ってください。`;

    const prompt = `${pageNote}

【重要】画像に書かれているテキストを一字一句そのまま正確に読み取ること。要約・省略・推測は絶対にしないこと。
- 材料は「醤油 大さじ1」「砂糖 小さじ2」のように分量まで必ず含める
- 手順は本に書いてある文章をそのまま書き写す
- 読み取れない文字があっても、読み取れた部分だけ正確に書く

必ず以下のJSON形式だけで返すこと（前後に余計なテキスト不要）:
{"title":"料理名","genre":"和食","ingredients":["材料1 分量","材料2 分量"],"steps":["手順1の文章","手順2の文章"]}

genreは以下から最も適切なものを1つ：和食, 洋食, 中華, イタリアン, 韓国料理, 肉・魚メイン, 麺・ごはん, スープ・汁物, サラダ・和え物, デザート・スイーツ`;

    console.log("pages count:", pages.length);
    pages.forEach((p, i) => {
      console.log(`page[${i}] prefix:`, p.slice(0, 40), "length:", p.length);
    });

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
      console.error("Groq error detail:", JSON.stringify(err));
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
