"use client";

import { useState, useEffect } from "react";
import UploadModal from "@/components/UploadModal";
import RecipeCard from "@/components/RecipeCard";
import { getRecipes } from "@/lib/storage";
import { seedDummyData } from "@/lib/seed";
import { Recipe, GENRES, Genre } from "@/types/recipe";

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [activeGenre, setActiveGenre] = useState<Genre | "すべて">("すべて");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadRecipes() {
    setRecipes(await getRecipes());
  }

  useEffect(() => {
    (async () => {
      await seedDummyData();
      await loadRecipes();
    })();
  }, []);

  function handleRecipeSaved() {
    loadRecipes();
    setShowModal(false);
  }

  const filtered = recipes
    .filter((r) => activeGenre === "すべて" || r.genre === activeGenre)
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return r.title.toLowerCase().includes(q) || r.genre?.toLowerCase().includes(q);
    });

  const allGenres: Array<Genre | "すべて"> = ["すべて", ...GENRES];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="safe-top" />

      {/* Header */}
      <header className="px-5 pt-6 pb-4" style={{ background: "var(--bg)" }}>
        <div className="flex items-end justify-between">
          <div>
            <p
              className="text-xs font-semibold tracking-[0.18em] uppercase mb-1"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              My Kitchen
            </p>
            <h1
              className="text-4xl font-black tracking-tight leading-none"
              style={{ color: "var(--text-primary)" }}
            >
              レシピ帳
            </h1>
            {recipes.length > 0 && (
              <p
                className="text-sm mt-1.5 font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {recipes.length}品のレシピ
              </p>
            )}
          </div>
          {/* Recipe count ring */}
          {recipes.length > 0 && (
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--accent-light)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
          )}
        </div>
      </header>

      {/* Search bar */}
      {recipes.length > 0 && (
        <div className="px-4 pb-3">
          <div
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="レシピを検索..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-primary)" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{ color: "var(--text-secondary)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Genre filter */}
      {recipes.length > 0 && (
        <div
          className="flex gap-2 px-4 py-2.5 overflow-x-auto hide-scrollbar"
          style={{ background: "var(--bg)" }}
        >
          {allGenres.map((g) => {
            const count = g === "すべて"
              ? recipes.length
              : recipes.filter((r) => r.genre === g).length;
            if (g !== "すべて" && count === 0) return null;
            const active = activeGenre === g;
            return (
              <button
                key={g}
                onClick={() => setActiveGenre(g)}
                className="press-effect flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={active
                  ? { background: "var(--text-primary)", color: "#FFF8F0" }
                  : { background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
                }
              >
                {g}
                <span
                  className="ml-1.5 tabular-nums"
                  style={{ opacity: active ? 0.55 : 0.7 }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Divider */}
      {recipes.length > 0 && (
        <div className="mx-4 mb-1" style={{ height: 1, background: "var(--border)", opacity: 0.6 }} />
      )}

      <main className="px-4 pt-4 pb-36">
        {recipes.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center min-h-[65vh] text-center px-6">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6"
              style={{ background: "var(--accent-light)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <h2 className="text-xl font-black mb-2" style={{ color: "var(--text-primary)" }}>
              レシピを追加しよう
            </h2>
            <p className="text-sm leading-relaxed mb-10" style={{ color: "var(--text-secondary)" }}>
              料理本のページを撮影すると<br />AIが自動でレシピを読み取ります
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="press-effect inline-flex items-center gap-2 font-semibold px-7 py-3.5 rounded-2xl fab-shadow"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <span className="text-lg font-light leading-none">+</span>
              最初のレシピを追加
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <p className="text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {searchQuery
                ? `「${searchQuery}」に一致するレシピはありません`
                : `「${activeGenre}」のレシピはまだありません`}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs font-semibold"
                style={{ color: "var(--accent)" }}
              >
                検索をクリア
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      {recipes.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 pointer-events-none">
          <div className="safe-bottom" />
          <div className="flex justify-center pb-6 pointer-events-auto">
            <button
              onClick={() => setShowModal(true)}
              className="press-effect inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm fab-shadow"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <span className="text-lg font-light leading-none">+</span>
              レシピを追加
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <UploadModal
          onClose={() => setShowModal(false)}
          onSaved={handleRecipeSaved}
        />
      )}
    </div>
  );
}
