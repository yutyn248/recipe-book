"use client";

import Link from "next/link";
import { Recipe } from "@/types/recipe";

interface RecipeCardProps {
  recipe: Recipe;
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const photoBlock = recipe.blocks.find((b) => b.type === "photo") as
    | { type: "photo"; base64: string }
    | undefined;

  const ingredientsBlock = recipe.blocks.find((b) => b.type === "ingredients") as
    | { type: "ingredients"; items: string[] }
    | undefined;

  const stepCount = recipe.blocks.filter((b) => b.type === "step").length;

  return (
    <Link href={`/recipes/${recipe.id}`} className="press-effect block">
      <div
        className="rounded-2xl overflow-hidden card-shadow"
        style={{ background: "var(--surface)" }}
      >
        {/* Portrait photo (3:4) */}
        <div
          className="w-full overflow-hidden relative"
          style={{ aspectRatio: "3/4", background: "var(--accent-light)" }}
        >
          {photoBlock ? (
            <img
              src={photoBlock.base64}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)", opacity: 0.4 }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          )}

          {/* Genre badge */}
          {recipe.genre && (
            <div
              className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(255,255,255,0.88)",
                color: "var(--text-primary)",
                backdropFilter: "blur(6px)",
              }}
            >
              {recipe.genre}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="px-3 pt-2.5 pb-3">
          <h3
            className="font-bold text-sm leading-snug line-clamp-2"
            style={{ color: "var(--text-primary)" }}
          >
            {recipe.title}
          </h3>
          {(ingredientsBlock || stepCount > 0) && (
            <p
              className="text-xs mt-1 font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {ingredientsBlock ? `${ingredientsBlock.items.length}品` : ""}
              {ingredientsBlock && stepCount > 0 ? " · " : ""}
              {stepCount > 0 ? `${stepCount}工程` : ""}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
