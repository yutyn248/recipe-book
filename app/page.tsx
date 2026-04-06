"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import UploadModal from "@/components/UploadModal";
import RecipeCard from "@/components/RecipeCard";
import { getRecipes } from "@/lib/storage";
import { Recipe, GENRES, Genre } from "@/types/recipe";
import { getShoppingItems } from "@/lib/shopping";
import { getAllMeta, RecipeMeta } from "@/lib/recipe-meta";

export default function Home() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [activeGenre, setActiveGenre] = useState<Genre | "すべて">("すべて");
  const [searchQuery, setSearchQuery] = useState("");
  const [showGenreSheet, setShowGenreSheet] = useState(false);
  const [shoppingCount, setShoppingCount] = useState(0);
  const [allMeta, setAllMeta] = useState<Record<string, RecipeMeta>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    setShoppingCount(getShoppingItems().filter((i) => !i.checked).length);
    setAllMeta(getAllMeta());
  }, []);

  // レシピ画面から戻った時にメタを再取得
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        setAllMeta(getAllMeta());
        setShoppingCount(getShoppingItems().filter((i) => !i.checked).length);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  async function loadRecipes() {
    // キャッシュがあれば即時表示
    const cached = localStorage.getItem("recipes_cache");
    if (cached) setRecipes(JSON.parse(cached));

    // Supabaseから最新を取得して更新
    const fresh = await getRecipes();
    setRecipes(fresh);
    localStorage.setItem("recipes_cache", JSON.stringify(fresh));
  }

  useEffect(() => {
    loadRecipes();
  }, []);

  function handleRecipeSaved() {
    loadRecipes();
    setShowModal(false);
  }

  const filtered = recipes
    .filter((r) => !showFavoritesOnly || allMeta[r.id]?.favorite)
    .filter((r) => activeGenre === "すべて" || r.genre === activeGenre)
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.genre?.toLowerCase().includes(q)) return true;
      const ing = r.blocks.find((b) => b.type === "ingredients") as { items: string[] } | undefined;
      if (ing?.items.some((item) => item.toLowerCase().includes(q))) return true;
      return false;
    });

  const allGenres: Array<Genre | "すべて"> = ["すべて", ...GENRES];

  // 重複タイトル検出
  const titleCounts = recipes.reduce<Record<string, number>>((acc, r) => {
    acc[r.title] = (acc[r.title] ?? 0) + 1;
    return acc;
  }, {});
  const duplicateTitles = new Set(Object.keys(titleCounts).filter((t) => titleCounts[t] > 1));

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
              className="text-2xl font-black tracking-tight leading-none"
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
          {/* Shopping cart button */}
          <button
            onClick={() => router.push("/shopping")}
            className="press-effect relative w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--accent-light)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            {shoppingCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {shoppingCount > 9 ? "9+" : shoppingCount}
              </span>
            )}
          </button>
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

      {/* Genre filter button */}
      {recipes.length > 0 && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowGenreSheet(true)}
            className="press-effect flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: activeGenre !== "すべて" ? "var(--text-primary)" : "var(--surface)",
              color: activeGenre !== "すべて" ? "#FFF8F0" : "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            {activeGenre === "すべて" ? "ジャンル" : activeGenre}
            <span className="tabular-nums text-xs" style={{ opacity: 0.6 }}>
              {activeGenre === "すべて" ? recipes.length : recipes.filter((r) => r.genre === activeGenre).length}
            </span>
          </button>
          <button
            onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setAllMeta(getAllMeta()); }}
            className="press-effect flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: showFavoritesOnly ? "#FFF1F2" : "var(--surface)",
              color: showFavoritesOnly ? "#F43F5E" : "var(--text-secondary)",
              border: showFavoritesOnly ? "1px solid #FECDD3" : "1px solid var(--border)",
            }}
          >
            <span>{showFavoritesOnly ? "♥" : "♡"}</span>
            お気に入り
          </button>
          {(activeGenre !== "すべて") && (
            <button
              onClick={() => setActiveGenre("すべて")}
              className="press-effect text-xs font-medium px-2.5 py-1.5 rounded-lg"
              style={{ color: "var(--text-secondary)", background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              クリア
            </button>
          )}
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
              <RecipeCard key={recipe.id} recipe={recipe} meta={allMeta[recipe.id]} isDuplicate={duplicateTitles.has(recipe.title)} />
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

      {/* ジャンル選択シート */}
      {showGenreSheet && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.35)" }} onClick={() => setShowGenreSheet(false)}>
          <div className="w-full rounded-t-3xl" style={{ background: "var(--bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
            </div>
            <p className="text-sm font-bold px-5 pt-2 pb-3" style={{ color: "var(--text-secondary)" }}>ジャンルで絞り込む</p>
            <div className="pb-safe">
              {allGenres.map((g) => {
                const count = g === "すべて" ? recipes.length : recipes.filter((r) => r.genre === g).length;
                if (g !== "すべて" && count === 0) return null;
                const active = activeGenre === g;
                return (
                  <button
                    key={g}
                    onClick={() => { setActiveGenre(g); setShowGenreSheet(false); }}
                    className="press-effect w-full flex items-center justify-between px-5 py-3.5 text-left"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <span className="text-sm font-medium" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                      {g}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>{count}</span>
                      {active && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
              <div className="h-6" />
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <UploadModal
          onClose={() => setShowModal(false)}
          onSaved={handleRecipeSaved}
          existingTitles={recipes.map((r) => r.title)}
        />
      )}
    </div>
  );
}
