import { supabase } from "./supabase";
import { Recipe } from "@/types/recipe";

export async function getRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToRecipe);
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  const { error } = await supabase.from("recipes").insert(recipeToRow(recipe));
  if (error) throw error;
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return rowToRecipe(data);
}

export async function updateRecipe(updated: Recipe): Promise<void> {
  const withTimestamp = { ...updated, updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from("recipes")
    .update(recipeToRow(withTimestamp))
    .eq("id", updated.id);
  if (error) throw error;
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
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
