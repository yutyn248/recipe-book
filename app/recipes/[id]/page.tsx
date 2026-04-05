"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRecipeById, deleteRecipe, updateRecipe } from "@/lib/storage";
import { Recipe, GENRES, Genre } from "@/types/recipe";
import { Block } from "@/types/block";
import BlockEditor from "@/components/BlockEditor";

export default function RecipePage() {
  const params = useParams();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editGenre, setEditGenre] = useState<Genre | null>(null);
  const [editBlocks, setEditBlocks] = useState<Block[]>([]);
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const r = await getRecipeById(params.id as string);
      if (!r) { router.push("/"); return; }
      setRecipe(r);
      setEditTitle(r.title);
      setEditGenre(r.genre);
      setEditBlocks(r.blocks);
    })();
  }, [params.id, router]);

  function enterEdit() {
    if (!recipe) return;
    setEditTitle(recipe.title);
    setEditGenre(recipe.genre);
    setEditBlocks(recipe.blocks);
    setIsEditing(true);
  }

  async function saveEdit() {
    if (!recipe) return;
    const updated = { ...recipe, title: editTitle, genre: editGenre, blocks: editBlocks };
    await updateRecipe(updated);
    setRecipe(updated);
    setIsEditing(false);
  }

  async function handleDelete() {
    if (!recipe) return;
    if (confirm("このレシピを削除しますか？")) {
      await deleteRecipe(recipe.id);
      router.push("/");
    }
  }

  function toggleStep(id: string) {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!recipe) return null;

  const photoBlocks = recipe.blocks.filter((b) => b.type === "photo") as { id: string; type: "photo"; base64: string }[];
  const ingredientsBlock = recipe.blocks.find((b) => b.type === "ingredients") as { id: string; type: "ingredients"; items: string[] } | undefined;
  const stepBlocks = recipe.blocks.filter((b) => b.type === "step") as { id: string; type: "step"; text: string }[];
  const checkedCount = stepBlocks.filter((s) => checkedSteps.has(s.id)).length;
  const allDone = stepBlocks.length > 0 && checkedCount === stepBlocks.length;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="safe-top" />

      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 sticky top-0 z-20"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={() => router.push("/")}
          className="press-effect flex items-center gap-1.5 text-sm font-semibold py-2 pr-3"
          style={{ color: "var(--text-primary)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          戻る
        </button>

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="press-effect px-3.5 py-1.5 rounded-xl text-sm font-medium"
                style={{ background: "var(--border)", color: "var(--text-secondary)" }}
              >
                キャンセル
              </button>
              <button
                onClick={saveEdit}
                className="press-effect px-3.5 py-1.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                保存
              </button>
            </>
          ) : (
            <button
              onClick={enterEdit}
              className="press-effect px-3.5 py-1.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              編集
            </button>
          )}
        </div>
      </header>

      <div className="pb-20">
        {isEditing ? (
          /* ═══ 編集モード ═══ */
          <div className="px-4 pt-5">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-secondary)" }}>料理名</p>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full font-black outline-none pb-1.5 bg-transparent text-lg"
                style={{ color: "var(--text-primary)", borderBottom: "2px solid var(--accent)" }}
              />
            </div>
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-secondary)" }}>ジャンル</p>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setEditGenre(editGenre === g ? null : g)}
                    className="press-effect px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors"
                    style={editGenre === g
                      ? { background: "var(--accent)", color: "#fff" }
                      : { background: "var(--bg)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
                    }
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <BlockEditor blocks={editBlocks} onChange={setEditBlocks} />

            {/* Delete — at the bottom of edit mode */}
            <button
              onClick={handleDelete}
              className="press-effect mt-10 w-full py-3 rounded-2xl text-sm font-semibold"
              style={{ background: "#FEF2F2", color: "#DC2626" }}
            >
              このレシピを削除する
            </button>
          </div>

        ) : (
          /* ═══ 表示モード ═══ */
          <>
            {/* Title section */}
            <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-start gap-3 justify-between mb-2">
                <h1 className="text-2xl font-black leading-tight flex-1" style={{ color: "var(--text-primary)" }}>
                  {recipe.title}
                </h1>
                {recipe.genre && (
                  <span
                    className="flex-shrink-0 mt-0.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                  >
                    {recipe.genre}
                  </span>
                )}
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {ingredientsBlock && (
                  <div className="flex items-center gap-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)" }}>
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                    <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      材料 {ingredientsBlock.items.length}品
                    </span>
                  </div>
                )}
                {stepBlocks.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)" }}>
                      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      {stepBlocks.length}ステップ
                    </span>
                  </div>
                )}
                <span className="text-xs" style={{ color: "var(--border)" }}>|</span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {new Date(recipe.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })}
                </span>
              </div>
            </div>

            <div className="px-5 pt-5 space-y-4">

              {/* Blocks rendered in order */}
              <ViewBlocks
                blocks={recipe.blocks}
                checkedSteps={checkedSteps}
                onToggleStep={toggleStep}
              />

              {/* All done banner */}
              {allDone && (
                <div className="px-4 py-3 rounded-2xl text-center" style={{ background: "#F0FDF4" }}>
                  <p className="text-sm font-bold" style={{ color: "#16A34A" }}>
                    お疲れ様でした！完成です
                  </p>
                </div>
              )}

              {checkedCount > 0 && !allDone && (
                <p className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
                  {checkedCount}/{stepBlocks.length} ステップ完了
                </p>
              )}

              {checkedCount > 0 && (
                <div className="text-center">
                  <button
                    onClick={() => setCheckedSteps(new Set())}
                    className="text-xs font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    チェックをリセット
                  </button>
                </div>
              )}

              {/* Original images */}
              {recipe.originalImages.length > 0 && (
                <section>
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    元の写真
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {recipe.originalImages.map((img, i) => (
                      <img key={i} src={img} alt={`元ページ${i + 1}`} className="w-full rounded-xl" />
                    ))}
                  </div>
                </section>
              )}

            </div>
          </>
        )}
      </div>

      <div className="safe-bottom h-6" />
    </div>
  );
}

