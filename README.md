# レシピ帳

料理本のページを撮影すると、AIが自動でレシピを読み取って保存できる個人用レシピ管理PWAアプリ。

## 機能

- **AI自動読み取り** — 料理本や手書きレシピを撮影するとAIが材料・手順を自動抽出
- **レシピ管理** — ブロックエディタで材料・手順を編集、画像付きで保存
- **ジャンル絞り込み** — 和食・洋食・中華・イタリアンなど11ジャンルでフィルタ
- **検索** — タイトル・ジャンル・食材名でインクリメンタル検索
- **お気に入り** — よく作るレシピをマーク
- **買い物リスト** — レシピから食材をワンタップで買い物リストに追加
- **PWA対応** — iPhoneのホーム画面に追加してアプリのように使用可能
- **オフラインキャッシュ** — 一度読み込んだレシピはオフラインでも表示

## 技術スタック

| 役割 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript |
| スタイル | Tailwind CSS v4 |
| バックエンド/DB | Supabase (PostgreSQL + Storage) |
| テスト | Vitest + Testing Library |
| デプロイ | Vercel |

## 外部サービス

| サービス | 用途 |
|---------|------|
| **Supabase** | レシピデータの保存（PostgreSQL）・画像ストレージ |
| **Google Gemini API** | 写真・URLからのレシピAI読み取り（`gemini-3.6-flash`） |

Supabaseのプロジェクト設定は [Supabase Dashboard](https://supabase.com/dashboard) から確認。
Gemini APIキーは [Google AI Studio](https://aistudio.google.com/apikey) で無料発行（カード登録不要）。

## 環境構築〜起動手順

### 必要なもの
- Node.js 20+
- Supabaseアカウント・プロジェクト

### 1. リポジトリのクローン＆パッケージインストール

```bash
git clone <repo-url>
cd recipe-book
npm install
```

### 2. 環境変数の設定

`.env.local` を作成し、以下を設定：

```bash
cp .env.example .env.local  # .env.exampleがない場合は手動で作成
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

> - Supabase: Dashboard → Project Settings → API から取得
> - Gemini: [Google AI Studio](https://aistudio.google.com/apikey) で無料発行（カード登録なしで利用可能）

### 3. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 で確認

### 4. 動作確認

1. 「レシピを追加」ボタンをタップ
2. 料理本のページを撮影またはファイルをアップロード
3. AIがレシピを自動読み取り → 確認して保存

## テスト

```bash
npm test          # ユニットテスト実行
npm run test:ui   # UIモードで確認
```

## デプロイ

Vercel と連携済み。`main` ブランチへのプッシュで自動デプロイ。

## よくあるエラーと対処法

| エラー | 原因 | 対処 |
|--------|------|------|
| `supabaseUrl is required` | `.env.local` の設定漏れ | 環境変数を確認 |
| 画像がアップロードできない | Supabase Storageのバケット未設定 | Dashboardでバケット作成・権限設定 |
| ビルドエラー（型エラー） | TypeScriptの型不一致 | `npm run lint` で確認 |
| AI読み取りが `AI_API_ERROR` で失敗する | `GEMINI_API_KEY` の未設定・無効、またはGemini側のモデル廃止 | キーを確認。404エラーの場合は `gemini-3.6-flash` が廃止されていないか [Gemini公式モデル一覧](https://ai.google.dev/gemini-api/docs/models) を確認 |
