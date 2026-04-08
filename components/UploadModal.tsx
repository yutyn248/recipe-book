"use client";

import { useState, useRef, useEffect } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { detectBlur, detectBrightness } from "@/lib/blur-detection";
import { cropPhoto, resizeWithOrientation } from "@/lib/crop-photo";
import { saveRecipe } from "@/lib/storage";
import { Block } from "@/types/block";
import { GENRES, Genre } from "@/types/recipe";
import BlockEditor from "./BlockEditor";

const BLUR_THRESHOLD = 50;
const BRIGHTNESS_THRESHOLD = 40; // 0–255スケール
const MAX_PAGES = 12;

type ModalStep = "select" | "processing" | "edit" | "confirm" | "multi-confirm" | "done";

interface ExtractedRecipe {
  title: string;
  genre: Genre | null;
  ingredients: string[];
  steps: string[];
}

interface PageEntry {
  id: string;
  base64: string;
  blurScore: number;
}

interface UploadModalProps {
  onClose: () => void;
  onSaved: () => void;
  existingTitles: string[];
}

// ドラッグ可能なページサムネイル
function SortablePageThumb({
  page,
  index,
  onRemove,
}: {
  page: PageEntry;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
      className="relative"
    >
      <div className="rounded-xl overflow-hidden bg-gray-100 aspect-[3/4]">
        <img src={page.base64} alt={`${index + 1}枚目`} className="w-full h-full object-cover" />
      </div>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs"
        style={{ background: "rgba(26,23,18,0.5)", color: "#fff" }}
      >
        ✕
      </button>
      <p className="text-xs mt-1 font-medium text-center" style={{ color: "#16A34A" }}>
        ✓ {page.blurScore}%
      </p>
    </div>
  );
}

// Step dot indicator: 4 dots
function StepDots({ current }: { current: number }) {
  // current: 0=select, 1=processing/edit, 2=edit, 3=confirm
  const stepIndex = current;
  return (
    <div className="flex items-center gap-1.5 justify-center py-2">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="rounded-full transition-all"
          style={{
            width: i === stepIndex ? 20 : 6,
            height: 6,
            background: i <= stepIndex ? "var(--accent)" : "#E8E4DF",
          }}
        />
      ))}
    </div>
  );
}