// ─── ブロックを配列順どおりに描画 ───────────────────────────
function ViewBlocks({
  blocks,
  checkedSteps,
  onToggleStep,
}: {
  blocks: Block[];
  checkedSteps: Set<string>;
  onToggleStep: (id: string) => void;
}) {
  let stepCounter = 0;

  return (
    <div className="space-y-4">
      {blocks.map((block) => {

        // 写真
        if (block.type === "photo") {
          return (
            <div key={block.id} className="rounded-2xl overflow-hidden card-shadow" style={{ aspectRatio: "4/3" }}>
              <img src={block.base64} alt="写真" className="w-full h-full object-cover" />
            </div>
          );
        }

        // 材料
        if (block.type === "ingredients") {
          return (
            <div key={block.id}>
              <h2 className="text-base font-black mb-2" style={{ color: "var(--text-primary)" }}>材料</h2>
              <div className="rounded-2xl overflow-hidden card-shadow" style={{ background: "var(--surface)" }}>
                {block.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center px-4 py-3"
                    style={{ borderBottom: i < block.items.length - 1 ? "1px solid var(--border)" : undefined }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-3" style={{ background: "var(--accent)" }} />
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // 手順
        if (block.type === "step") {
          stepCounter += 1;
          const num = stepCounter;
          const checked = checkedSteps.has(block.id);
          return (
            <button
              key={block.id}
              onClick={() => onToggleStep(block.id)}
              className="press-effect w-full text-left flex gap-3 items-start px-4 py-4 rounded-2xl card-shadow"
              style={{
                background: checked ? "#F0FDF4" : "var(--surface)",
                border: checked ? "1px solid #BBF7D0" : "1px solid transparent",
              }}
            >
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
                style={{ background: checked ? "#16A34A" : "var(--accent)", color: "#fff" }}
              >
                {checked ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : num}
              </div>
              <p
                className="text-sm leading-relaxed flex-1 mt-0.5"
                style={{
                  color: checked ? "#166534" : "var(--text-primary)",
                  textDecoration: checked ? "line-through" : undefined,
                  opacity: checked ? 0.7 : 1,
                }}
              >
                {block.text}
              </p>
            </button>
          );
        }

        return null;
      })}
    </div>
  );
}
