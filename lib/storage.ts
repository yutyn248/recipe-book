import { supabase } from "./supabase";
import { Recipe } from "@/types/recipe";

/**
 * Supabaseのエラーを分かりやすいメッセージに変換する。
 * fetch自体が失敗する場合（ネットワーク不通・Supabaseプロジェクトの一時停止など）と、
 * それ以外のエラー（RLS拒否・カラム不整合など）を区別できるようにする。
 */
function friendlyError(error: { message?: string } | null | undefined): Error {
  const msg = error?.message ?? "";
  if (/fetch failed|Failed to fetch|NetworkError|ENOTFOUND/i.test(msg)) {
    return new Error(
      "Supabaseに接続できませんでした。無料プランは7日間アクセスがないと自動的に一時停止するため、Supabaseダッシュボードでプロジェクトが「一時停止（Paused）」になっていないか確認し、なっていれば「再開（Restore）」を押してください。"
    );
  }
  return new Error(`Supabaseでエラーが発生しました（一時停止とは別の問題です）: ${msg || "不明なエラー"}`);
}

export async function getRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
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
