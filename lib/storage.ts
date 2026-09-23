import { supabase } from "./supabase";
import { Recipe } from "@/types/recipe";

/**
 * Supabaseのエラーを分かりやすいメッセージに変換する。
 * fetch自体が失敗する場合（ネットワーク不通・Supabaseプロジェクトの一時停止など）と、
 * それ以外のエラー（RLS拒否・カラム不整合など）を区別できるようにする。
 */
function friendlyError(error: { message?: string } | null | undefined): Error {
  const msg = error?.message ?? "";
  // ネットワーク不通（DNS引けない等）に加え、一時停止中〜再開処理中に返る
  // CloudflareのHTMLエラーページ（521など）も「一時停止の可能性あり」として扱う。
  // これらはSupabase/Postgres自体ではなくインフラ層のエラーのため、通常JSONでは返らずHTMLになる。
  const looksLikePauseOrDown =
    /fetch failed|Failed to fetch|NetworkError|ENOTFOUND/i.test(msg) ||
    /<!DOCTYPE|<html|cloudflare|Web server is down|52[0-9]:/i.test(msg);
  if (looksLikePauseOrDown) {
    return new Error(
      "Supabaseに接続できませんでした。無料プランは7日間アクセスがないと自動的に一時停止するため、Supabaseダッシュボードでプロジェクトが「一時停止（Paused）」になっていないか確認し、なっていれば「再開（Restore）」を押してください。再開直後は起動に数分かかることがあるので、その場合は少し待ってから再試行してください。"
    );
  }
  return new Error(`Supabaseでエラーが発生しました（一時停止とは別の問題です）: ${msg || "不明なエラー"}`);
}

/**
 * 一覧表示用の軽量版。recipes_listビュー（hero/photoブロックの画像データと
 * original_imagesを除外したもの）を参照し、データ転送量を大幅に削減する。
 * 一覧画面は写真を表示しないため、これで表示内容に影響はない。
 */
export async function getRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes_list")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw friendlyError(error);
  return (data ?? []).map(rowToRecipe);
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  const { error } = await supabase.from("recipes").insert(recipeToRow(recipe));
  if (error) throw friendlyError(error);
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    // PGRST116: 該当行が存在しない（本当に見つからない場合のみnullを返す）
    if (error.code === "PGRST116") return null;
    throw friendlyError(error);
  }
  return rowToRecipe(data);
}

export async function updateRecipe(updated: Recipe): Promise<void> {
  const withTimestamp = { ...updated, updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from("recipes")
    .update(recipeToRow(withTimestamp))
    .eq("id", updated.id);
  if (error) throw friendlyError(error);
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw friendlyError(error);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecipe(row: any): Recipe {
  return {
    id: row.id,
    title: row.title,
    genre: row.genre ?? null,
    blocks: row.blocks ?? [],
    originalImages: row.original_images ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

function recipeToRow(r: Recipe) {
  return {
    id: r.id,
    title: r.title,
    genre: r.genre,
    blocks: r.blocks,
    original_images: r.originalImages,
    created_at: r.createdAt,
    updated_at: r.updatedAt ?? null,
  };
}
