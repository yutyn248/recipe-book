"use client";

import Link from "next/link";
import { Recipe } from "@/types/recipe";
import { RecipeMeta } from "@/lib/recipe-meta";

interface RecipeCardProps {
  recipe: Recipe;
  meta?: RecipeMeta;
  isDuplicate?: boolean;
}

export default function RecipeCard({ recipe, meta, isDuplicate }: RecipeCardProps) {
  const ingredientsBlock = recipe.blocks.find((b) => b.type === "ingredients") as
    | { type: "ingredients"; items: string[] }
    | undefined;

  const stepCount = recipe.blocks.filter((b) => b.type === "step").length;

  return (
    <Link href={`/recipes/${recipe.id}`} className="press-effect block">
      <div
        className="rounded-2xl px-4 py-4 card-shadow"
        style={{ background: "var(--surface)", outline: isDuplicate ? "1.5px solid #FECACA" : undefined }}
      >
        <div className="flex items-start justify-between gap-1 mb-1">
          <div className="flex-1 min-w-0">
            {recipe.genre && (
              <span
                className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5"
                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
              >
                {recipe.genre}
              </span>
            )}
            <h3
              className="font-bold text-sm leading-snug line-clamp-2"
              style={{ color: "var(--text-primary)" }}
            >
              {recipe.title}
            </h3>
            {meta?.lastCookedAt && (
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                最終調理 {new Date(meta.lastCookedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
              </p>
            )}
          </div>
          {meta?.favorite && (
            <span className="text-base leading-none mt-0.5 flex-shrink-0" style={{ color: "#F43F5E" }}>♥</span>
          )}
        </div>
        {(ingredientsBlock || stepCount > 0 || meta?.rating) && (
          <div className="flex items-center justify-between mt-1.5">
            <p
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {ingredientsBlock ? `材料 ${ingredientsBlock.items.length}品` : ""}
              {ingredientsBlock && stepCount > 0 ? " · " : ""}
              {stepCount > 0 ? `${stepCount}工程` : ""}
            </p>
            {meta?.rating && (
              <span className="text-xs" style={{ color: "#F59E0B" }}>
                {"★".repeat(meta.rating)}{"☆".repeat(5 - meta.rating)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
