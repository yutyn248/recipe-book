-- 一覧画面（RecipeCard）は写真を一切表示しないにもかかわらず、
-- 一覧取得のたびにhero/photoブロックの巨大なbase64画像データと
-- original_images（元写真）を含む全データをダウンロードしていた。
-- これによりSupabase無料プランのデータ転送量（Egress）クォータを
-- 使い果たし、「The quota has been exceeded.」エラーで一覧が
-- 取得できなくなっていた。
--
-- 一覧専用のビューを作り、画像を含むブロック（hero/photo）と
-- original_imagesを除外して転送量を大幅に削減する。
-- 詳細画面（getRecipeById）は引き続きrecipesテーブルを直接参照し、
-- 画像を含む全データを取得する。

create or replace view public.recipes_list
with (security_invoker = on)
as
select
  id,
  title,
  genre,
  coalesce(
    (
      select jsonb_agg(b)
      from jsonb_array_elements(blocks) b
      where b->>'type' not in ('hero', 'photo')
    ),
    '[]'::jsonb
  ) as blocks,
  created_at,
  updated_at
from public.recipes;

grant select on public.recipes_list to anon, authenticated;
