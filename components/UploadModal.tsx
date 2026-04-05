"use client";

import { useState, useRef, useEffect } from "react";
import { detectBlur } from "@/lib/blur-detection";
import { cropPhoto, resizeImage } from "@/lib/crop-photo";
import { saveRecipe } from "@/lib/storage";
import { Block } from "@/types/block";
import { GENRES, Genre } from "@/types/recipe";
import BlockEditor from "./BlockEditor";

const BLUR_THRESHOLD = 50;
const MAX_PAGES = 7;

type ModalStep = "select" | "processing" | "edit" | "confirm" | "done";

interface PageEntry {
  base64: string;
  blurScore: number;
}

interface UploadModalProps {
  onClose: () => void;
  onSaved: () => void;
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

export default function UploadModal({ onClose, onSaved }: UploadModalProps) {
  const [step, setStep] = useState<ModalStep>("select");
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [blurError, setBlurError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  // edit step state
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [genre, setGenre] = useState<Genre | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);

  const page1InputRef = useRef<HTMLInputElement>(null);
  const addPageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function readAndCheck(file: File): Promise<PageEntry | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const raw = e.target?.result as string;
        const resized = await resizeImage(raw, 1600);
        const img = new Image();
        img.onload = () => {
          const score = detectBlur(img);
          resolve(score < BLUR_THRESHOLD ? null : { base64: resized, blurScore: score });
        };
        img.src = resized;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePage1(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBlurError(null);
    setError(null);

    const entry = await readAndCheck(file);
    if (!entry) {
      setBlurError("写真がぼやけています。明るい場所でカメラを固定して撮り直してください。");
      return;
    }
    setPages([entry]);
  }

  async function handleAddPage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBlurError(null);
    e.target.value = "";

    const entry = await readAndCheck(file);
    if (!entry) {
      setBlurError("写真がぼやけています。撮り直してください。");
      return;
    }
    setPages((prev) => [...prev, entry]);
  }

  function removePage(index: number) {
    setPages((prev) => prev.filter((_, i) => i !== index));
    setBlurError(null);
  }

  async function handleExtract() {
    if (pages.length === 0) return;
    setStep("processing");
    setError(null);
    setProgress("AIが写真を解析中...");

    try {
      const res = await fetch("/api/extract-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: pages.map((p) => p.base64) }),
      });

      setProgress("レシピを整理中...");

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "エラーが発生しました");
      }

      const extracted = await res.json();

      setProgress("料理写真を切り抜き中...");

      // Build blocks
      const newBlocks: Block[] = [];

      // Photo blocks: crop food photos detected by Gemini
      if (Array.isArray(extracted.foodPhotos) && extracted.foodPhotos.length > 0) {
        for (const photo of extracted.foodPhotos) {
          const pageIdx = photo.pageIndex ?? 0;
          const page = pages[pageIdx];
          if (!page) continue;
          try {
            const cropped = await cropPhoto(page.base64, photo.region);
            newBlocks.push({ id: crypto.randomUUID(), type: "photo", base64: cropped });
          } catch {
            // If cropping fails, use the whole page
            newBlocks.push({ id: crypto.randomUUID(), type: "photo", base64: page.base64 });
          }
        }
      }

      // Ingredients block
      if (Array.isArray(extracted.ingredients) && extracted.ingredients.length > 0) {
        newBlocks.push({
          id: crypto.randomUUID(),
          type: "ingredients",
          items: extracted.ingredients,
        });
      }

      // Step blocks
      if (Array.isArray(extracted.steps)) {
        for (const step of extracted.steps) {
          newBlocks.push({ id: crypto.randomUUID(), type: "step", text: step });
        }
      }

      setTitle(extracted.title ?? "不明な料理");
      setGenre((GENRES.includes(extracted.genre) ? extracted.genre : null) as Genre | null);
      setBlocks(newBlocks);
      setStep("edit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setStep("select");
    }
  }

  function handleConfirm() {
    setStep("confirm");
  }

  async function handleSave() {
    await saveRecipe({
      id: crypto.randomUUID(),
      title,
      genre,
      blocks,
      originalImages: pages.map((p) => p.base64),
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
        {step !== "done" && <StepDots current={dotIndex} />}

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

              {/* Blur error */}
              {blurError && (
                <div
                  className="mb-4 px-4 py-3 rounded-xl"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
                >
                  <p className="font-semibold text-sm mb-0.5" style={{ color: "#DC2626" }}>
                    写真がぼやけています
                  </p>
                  <p className="text-xs" style={{ color: "#EF4444" }}>
                    {blurError}
                  </p>
                </div>
              )}

              {pages.length === 0 ? (
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
                      料理本を撮影
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      テキストが含まれるページを撮影してください
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
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {pages.map((page, i) => (
                      <div key={i} className="relative">
                        <div className="rounded-xl overflow-hidden bg-gray-100 aspect-[3/4]">
                          <img
                            src={page.base64}
                            alt={`${i + 1}枚目`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => removePage(i)}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                          style={{ background: "rgba(26,23,18,0.5)", color: "#fff" }}
                        >
                          ✕
                        </button>
                        <p
                          className="text-xs mt-1 font-medium text-center"
                          style={{ color: "#16A34A" }}
                        >
                          ✓ {page.blurScore}%
                        </p>
                      </div>
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

                  {error && (
                    <div
                      className="mb-4 px-3 py-2.5 rounded-xl text-sm"
                      style={{ background: "#FEF2F2", color: "#DC2626" }}
                    >
                      {error}
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
                capture="environment"
                className="hidden"
                onChange={handlePage1}
              />
              <input
                ref={addPageInputRef}
                type="file"
                accept="image/*"
                capture="environment"
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
                      borderBottom: "1.5px solid var(--accent)",
                      fontSize: 16,
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingTitle(true)}
                    className="w-full text-left flex items-center justify-between rounded-xl px-4 py-3"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid #E8E4DF",
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
                  className="press-effect w-full py-3.5 font-semibold text-base rounded-xl"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  確認する →
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════
              STEP: CONFIRM
          ════════════════════════════════ */}
          {step === "confirm" && (
            <div className="pb-10">
              <div className="px-5 flex items-center justify-between mb-4 pt-2">
                <button
                  onClick={() => setStep("edit")}
                  className="text-sm font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  ← 修正する
                </button>
                <h2
                  className="text-base font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  最終確認
                </h2>
                <div className="w-16" />
              </div>

              <div className="px-5">
                {/* Preview card */}
                <div
                  className="rounded-2xl overflow-hidden mb-5"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid #E8E4DF",
                  }}
                >
                  <div
                    className="w-full overflow-hidden"
                    style={{ height: 160, background: "var(--accent-light)" }}
                  >
                    {previewPhoto ? (
                      <img
                        src={previewPhoto.base64}
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: "var(--accent-light)" }}
                      >
                        <span
                          className="text-xs font-semibold tracking-widest uppercase"
                          style={{ color: "var(--accent)", opacity: 0.5 }}
                        >
                          No Photo
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3">
                    <h3
                      className="text-base font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {title}
                    </h3>
                    <div className="flex gap-3 mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <span>{blocks.filter((b) => b.type === "photo").length}枚の写真</span>
                      <span>·</span>
                      <span>{blocks.filter((b) => b.type === "step").length}ステップ</span>
                      <span>·</span>
                      <span>材料{blocks.find((b) => b.type === "ingredients") ? "あり" : "なし"}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  className="press-effect w-full py-3.5 font-semibold text-base rounded-xl"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  保存する
                </button>
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
