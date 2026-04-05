import { Recipe, Genre } from "@/types/recipe";
import { saveRecipe, getRecipes } from "@/lib/storage";

function placeholder(bg: string, emoji: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
    <rect width="600" height="400" fill="${bg}"/>
    <text x="300" y="180" font-size="100" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${emoji}</text>
    <text x="300" y="300" font-size="28" text-anchor="middle" font-family="-apple-system,sans-serif" fill="rgba(255,255,255,0.7)">${label}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

const DUMMY_RECIPES: Omit<Recipe, "id" | "createdAt">[] = [
  {
    title: "鶏の唐揚げ",
    genre: "和食" as Genre,
    blocks: [
      { id: "k1-ing",  type: "ingredients", items: ["鶏もも肉 300g", "醤油 大さじ2", "みりん 大さじ1", "にんにく 1片", "生姜 1片", "片栗粉 適量", "揚げ油 適量"] },
      { id: "k1-hero", type: "photo", base64: placeholder("#C8773E", "🍗", "完成") },
      { id: "k1-p1",  type: "photo", base64: placeholder("#8B5E3C", "🔪", "鶏肉を切る") },
      { id: "k1-s1",  type: "step", text: "鶏もも肉を一口大に切り、醤油・みりん・すりおろしにんにく・生姜で30分漬ける" },
      { id: "k1-p2",  type: "photo", base64: placeholder("#9E7040", "🌾", "粉をまぶす") },
      { id: "k1-s2",  type: "step", text: "片栗粉をまぶして余分な粉を落とす" },
      { id: "k1-p3",  type: "photo", base64: placeholder("#B8862E", "🔥", "揚げる") },
      { id: "k1-s3",  type: "step", text: "170℃の油で4分揚げ、一度取り出して休ませてから190℃で1分揚げる" },
    ],
    originalImages: [],
  },
  {
    title: "トマトクリームパスタ",
    genre: "イタリアン" as Genre,
    blocks: [
      { id: "p1-ing",  type: "ingredients", items: ["パスタ 200g", "トマト缶 1缶", "生クリーム 100ml", "にんにく 2片", "玉ねぎ 1/2個", "オリーブオイル 大さじ2", "塩・コショウ 適量", "バジル 適量"] },
      { id: "p1-hero", type: "photo", base64: placeholder("#B04040", "🍝", "完成") },
      { id: "p1-p1",  type: "photo", base64: placeholder("#7A4040", "🧄", "炒める") },
      { id: "p1-s1",  type: "step", text: "にんにくと玉ねぎをオリーブオイルで炒める" },
      { id: "p1-p2",  type: "photo", base64: placeholder("#9A3030", "🍅", "煮込む") },
      { id: "p1-s2",  type: "step", text: "トマト缶を加えて10分煮込む" },
      { id: "p1-p3",  type: "photo", base64: placeholder("#A05050", "🥛", "生クリームを加える") },
      { id: "p1-s3",  type: "step", text: "生クリームを加えてさらに5分煮る" },
      { id: "p1-s4",  type: "step", text: "茹でたパスタと和えて塩コショウで整える" },
    ],
    originalImages: [],
  },
  {
    title: "麻婆豆腐",
    genre: "中華" as Genre,
    blocks: [
      { id: "m1-ing",  type: "ingredients", items: ["木綿豆腐 1丁", "豚ひき肉 100g", "豆板醤 小さじ1", "甜麺醤 大さじ1", "鶏ガラスープ 200ml", "片栗粉 大さじ1", "ごま油 少々", "長ねぎ 1/2本"] },
      { id: "m1-hero", type: "photo", base64: placeholder("#8B3A2A", "🌶️", "完成") },
      { id: "m1-p1",  type: "photo", base64: placeholder("#7A4A3C", "🫘", "豆腐を湯がく") },
      { id: "m1-s1",  type: "step", text: "豆腐を1.5cm角に切り、熱湯でさっと茹でる" },
      { id: "m1-p2",  type: "photo", base64: placeholder("#8B4030", "🥩", "炒める") },
      { id: "m1-s2",  type: "step", text: "豚ひき肉を炒め、豆板醤と甜麺醤を加えて香りを出す" },
      { id: "m1-p3",  type: "photo", base64: placeholder("#A04030", "🍲", "仕上げ") },
      { id: "m1-s3",  type: "step", text: "スープを加えて豆腐を入れ、水溶き片栗粉でとろみをつけごま油で仕上げる" },
    ],
    originalImages: [],
  },
  {
    title: "ガパオライス",
    genre: "肉・魚メイン" as Genre,
    blocks: [
      { id: "g1-ing",  type: "ingredients", items: ["鶏ひき肉 200g", "バジル 1束", "パプリカ 1個", "にんにく 2片", "唐辛子 2本", "ナンプラー 大さじ1", "オイスターソース 大さじ1", "卵 2個", "ごはん 2膳"] },
      { id: "g1-hero", type: "photo", base64: placeholder("#6B8B40", "🌿", "完成") },
      { id: "g1-p1",  type: "photo", base64: placeholder("#5A7030", "🧄", "香りを出す") },
      { id: "g1-s1",  type: "step", text: "にんにくと唐辛子をサラダ油で炒めて香りを出す" },
      { id: "g1-p2",  type: "photo", base64: placeholder("#6A8040", "🥘", "炒める") },
      { id: "g1-s2",  type: "step", text: "鶏ひき肉とパプリカを炒め、ナンプラーとオイスターソースで味付けする" },
      { id: "g1-p3",  type: "photo", base64: placeholder("#7A9050", "🍳", "盛り付け") },
      { id: "g1-s3",  type: "step", text: "バジルを加えてさっと炒め、目玉焼きと一緒にごはんに盛る" },
    ],
    originalImages: [],
  },
  {
    title: "チョコレートムース",
    genre: "デザート・スイーツ" as Genre,
    blocks: [
      { id: "c1-ing",  type: "ingredients", items: ["ダークチョコレート 150g", "生クリーム 200ml", "卵黄 2個", "砂糖 30g", "バター 20g"] },
      { id: "c1-hero", type: "photo", base64: placeholder("#3A2020", "🍫", "完成") },
      { id: "c1-p1",  type: "photo", base64: placeholder("#4A2A2A", "♨️", "湯煎") },
      { id: "c1-s1",  type: "step", text: "チョコレートとバターを湯煎で溶かし、卵黄と砂糖を混ぜ合わせる" },
      { id: "c1-p2",  type: "photo", base64: placeholder("#3A3050", "🌀", "泡立てる") },
      { id: "c1-s2",  type: "step", text: "生クリームを8分立てに泡立てる" },
      { id: "c1-p3",  type: "photo", base64: placeholder("#302030", "❄️", "冷やす") },
      { id: "c1-s3",  type: "step", text: "チョコレート液に生クリームを2回に分けて折り混ぜ、冷蔵庫で2時間冷やす" },
    ],
    originalImages: [],
  },
  {
    title: "豚汁",
    genre: "スープ・汁物" as Genre,
    blocks: [
      { id: "t1-ing",  type: "ingredients", items: ["豚バラ肉 150g", "大根 1/4本", "人参 1/2本", "ごぼう 1/2本", "こんにゃく 1/2枚", "味噌 大さじ3", "だし 800ml", "ごま油 少々"] },
      { id: "t1-hero", type: "photo", base64: placeholder("#9B6B30", "🍜", "完成") },
      { id: "t1-p1",  type: "photo", base64: placeholder("#7A5028", "🔪", "野菜を切る") },
      { id: "t1-s1",  type: "step", text: "野菜と豚肉を食べやすい大きさに切る" },
      { id: "t1-p2",  type: "photo", base64: placeholder("#8A6030", "🥘", "炒める") },
      { id: "t1-s2",  type: "step", text: "ごま油で豚肉と野菜を炒め、だしを加えて煮る" },
      { id: "t1-p3",  type: "photo", base64: placeholder("#A07040", "🫕", "味噌を溶く") },
      { id: "t1-s3",  type: "step", text: "野菜が柔らかくなったら味噌を溶き入れる" },
    ],
    originalImages: [],
  },
];

export async function seedDummyData() {
  if (typeof window === "undefined") return;
  const existing = await getRecipes();
  if (existing.length > 0) return;

  const now = new Date();
  for (let i = 0; i < DUMMY_RECIPES.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 3);
    await saveRecipe({ ...DUMMY_RECIPES[i], id: crypto.randomUUID(), createdAt: date.toISOString() });
  }
}