export default function UploadModal({ onClose, onSaved, existingTitles }: UploadModalProps) {
  const isDuplicate = (t: string) =>
    existingTitles.some((e) => e.trim() === t.trim());
  const [step, setStep] = useState<ModalStep>("select");
  const [inputMode, setInputMode] = useState<"photo" | "url">("photo");
  const [urlInput, setUrlInput] = useState("");
  const [urlSource, setUrlSource] = useState<"ai" | "json-ld" | null>(null);
  const [extractedUrl, setExtractedUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [pendingBatch, setPendingBatch] = useState<{ entries: PageEntry[]; warning: string; appendToExisting: boolean } | null>(null);
  const [blurError, setBlurError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  // edit step state (single recipe)
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [genre, setGenre] = useState<Genre | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);

  // multi-recipe state
  const [multiRecipes, setMultiRecipes] = useState<ExtractedRecipe[]>([]);

  const page1InputRef = useRef<HTMLInputElement>(null);
  const addPageInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function readAndCheck(file: File): Promise<{ entry: PageEntry; warning: string | null }> {
    // EXIFの向きを考慮してリサイズ（横向き写真も正しく縦に補正される）
    const resized = await resizeWithOrientation(file, 1200);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const blurScore = detectBlur(img);
        const entry: PageEntry = { id: crypto.randomUUID(), base64: resized, blurScore };
        if (blurScore < BLUR_THRESHOLD) {
          resolve({ entry, warning: "写真がぼやけています。撮り直すと読み取り精度が上がりますが、このまま追加することもできます。" });
          return;
        }
        const brightness = detectBrightness(img);
        if (brightness < BRIGHTNESS_THRESHOLD) {
          resolve({ entry, warning: "写真が暗すぎます。明るい場所で撮り直すと精度が上がりますが、このまま追加することもできます。" });
          return;
        }
        resolve({ entry, warning: null });
      };
      img.src = resized;
    });
  }

  async function processFiles(files: File[], appendToExisting: boolean) {
    const goodEntries: PageEntry[] = [];
    const badEntries: PageEntry[] = [];
    let firstWarning = "";

    for (const file of files) {
      const { entry, warning } = await readAndCheck(file);

      // 重複チェック（既存ページ＋今回追加済み分と比較）
      const allSoFar = [...(appendToExisting ? pages : []), ...goodEntries];
      if (allSoFar.some((p) => p.base64 === entry.base64)) continue;

      // MAX_PAGES 超過チェック
      if (allSoFar.length + goodEntries.length + badEntries.length >= MAX_PAGES) break;

      if (warning) {
        badEntries.push(entry);
        if (!firstWarning) firstWarning = warning;
      } else {
        goodEntries.push(entry);
      }
    }

    // 品質OKなものをすぐ追加
    if (goodEntries.length > 0) {
      if (appendToExisting) {
        setPages((prev) => [...prev, ...goodEntries].slice(0, MAX_PAGES));
      } else {
        setPages(goodEntries.slice(0, MAX_PAGES));
      }
    }

    // 品質に問題があるものはユーザーに確認（good分は追加済みなので常にappend）
    if (badEntries.length > 0) {
      const warning = badEntries.length === 1
        ? firstWarning
        : `${badEntries.length}枚の写真の品質に問題があります。撮り直すと読み取り精度が上がりますが、このまま追加することもできます。`;
      setPendingBatch({ entries: badEntries, warning, appendToExisting: true });
    }

    // 重複のみで追加0件の場合
    if (goodEntries.length === 0 && badEntries.length === 0 && files.length > 0) {
      setBlurError("選択した写真は既に追加されています。");
    }
  }

  async function handlePage1(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBlurError(null);
    setPendingBatch(null);
    setError(null);
    await processFiles(files, false);
  }

  async function handleAddPage(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBlurError(null);
    setPendingBatch(null);
    e.target.value = "";
    await processFiles(files, true);
  }

  function confirmPendingBatch() {
    if (!pendingBatch) return;
    setPages((prev) => [...prev, ...pendingBatch.entries].slice(0, MAX_PAGES));
    setPendingBatch(null);
  }

  function removePage(id: string) {
    setPages((prev) => prev.filter((p) => p.id !== id));
    setBlurError(null);
  }

  function handlePageDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages((prev) => {
        const oldIdx = prev.findIndex((p) => p.id === active.id);
        const newIdx = prev.findIndex((p) => p.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  async function handleExtract() {
    if (pages.length === 0) return;
    setStep("processing");
    setError(null);
    setErrorCode(null);
    setProgress("AIが写真を解析中...");

    try {
      const res = await fetch("/api/extract-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: pages.map((p) => p.base64) }),
      });

      setProgress("レシピを整理中...");

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        setErrorCode(data.errorCode ?? null);
        setStep("select");
        return;
      }

      const { recipes } = data as { recipes: ExtractedRecipe[] };

      if (recipes.length > 1) {
        setMultiRecipes(recipes.map((r) => ({
          ...r,
          genre: (GENRES.includes(r.genre as Genre) ? r.genre : null) as Genre | null,
        })));
        setStep("multi-confirm");
      } else {
        const extracted = recipes[0] ?? {};
        const newBlocks: Block[] = [];
        if (Array.isArray(extracted.ingredients) && extracted.ingredients.length > 0) {
          newBlocks.push({ id: crypto.randomUUID(), type: "ingredients", items: extracted.ingredients });
        }
        if (Array.isArray(extracted.steps)) {
          for (const s of extracted.steps) {
            newBlocks.push({ id: crypto.randomUUID(), type: "step", text: s });
          }
        }
        setTitle(extracted.title ?? "不明な料理");
        setGenre((GENRES.includes(extracted.genre as Genre) ? extracted.genre : null) as Genre | null);
        setBlocks(newBlocks);
        setStep("edit");
      }
    } catch (err) {
      // ネットワーク自体が繋がらない場合など
      setError("サーバーへの接続に失敗しました。ネットワークを確認してください。");
      setErrorCode("NETWORK_ERROR");
      setStep("select");
    }
  }

  async function handleExtractUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setStep("processing");
    setError(null);
    setErrorCode(null);
    setProgress("レシピサイトを読み込み中...");

    try {
      const res = await fetch("/api/extract-recipe-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      setProgress("レシピを整理中...");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        setErrorCode(data.errorCode ?? null);
        setStep("select");
        return;
      }

      const { recipes, source } = data as { recipes: ExtractedRecipe[]; source?: "ai" | "json-ld" };
      setUrlSource(source ?? "ai");
      setExtractedUrl(trimmed);

      if (recipes.length > 1) {
        setMultiRecipes(recipes.map((r) => ({
          ...r,
          genre: (GENRES.includes(r.genre as Genre) ? r.genre : null) as Genre | null,
        })));
        setStep("multi-confirm");
      } else {
        const extracted = recipes[0] ?? {};
        const newBlocks: Block[] = [];
        if (Array.isArray(extracted.ingredients) && extracted.ingredients.length > 0) {
          newBlocks.push({ id: crypto.randomUUID(), type: "ingredients", items: extracted.ingredients });
        }
        if (Array.isArray(extracted.steps)) {
          for (const s of extracted.steps) {
            newBlocks.push({ id: crypto.randomUUID(), type: "step", text: s });
          }
        }
        setTitle(extracted.title ?? "不明な料理");
        setGenre((GENRES.includes(extracted.genre as Genre) ? extracted.genre : null) as Genre | null);
        setBlocks(newBlocks);
        setStep("edit");
      }
    } catch {
      setError("サーバーへの接続に失敗しました。ネットワークを確認してください。");
      setErrorCode("NETWORK_ERROR");
      setStep("select");
    }
  }

  function handleConfirm() {
    setStep("confirm");
  }

  async function handleSave() {
    if (isDuplicate(title)) {
      setError(`「${title.trim()}」は既に登録されています。別の名前にしてください。`);
      return;
    }
    await saveRecipe({
      id: crypto.randomUUID(),
      title,
      genre,
      blocks,
      // URL経由の場合はURLをevidenceとして保存、写真の場合はbase64を保存
      originalImages: extractedUrl ? [extractedUrl] : pages.map((p) => p.base64),
      createdAt: new Date().toISOString(),
    });
    setStep("done");
    setTimeout(() => onSaved(), 800);
  }

  // ─── Computed preview photo for confirm screen ───────────────
  const previewPhoto = blocks.find((b) => b.type === "photo") as
    | { type: "photo"; base64: string }
    | undefined;

  // Map step to dot index
  const dotIndex = step === "select" ? 0 : step === "processing" ? 1 : step === "edit" ? 2 : 3;
  const showDots = step !== "done" && step !== "multi-confirm";

  return (
    <div className="fixed inset-0 z-50">
      {/* Dark scrim */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "rgba(26,23,18,0.65)" }}
        onClick={step === "select" ? onClose : undefined}
      />

      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
        style={{ maxHeight: "94vh", background: "var(--surface)" }}
      >
        {/* Pull handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: "#E0DBD5" }} />
        </div>

        {/* Step dots */}
        {showDots && <StepDots current={dotIndex} />}

        <div
          className="overflow-y-auto hide-scrollbar"
          style={{ maxHeight: "calc(94vh - 40px)" }}
        >

          {/* ════════════════════════════════
              STEP: SELECT
          ════════════════════════════════ */}
          {step === "select" && (
            <div className="px-5 pb-10">
              <div className="flex items-center justify-between mb-5 pt-2">
                <h2
                  className="text-xl font-black"
                  style={{ color: "var(--text-primary)" }}
                >
                  レシピを追加
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ background: "#F0EDE8", color: "var(--text-secondary)" }}
                >
                  ✕
                </button>
              </div>

              {/* 入力モード切替タブ */}
              <div
                className="flex rounded-xl mb-4 p-1"
                style={{ background: "var(--bg)" }}
              >
                {(["photo", "url"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setInputMode(mode); setBlurError(null); setError(null); }}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={inputMode === mode
                      ? { background: "var(--surface)", color: "var(--text-primary)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                      : { color: "var(--text-secondary)" }
                    }
                  >
                    {mode === "photo" ? "写真" : "URLから読み込む"}
                  </button>
                ))}
              </div>

              {/* 品質警告（ソフト）：撮り直しを促しつつ強制はしない */}
              {pendingBatch && (
                <div
                  className="mb-4 px-4 py-3 rounded-xl"
                  style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
                >
                  <p className="font-semibold text-sm mb-1" style={{ color: "#92400E" }}>
                    写真の品質を確認してください
                  </p>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: "#B45309" }}>
                    {pendingBatch.warning}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPendingBatch(null)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: "#FEF3C7", color: "#92400E" }}
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={confirmPendingBatch}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: "#92400E", color: "#fff" }}
                    >
                      このまま追加
                    </button>
                  </div>
                </div>
              )}

              {/* 重複エラー */}
              {blurError && !pendingBatch && (
                <div
                  className="mb-4 px-4 py-3 rounded-xl"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
                >
                  <p className="font-semibold text-sm mb-0.5" style={{ color: "#DC2626" }}>
                    写真を確認してください
                  </p>
                  <p className="text-xs" style={{ color: "#EF4444" }}>
                    {blurError}
                  </p>
                </div>
              )}

              {inputMode === "url" ? (
                /* ── URL モード ── */
                <div>
                  <p className="text-xs mb-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    レシピサイトのURLを貼り付けると自動でレシピを読み込みます。
                  </p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleExtractUrl()}
                      placeholder="https://..."
                      className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
                      style={{
                        background: "var(--bg)",
                        border: "1.5px solid #E0DBD5",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  {error && (
                    <div
                      className="mb-4 px-4 py-3 rounded-xl"
                      style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
                    >
                      <p className="font-semibold text-sm mb-1" style={{ color: "#DC2626" }}>
                        読み込みに失敗しました
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: "#EF4444" }}>{error}</p>
                      {errorCode && (
                        <p className="text-xs mt-1.5 font-mono" style={{ color: "#FCA5A5" }}>
                          エラーコード: {errorCode}
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleExtractUrl}
                    disabled={!urlInput.trim()}
                    className="press-effect w-full py-3.5 font-semibold text-base rounded-xl"
                    style={{
                      background: urlInput.trim() ? "var(--accent)" : "var(--border)",
                      color: urlInput.trim() ? "#fff" : "var(--text-secondary)",
                    }}
                  >
                    読み込む →
                  </button>
                </div>
              ) : pages.length === 0 ? (
                /* ── 写真モード（未選択） ── */
                <button
                  onClick={() => page1InputRef.current?.click()}
                  className="press-effect w-full rounded-2xl p-8 flex flex-col items-center gap-3"
                  style={{
                    background: "var(--bg)",
                    border: "1.5px dashed #D5CFC8",
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "var(--accent-light)" }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      写真を選ぶ・撮影する
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      アルバムから選ぶか、カメラで撮影してください
                    </p>
                  </div>
                </button>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p
                      className="text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      アップロード済み
                    </p>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {pages.length}/{MAX_PAGES}枚
                    </span>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePageDragEnd}>
                    <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {pages.map((page, i) => (
                          <SortablePageThumb
                            key={page.id}
                            page={page}
                            index={i}
                            onRemove={() => removePage(page.id)}
                          />
                        ))}
                        {pages.length < MAX_PAGES && (
                          <button
                            onClick={() => addPageInputRef.current?.click()}
                            className="press-effect rounded-xl aspect-[3/4] flex flex-col items-center justify-center gap-1"
                            style={{
                              border: "1.5px dashed #D5CFC8",
                              background: "var(--bg)",
                            }}
                          >
                            <span className="text-lg" style={{ color: "var(--accent)" }}>＋</span>
                            <span
                              className="text-xs font-semibold text-center"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              ページを
                              <br />
                              追加
                            </span>
                          </button>
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                  {pages.length >= 2 && (
                    <p className="text-xs mb-3 px-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      長押しでページの順番を並び替えできます。見開きページは片面ずつ撮影すると精度が上がります。
                    </p>
                  )}
                  {pages.length === 1 && (
                    <p className="text-xs mb-3 px-1" style={{ color: "var(--text-secondary)" }}>
                      手書きレシピは文字が鮮明に写るように撮影してください。
                    </p>
                  )}

                  {error && (
                    <div
                      className="mb-4 px-4 py-3 rounded-xl"
                      style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
                    >
                      <p className="font-semibold text-sm mb-1" style={{ color: "#DC2626" }}>
                        読み取りに失敗しました
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: "#EF4444" }}>
                        {error}
                      </p>
                      {errorCode && (
                        <p className="text-xs mt-1.5 font-mono" style={{ color: "#FCA5A5" }}>
                          エラーコード: {errorCode}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleExtract}
                    className="press-effect w-full py-3.5 font-semibold text-base rounded-xl"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    AIで読み取る →
                  </button>
                </>
              )}

              <input
                ref={page1InputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePage1}
              />
              <input
                ref={addPageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAddPage}
              />
            </div>
          )}

          {/* ════════════════════════════════
              STEP: PROCESSING
          ════════════════════════════════ */}
          {step === "processing" && (
            <div className="px-5 py-20 flex flex-col items-center">
              <div className="spinner mb-8" />
              <h2
                className="text-lg font-bold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                解析中
              </h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {progress}
              </p>
            </div>
          )}

          {/* ════════════════════════════════
              STEP: EDIT
          ════════════════════════════════ */}
          {step === "edit" && (
            <div className="pb-10">
              <div className="px-5 flex items-center justify-between mb-4 pt-2">
                <button
                  onClick={() => setStep("select")}
                  className="text-sm font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  ← 戻る
                </button>
                <h2
                  className="text-base font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  内容を確認・修正
                </h2>
                <div className="w-12" />
              </div>

              {/* AI解析の場合のみ注意バナー */}
              {urlSource === "ai" && (
                <div
                  className="mx-5 mb-4 px-4 py-3 rounded-xl"
                  style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
                >
                  <p className="text-xs font-semibold mb-0.5" style={{ color: "#92400E" }}>
                    内容を確認してください
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#B45309" }}>
                    AIによる解析のため、材料の分量や手順が一部不正確な場合があります。保存前に内容を確認・修正してください。
                  </p>
                </div>
              )}

              {/* Title edit */}
              <div className="px-5 mb-4">
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  料理名
                </p>
                {editingTitle ? (
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                    className="w-full font-black outline-none pb-1 bg-transparent"
                    style={{
                      color: "var(--text-primary)",
                      borderBottom: `1.5px solid ${isDuplicate(title) ? "#DC2626" : "var(--accent)"}`,
                      fontSize: 16,
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingTitle(true)}
                    className="w-full text-left flex items-center justify-between rounded-xl px-4 py-3"
                    style={{
                      background: "var(--bg)",
                      border: `1px solid ${isDuplicate(title) ? "#FECACA" : "#E8E4DF"}`,
                    }}
                  >
                    <span
                      className="text-base font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {title}
                    </span>
                    <span className="text-xs ml-2" style={{ color: "var(--text-secondary)" }}>
                      編集
                    </span>
                  </button>
                )}
                {isDuplicate(title) && (
                  <p className="text-xs mt-1.5 font-medium" style={{ color: "#DC2626" }}>
                    「{title.trim()}」は既に登録されています。タップして名前を変更してください。
                  </p>
                )}
              </div>

              {/* Genre select */}
              <div className="px-5 mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-secondary)" }}>
                  ジャンル
                </p>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGenre(genre === g ? null : g)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                      style={genre === g
                        ? { background: "var(--accent)", color: "#fff" }
                        : { background: "var(--bg)", color: "var(--text-secondary)", border: "1px solid #E0DBD5" }
                      }
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Block editor */}
              <div className="px-5 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    ブロック
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    長押しで並び替え
                  </p>
                </div>
                <BlockEditor blocks={blocks} onChange={setBlocks} />
              </div>

              <div className="px-5">
                <button
                  onClick={handleConfirm}
                  disabled={isDuplicate(title)}
                  className="press-effect w-full py-3.5 font-semibold text-base rounded-xl"
                  style={{
                    background: isDuplicate(title) ? "var(--border)" : "var(--accent)",
                    color: isDuplicate(title) ? "var(--text-secondary)" : "#fff",
                  }}
                >
                  確認する →
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════
              STEP: MULTI-CONFIRM
          ════════════════════════════════ */}
          {step === "multi-confirm" && (
            <div className="pb-6">
              <div className="px-5 flex items-center justify-between pt-2 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  {multiRecipes.length}つのレシピを確認
                </h2>
              </div>

              <div className="px-5 pt-4 space-y-4">
                {multiRecipes.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-2xl overflow-hidden card-shadow"
                    style={{ background: "var(--surface)" }}
                  >
                    {/* Recipe header */}
                    <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                      <div className="flex-1">
                        <h3 className="font-black text-base leading-tight" style={{ color: "var(--text-primary)" }}>{r.title || "不明な料理"}</h3>
                        {r.genre && (
                          <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                            {r.genre}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setMultiRecipes((prev) => prev.filter((_, idx) => idx !== i))}
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs"
                        style={{ background: "#FEF2F2", color: "#DC2626" }}
                      >✕</button>
                    </div>

                    {/* Ingredients */}
                    {r.ingredients.length > 0 && (
                      <div className="px-4 py-3" style={{ borderBottom: r.steps.length > 0 ? "1px solid var(--border)" : undefined }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>材料 {r.ingredients.length}品</p>
                        <div className="space-y-1">
                          {r.ingredients.slice(0, 5).map((item, j) => (
                            <div key={j} className="flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
                              <span className="text-xs" style={{ color: "var(--text-primary)" }}>{item}</span>
                            </div>
                          ))}
                          {r.ingredients.length > 5 && (
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>他 {r.ingredients.length - 5}品...</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Steps count */}
                    {r.steps.length > 0 && (
                      <div className="px-4 py-3">
                        <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>手順 {r.steps.length}ステップ</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="px-5 pt-5 space-y-2.5">
                <button
                  onClick={async () => {
                    const dupes = multiRecipes.map((r) => r.title).filter((t) => isDuplicate(t));
                    if (dupes.length > 0) {
                      setError(`「${dupes.join("」「")}」は既に登録されています。`);
                      return;
                    }
                    for (const r of multiRecipes) {
                      const blocks: Block[] = [];
                      if (r.ingredients.length > 0) {
                        blocks.push({ id: crypto.randomUUID(), type: "ingredients", items: r.ingredients });
                      }
                      for (const s of r.steps) {
                        blocks.push({ id: crypto.randomUUID(), type: "step", text: s });
                      }
                      await saveRecipe({
                        id: crypto.randomUUID(),
                        title: r.title || "不明な料理",
                        genre: r.genre,
                        blocks,
                        originalImages: extractedUrl ? [extractedUrl] : pages.map((p) => p.base64),
                        createdAt: new Date().toISOString(),
                      });
                    }
                    setStep("done");
                    setTimeout(() => onSaved(), 800);
                  }}
                  className="press-effect w-full py-3.5 font-semibold text-base rounded-2xl"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  {multiRecipes.length}つまとめて保存
                </button>
                <button
                  onClick={() => { setPages([]); setMultiRecipes([]); setStep("select"); }}
                  className="press-effect w-full py-3 font-semibold text-sm rounded-2xl"
                  style={{ background: "var(--border)", color: "var(--text-secondary)" }}
                >
                  撮り直す
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════
              STEP: CONFIRM
          ════════════════════════════════ */}
          {step === "confirm" && (
            <div className="pb-6">
              {/* Header */}
              <div className="px-5 flex items-center justify-between pt-2 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>内容を確認</h2>
              </div>

              {/* Full recipe preview */}
              <div className="px-5 pt-4 space-y-5">

                {/* Title + genre */}
                <div>
                  <div className="flex items-start gap-2 justify-between">
                    <h3 className="text-xl font-black leading-tight flex-1" style={{ color: "var(--text-primary)" }}>{title}</h3>
                    {genre && (
                      <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full mt-0.5" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                        {genre}
                      </span>
                    )}
                  </div>
                </div>

                {/* Photo */}
                {previewPhoto && (
                  <div className="rounded-2xl overflow-hidden card-shadow" style={{ aspectRatio: "4/3" }}>
                    <img src={previewPhoto.base64} alt={title} className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Ingredients */}
                {(() => {
                  const ing = blocks.find((b) => b.type === "ingredients") as { type: "ingredients"; items: string[] } | undefined;
                  if (!ing) return null;
                  return (
                    <div>
                      <h4 className="text-sm font-black mb-2" style={{ color: "var(--text-primary)" }}>材料</h4>
                      <div className="rounded-2xl overflow-hidden card-shadow" style={{ background: "var(--surface)" }}>
                        {ing.items.map((item, i) => (
                          <div key={i} className="flex items-center px-4 py-2.5" style={{ borderBottom: i < ing.items.length - 1 ? "1px solid var(--border)" : undefined }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-3" style={{ background: "var(--accent)" }} />
                            <span className="text-sm" style={{ color: "var(--text-primary)" }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Steps */}
                {(() => {
                  const steps = blocks.filter((b) => b.type === "step") as { id: string; type: "step"; text: string }[];
                  if (steps.length === 0) return null;
                  return (
                    <div>
                      <h4 className="text-sm font-black mb-2" style={{ color: "var(--text-primary)" }}>手順</h4>
                      <div className="space-y-2">
                        {steps.map((s, i) => (
                          <div key={s.id} className="flex gap-3 items-start px-4 py-3 rounded-2xl card-shadow" style={{ background: "var(--surface)" }}>
                            <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-xs" style={{ background: "var(--accent)", color: "#fff" }}>
                              {i + 1}
                            </div>
                            <p className="text-sm leading-relaxed flex-1 mt-0.5" style={{ color: "var(--text-primary)" }}>{s.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Action buttons */}
              <div className="px-5 pt-6 space-y-2.5">
                <button
                  onClick={handleSave}
                  className="press-effect w-full py-3.5 font-semibold text-base rounded-2xl"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  保存する
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setStep("edit")}
                    className="press-effect py-3 font-semibold text-sm rounded-2xl"
                    style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                  >
                    自分で編集
                  </button>
                  <button
                    onClick={() => { setPages([]); setBlocks([]); setStep("select"); }}
                    className="press-effect py-3 font-semibold text-sm rounded-2xl"
                    style={{ background: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    撮り直す
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════
              STEP: DONE
          ════════════════════════════════ */}
          {step === "done" && (
            <div className="px-5 py-20 flex flex-col items-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: "var(--accent-light)" }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: "var(--accent)" }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2
                className="text-xl font-black mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                保存完了
              </h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                レシピを追加しました
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
