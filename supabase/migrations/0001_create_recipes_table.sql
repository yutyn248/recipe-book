-- recipes テーブル作成
-- lib/storage.ts の recipeToRow/rowToRecipe に対応するスキーマ

create table if not exists public.recipes (
  id text primary key,
  title text not null,
  genre text,
  blocks jsonb not null default '[]'::jsonb,
  original_images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 一覧表示（created_at降順）を高速化
create index if not exists recipes_created_at_idx on public.recipes (created_at desc);

-- 個人利用アプリのため認証は設けず、anonキーからのフルアクセスを許可
alter table public.recipes enable row level security;

create policy "allow all for anon" on public.recipes
  for all
  to anon
  using (true)
  with check (true);
