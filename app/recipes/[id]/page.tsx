"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRecipeById, deleteRecipe, updateRecipe, getRecipes } from "@/lib/storage";
import { Recipe, GENRES, Genre } from "@/types/recipe";
import { Block } from "@/types/block";
import BlockEditor from "@/components/BlockEditor";
import { resizeImage } from "@/lib/crop-photo";
import AddToShoppingModal from "@/components/AddToShoppingModal";
import { getRecipeMeta, setFavorite, recordCooked, setRating, RecipeMeta } from "@/lib/recipe-meta";

export default function RecipePage() {
  const params = useParams();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editGenre, setEditGenre] = useState<Genre | null>(null);
  const [editBlocks, setEditBlocks] = useState<Block[]>([]);
  const [editHeroPhotos, setEditHeroPhotos] = useState<string[]>([]);
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [changeSummary, setChangeSummary] = useState<string[]>([]);
  const [pendingBlocks, setPendingBlocks] = useState<Block[]>([]);
  const [meta, setMeta] = useState<RecipeMeta>({});
  const [editRating, setEditRating] = useState<number | undefined>(undefined);
  const [showCookedModal, setShowCookedModal] = useState(false);
  const [cookedRating, setCookedRating] = useState<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const r = await getRecipeById(params.id as string);
      if (!r) { router.push("/"); return; }
      setRecipe(r);
      setEditTitle(r.title);
      setEditGenre(r.genre);
      const heroBlocks = r.blocks.filter((b) => b.type === "hero") as { id: string; type: "hero"; base64: string }[];
      const otherBlocks = r.blocks.filter((b) => b.type !== "hero");
      setEditHeroPhotos(heroBlocks.map((b) => b.base64));
      setEditBlocks(otherBlocks);
      const m = getRecipeMeta(r.id);
      setMeta(m);
      setEditRating(m.rating);
    })();
  }, [params.id, router]);

  function enterEdit() {
    if (!recipe) return;
    setEditTitle(recipe.title);
    setEditGenre(recipe.genre);
    const heroBlocks = recipe.blocks.filter((b) => b.type === "hero") as { id: string; type: "hero"; base64: string }[];
    const otherBlocks = recipe.blocks.filter((b) => b.type !== "hero");
    setEditHeroPhotos(heroBlocks.map((b) => b.base64));
    setEditBlocks(otherBlocks);
    setEditRating(meta.rating);
    setIsEditing(true);
  }

  function toggleFavorite() {
    if (!recipe) return;
    const next = !meta.favorite;
    setFavorite(recipe.id, next);
    setMeta((m) => ({ ...m, favorite: next }));
  }

  function handleRecordCooked() {
    if (!recipe) return;
    recordCooked(recipe.id, cookedRating);
    const updated = getRecipeMeta(recipe.id);
    setMeta(updated);
    setShowCookedModal(false);
    setCookedRating(undefined);
    setCheckedSteps(new Set());
  }

  async function requestSave() {
    if (!recipe) return;
    // 重複タイトルチェック
    if (editTitle.trim() !== recipe.title) {
      const all = await getRecipes();
      const dup = all.find((r) => r.id !== recipe.id && r.title === editTitle.trim());
      if (dup) {
        alert(`「${editTitle.trim()}」は既に登録されています。別の名前にしてください。`);
        return;
      }
    }
    const heroBlocks: Block[] = editHeroPhotos.map((base64) => ({
      id: crypto.randomUUID(),
      type: "hero",
      base64,
    }));
    const cleanBlocks = editBlocks
      .map((block) => {
        if (block.type === "ingredients") {
          return { ...block, items: block.items.filter((item) => item.trim() !== "") };
        }
        return block;
      })
      .filter((block) => {
        if (block.type === "step") return block.text.trim() !== "";
        if (block.type === "memo") return block.text.trim() !== "";
        if (block.type === "ingredients") return (block as { type: "ingredients"; items: string[] }).items.length > 0;
        return true;
      });
    const allBlocks = [...heroBlocks, ...cleanBlocks];

    // 変更サマリーを計算（詳細）
    const summary: string[] = [];
    const trunc = (s: string, n = 20) => s.length > n ? s.slice(0, n) + "…" : s;

    if (recipe.title !== editTitle) summary.push(`タイトル: 「${trunc(recipe.title)}」→「${trunc(editTitle)}」`);
    if (recipe.genre !== editGenre) summary.push(`ジャンル: ${recipe.genre ?? "なし"} → ${editGenre ?? "なし"}`);

    const origHero = recipe.blocks.filter((b) => b.type === "hero").length;
    const newHero = editHeroPhotos.length;
    if (newHero > origHero) summary.push(`完成写真を${newHero - origHero}枚追加`);
    else if (newHero < origHero) summary.push(`完成写真を${origHero - newHero}枚削除`);

    // 材料：セット比較（順序変更は無視）
    const origIngItems = (recipe.blocks.find((b) => b.type === "ingredients") as { items: string[] } | undefined)?.items ?? [];
    const newIngItems = (cleanBlocks.find((b) => b.type === "ingredients") as { items: string[] } | undefined)?.items ?? [];
    const origIngSet = new Set(origIngItems);
    const newIngSet = new Set(newIngItems);
    const addedIng = newIngItems.filter((x) => !origIngSet.has(x));
    const removedIng = origIngItems.filter((x) => !newIngSet.has(x));
    addedIng.forEach((x) => summary.push(`材料追加: ${trunc(x)}`));
    removedIng.forEach((x) => summary.push(`材料削除: ${trunc(x)}`));

    // 手順：セット比較（順序変更は無視）
    const origStepTexts = recipe.blocks.filter((b) => b.type === "step").map((b) => (b as { text: string }).text);
    const newStepTexts = cleanBlocks.filter((b) => b.type === "step").map((b) => (b as { text: string }).text);
    const origStepSet = new Set(origStepTexts);
    const newStepSet = new Set(newStepTexts);
    const addedSteps = newStepTexts.filter((x) => !origStepSet.has(x));
    const removedSteps = origStepTexts.filter((x) => !newStepSet.has(x));
    addedSteps.forEach((x) => summary.push(`手順追加: ${trunc(x)}`));
    removedSteps.forEach((x) => summary.push(`手順削除: ${trunc(x)}`));

    const origPhotos = recipe.blocks.filter((b) => b.type === "photo").length;
    const newPhotos = cleanBlocks.filter((b) => b.type === "photo").length;
    if (newPhotos > origPhotos) summary.push(`工程写真を${newPhotos - origPhotos}枚追加`);
    else if (newPhotos < origPhotos) summary.push(`工程写真を${origPhotos - newPhotos}枚削除`);

    // メモ
    const origMemos = recipe.blocks.filter((b) => b.type === "memo").map((b) => (b as { text: string }).text);
    const newMemos = cleanBlocks.filter((b) => b.type === "memo").map((b) => (b as { text: string }).text);
    const origMemoSet = new Set(origMemos);
    const newMemoSet = new Set(newMemos);
    newMemos.filter((x) => !origMemoSet.has(x)).forEach((x) => summary.push(`メモ追加: ${trunc(x)}`));
    origMemos.filter((x) => !newMemoSet.has(x)).forEach((x) => summary.push(`メモ削除: ${trunc(x)}`));

    // 評価
    if (editRating !== meta.rating) {
      if (editRating) summary.push(`評価: ${"★".repeat(editRating)}${"☆".repeat(5 - editRating)}`);
      else summary.push("評価を削除");
    }

    setPendingBlocks(allBlocks);
    setChangeSummary(summary.length > 0 ? summary : ["変更なし"]);
    setShowSaveConfirm(true);
  }

  async function executeSave() {
    if (!recipe) return;
    const updated = { ...recipe, title: editTitle, genre: editGenre, blocks: pendingBlocks };
    await updateRecipe(updated);
    setRecipe(updated);
    // save rating change
    if (editRating !== meta.rating) {
      setRating(recipe.id, editRating);
      const updatedMeta = getRecipeMeta(recipe.id);
      setMeta(updatedMeta);
    }
    setShowSaveConfirm(false);
    setIsEditing(false);
  }

  async function executeDelete() {
    if (!recipe) return;
    await deleteRecipe(recipe.id);
    router.push("/");
  }

  function toggleStep(id: string) {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleHeroFiles(files: FileList) {
    setHeroUploading(true);
    try {
      const results: string[] = [];
      for (const file of Array.from(files)) {
        const raw = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        results.push(await resizeImage(raw, 1200));
      }
      setEditHeroPhotos((prev) => [...prev, ...results].slice(0, 3));
    } finally {
      setHeroUploading(false);
      if (heroInputRef.current) heroInputRef.current.value = "";
    }
  }

  if (!recipe) return null;

  const heroPhotos = recipe.blocks.filter((b) => b.type === "hero") as { id: string; type: "hero"; base64: string }[];
  const nonHeroBlocks = recipe.blocks.filter((b) => b.type !== "hero");
  const ingredientsBlock = nonHeroBlocks.find((b) => b.type === "ingredients") as { id: string; type: "ingredients"; items: string[] } | undefined;
  const stepBlocks = nonHeroBlocks.filter((b) => b.type === "step") as { id: string; type: "step"; text: string }[];
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

        <div className="flex gap-2 items-center">
          {!isEditing && (
            <button
              onClick={toggleFavorite}
              className="press-effect w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{
                background: meta.favorite ? "#FFF1F2" : "var(--surface)",
                color: meta.favorite ? "#F43F5E" : "var(--text-secondary)",
              }}
            >
              {meta.favorite ? "♥" : "♡"}
            </button>
          )}
          {!isEditing && (
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
            {/* 完成写真 */}
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-secondary)" }}>完成写真（最大3枚）</p>
              <div className="flex gap-2">
                {editHeroPhotos.map((src, i) => (
                  <div key={i} className="relative flex-1 rounded-xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
                    <img src={src} alt={`完成写真${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute top-1 right-1 flex flex-col gap-1">
                      <button
                        onClick={() => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement("canvas");
                            canvas.width = img.height;
                            canvas.height = img.width;
                            const ctx = canvas.getContext("2d")!;
                            ctx.translate(canvas.width / 2, canvas.height / 2);
                            ctx.rotate(Math.PI / 2);
                            ctx.drawImage(img, -img.width / 2, -img.height / 2);
                            const rotated = canvas.toDataURL("image/jpeg", 0.72);
                            setEditHeroPhotos((prev) => prev.map((p, idx) => idx === i ? rotated : p));
                          };
                          img.src = src;
                        }}
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => setEditHeroPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
                      >✕</button>
                    </div>
                  </div>
                ))}
                {editHeroPhotos.length < 3 && (
                  <button
                    onClick={() => heroInputRef.current?.click()}
                    disabled={heroUploading}
                    className="flex-1 rounded-xl flex flex-col items-center justify-center gap-1.5 text-xs font-semibold"
                    style={{ aspectRatio: "4/3", border: "1.5px dashed var(--border)", color: "var(--text-secondary)", background: "var(--surface)", minHeight: 80 }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    {heroUploading ? "追加中…" : "＋ 追加"}
                  </button>
                )}
                {/* Spacer to keep layout stable when < 3 photos */}
                {editHeroPhotos.length === 0 && <div className="flex-1" />}
                {editHeroPhotos.length === 0 && <div className="flex-1" />}
                {editHeroPhotos.length === 1 && <div className="flex-1" />}
              </div>
              <input
                ref={heroInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleHeroFiles(e.target.files)}
              />
            </div>

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
            {/* 評価 */}
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-secondary)" }}>評価</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setEditRating(editRating === n ? undefined : n)}
                    className="press-effect text-2xl leading-none"
                    style={{ color: editRating !== undefined && n <= editRating ? "#F59E0B" : "var(--border)" }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <BlockEditor blocks={editBlocks} onChange={setEditBlocks} />

            {/* Save / Cancel */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setIsEditing(false)}
                className="press-effect flex-1 py-3 rounded-2xl text-sm font-medium"
                style={{ background: "var(--border)", color: "var(--text-secondary)" }}
              >
                キャンセル
              </button>
              <button
                onClick={requestSave}
                className="press-effect flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                保存する
              </button>
            </div>

            {/* Delete */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="press-effect mt-4 mx-auto block text-xs font-medium px-4 py-2 rounded-xl"
              style={{ color: "#DC2626", background: "transparent", border: "1px solid #FECACA" }}
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

              {/* 星評価 */}
              <div className="flex items-center gap-1 mt-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      const next = meta.rating === n ? undefined : n;
                      setRating(recipe.id, next);
                      setMeta((m) => ({ ...m, rating: next }));
                    }}
                    className="press-effect text-2xl leading-none"
                    style={{ color: meta.rating !== undefined && n <= meta.rating ? "#F59E0B" : "var(--border)" }}
                  >
                    ★
                  </button>
                ))}
                {meta.rating && (
                  <span className="text-xs ml-1" style={{ color: "var(--text-secondary)" }}>{meta.rating}/5</span>
                )}
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {ingredientsBlock && (
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    材料 {ingredientsBlock.items.length}品
                  </span>
                )}
                {stepBlocks.length > 0 && (
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    {stepBlocks.length}ステップ
                  </span>
                )}
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {new Date(recipe.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })}
                </span>
                {meta.lastCookedAt && (
                  <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                    最終調理 {new Date(meta.lastCookedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>

            {/* 買い物リストに追加ボタン */}
            {ingredientsBlock && (
              <div className="px-5 pt-4">
                <button
                  onClick={() => setShowShoppingModal(true)}
                  className="press-effect w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: "var(--accent-light)", color: "var(--accent)", border: "1.5px solid var(--accent-light)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                  買い物リストに追加
                </button>
              </div>
            )}

            <div className="px-5 pt-5 space-y-4">

              {/* 完成写真ギャラリー */}
              {heroPhotos.length > 0 && (
                <HeroGallery photos={heroPhotos.map((b) => b.base64)} />
              )}

              {/* Blocks rendered in order */}
              <ViewBlocks
                blocks={nonHeroBlocks}
                checkedSteps={checkedSteps}
                onToggleStep={toggleStep}
              />

              {/* All done — record cooking */}
              {allDone && (
                <div className="px-4 py-4 rounded-2xl text-center space-y-3" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                  <p className="text-sm font-bold" style={{ color: "#16A34A" }}>
                    お疲れ様でした！完成です 🎉
                  </p>
                  <button
                    onClick={() => { setCookedRating(undefined); setShowCookedModal(true); }}
                    className="press-effect inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: "#16A34A", color: "#fff" }}
                  >
                    完成を記録する
                  </button>
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

              {/* Original images — collapsible */}
              {recipe.originalImages.length > 0 && (
                <OriginalImages images={recipe.originalImages} />
              )}

            </div>
          </>
        )}
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full rounded-t-3xl px-5 pt-6 pb-10" style={{ background: "var(--bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border)" }} />
            <p className="text-base font-black mb-1" style={{ color: "var(--text-primary)" }}>レシピを削除しますか？</p>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>削除すると元に戻せません。</p>
            <button
              onClick={executeDelete}
              className="press-effect w-full py-3.5 rounded-2xl text-sm font-semibold mb-3"
              style={{ background: "#DC2626", color: "#fff" }}
            >
              削除する
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="press-effect w-full py-3.5 rounded-2xl text-sm font-medium"
              style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 保存確認モーダル */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowSaveConfirm(false)}>
          <div className="w-full rounded-t-3xl px-5 pt-6 pb-10" style={{ background: "var(--bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border)" }} />
            <p className="text-base font-black mb-3" style={{ color: "var(--text-primary)" }}>以下の内容で保存しますか？</p>
            <ul className="mb-6 space-y-1.5">
              {changeSummary.map((line, i) => (
                <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
                  {line}
                </li>
              ))}
            </ul>
            <button
              onClick={executeSave}
              className="press-effect w-full py-3.5 rounded-2xl text-sm font-semibold mb-3"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              保存する
            </button>
            <button
              onClick={() => setShowSaveConfirm(false)}
              className="press-effect w-full py-3.5 rounded-2xl text-sm font-medium"
              style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
            >
              編集に戻る
            </button>
          </div>
        </div>
      )}

      {showShoppingModal && ingredientsBlock && (
        <AddToShoppingModal
          recipeId={recipe.id}
          recipeTitle={recipe.title}
          ingredients={ingredientsBlock.items}
          onClose={() => setShowShoppingModal(false)}
          onAdded={() => {
            setShowShoppingModal(false);
            router.push("/shopping");
          }}
        />
      )}

      {/* 完成記録モーダル */}
      {showCookedModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowCookedModal(false)}>
          <div className="w-full rounded-t-3xl px-5 pt-6 pb-10" style={{ background: "var(--bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border)" }} />
            <p className="text-base font-black mb-1" style={{ color: "var(--text-primary)" }}>完成を記録する</p>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>今日の出来はどうでしたか？</p>
            <div className="flex justify-center gap-3 mb-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCookedRating(cookedRating === n ? undefined : n)}
                  className="press-effect text-3xl leading-none"
                  style={{ color: cookedRating !== undefined && n <= cookedRating ? "#F59E0B" : "var(--border)" }}
                >
                  ★
                </button>
              ))}
            </div>
            <button
              onClick={handleRecordCooked}
              className="press-effect w-full py-3.5 rounded-2xl text-sm font-semibold mb-3"
              style={{ background: "#16A34A", color: "#fff" }}
            >
              記録する
            </button>
            <button
              onClick={() => setShowCookedModal(false)}
              className="press-effect w-full py-3.5 rounded-2xl text-sm font-medium"
              style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="safe-bottom h-6" />
    </div>
  );
}

// ─── 完成写真ギャラリー ────────────────────────────────────
function HeroGallery({ photos }: { photos: string[] }) {
  if (photos.length === 1) {
    return (
      <img src={photos[0]} alt="完成写真" className="w-full rounded-2xl card-shadow" />
    );
  }

  if (photos.length === 2) {
    return (
      <div className="flex gap-2">
        {photos.map((src, i) => (
          <div key={i} className="flex-1 rounded-2xl overflow-hidden card-shadow" style={{ aspectRatio: "4/3" }}>
            <img src={src} alt={`完成写真${i + 1}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  // 3枚: 左に1枚大きく、右に2枚縦並び
  return (
    <div className="flex gap-2" style={{ height: 210 }}>
      <div className="flex-[2] rounded-2xl overflow-hidden card-shadow">
        <img src={photos[0]} alt="完成写真1" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 flex flex-col gap-2">
        {photos.slice(1).map((src, i) => (
          <div key={i} className="flex-1 rounded-2xl overflow-hidden card-shadow">
            <img src={src} alt={`完成写真${i + 2}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
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

        if (block.type === "hero") return null;

        // メモ
        if (block.type === "memo") {
          if (!block.text.trim()) return null;
          return (
            <div key={block.id} className="px-4 py-3 rounded-2xl" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#D97706" }}>メモ</p>
              <p className="text-sm leading-relaxed" style={{ color: "#92400E", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {block.text}
              </p>
            </div>
          );
        }

        // 写真
        if (block.type === "photo") {
          return (
            <div key={block.id} className="rounded-2xl overflow-hidden card-shadow flex items-center justify-center" style={{ background: "var(--surface)" }}>
              <img src={block.base64} alt="写真" className="w-full object-contain rounded-2xl" style={{ maxHeight: 280 }} />
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
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-3 mt-1.5" style={{ background: "var(--accent)" }} />
                    <span className="text-sm flex-1" style={{ color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "anywhere" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // 手順
        if (block.type === "step") {
          const isPoint = block.text.startsWith("【ポイント】");
          if (!isPoint) stepCounter += 1;
          const num = isPoint ? null : stepCounter;
          const checked = checkedSteps.has(block.id);

          if (isPoint) {
            return (
              <div
                key={block.id}
                className="flex gap-3 items-start px-4 py-3 rounded-2xl"
                style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
              >
                <span className="text-base flex-shrink-0 mt-0.5">💡</span>
                <p className="text-sm leading-relaxed flex-1" style={{ color: "#92400E" }}>
                  {block.text.replace("【ポイント】", "")}
                </p>
              </div>
            );
          }

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

// ─── 元の写真（折りたたみ） ──────────────────────────────────
function OriginalImages({ images }: { images: string[] }) {
  const [open, setOpen] = useState(false);
  const urls = images.filter((img) => img.startsWith("http"));
  const photos = images.filter((img) => !img.startsWith("http"));
  const label = urls.length > 0 && photos.length === 0
    ? "参照元URL"
    : `元の写真 (${photos.length}枚)`;

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="press-effect w-full flex items-center justify-between py-2"
      >
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--text-secondary)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {urls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs break-all"
              style={{ background: "var(--bg)", color: "var(--accent)", border: "1px solid var(--border)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              {url}
            </a>
          ))}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((img, i) => (
                <img key={i} src={img} alt={`元ページ${i + 1}`} className="w-full rounded-xl" />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
