"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingItem,
  getShoppingItems,
  toggleShoppingItem,
  removeCheckedItems,
  removeRecipeFromList,
  addManualItem,
} from "@/lib/shopping";

export default function ShoppingPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ recipeId: string; recipeTitle: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [manualInput, setManualInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);

  function toggleCollapse(recipeId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(recipeId) ? next.delete(recipeId) : next.add(recipeId);
      return next;
    });
  }

  useEffect(() => {
    setItems(getShoppingItems());
  }, []);

  function refresh() {
    setItems(getShoppingItems());
  }

  function handleToggle(id: string) {
    toggleShoppingItem(id);
    refresh();
  }

  function handleRemoveChecked() {
    removeCheckedItems();
    refresh();
  }

  function handleRemoveRecipe(recipeId: string) {
    removeRecipeFromList(recipeId);
    setConfirmDelete(null);
    refresh();
  }

  function handleManualAdd() {
    if (!manualInput.trim()) return;
    addManualItem(manualInput);
    setManualInput("");
    refresh();
  }

  // レシピごとにグループ化
  const groups = items.reduce<Record<string, { recipeTitle: string; items: ShoppingItem[] }>>((acc, item) => {
    if (!acc[item.recipeId]) acc[item.recipeId] = { recipeTitle: item.recipeTitle, items: [] };
    acc[item.recipeId].items.push(item);
    return acc;
  }, {});

  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;

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
        <h1 className="text-base font-black" style={{ color: "var(--text-primary)" }}>買い物リスト</h1>
        <div className="w-16" />
      </header>

      <main className="px-4 pt-4 pb-36">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6" style={{ background: "var(--accent-light)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <h2 className="text-lg font-black mb-2" style={{ color: "var(--text-primary)" }}>リストは空です</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              レシピページから材料を<br />買い物リストに追加できます
            </p>
            <button
              onClick={() => router.push("/")}
              className="press-effect mt-8 px-6 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              レシピを見る
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress */}
            <div className="px-1">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {checkedCount}/{totalCount} 品
                </span>
                {checkedCount > 0 && (
                  <button onClick={handleRemoveChecked} className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                    購入済みを消す
                  </button>
                )}
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%`, background: "var(--accent)" }}
                />
              </div>
            </div>

            {/* Recipe groups */}
            {Object.entries(groups).map(([recipeId, group]) => {
              const groupChecked = group.items.filter((i) => i.checked).length;
              const allChecked = groupChecked === group.items.length;
              const isCollapsed = collapsed.has(recipeId);
              return (
                <div key={recipeId} className="rounded-2xl overflow-hidden card-shadow" style={{ background: "var(--surface)" }}>
                  {/* ヘッダー：タップで折りたたみ */}
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ background: allChecked ? "#F0FDF4" : "var(--accent-light)" }}
                  >
                    <button
                      className="press-effect flex items-center gap-2 min-w-0 flex-1 text-left"
                      onClick={() => toggleCollapse(recipeId)}
                    >
                      {allChecked ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)", flexShrink: 0 }}>
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                        </svg>
                      )}
                      <span className="text-sm font-bold truncate" style={{ color: allChecked ? "#16A34A" : "var(--text-primary)" }}>
                        {group.recipeTitle}
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                        {groupChecked}/{group.items.length}
                      </span>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ color: "var(--text-secondary)", flexShrink: 0, transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ recipeId, recipeTitle: group.recipeTitle })}
                      className="flex-shrink-0 ml-2 text-xs px-2.5 py-1 rounded-lg"
                      style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-secondary)" }}
                    >
                      削除
                    </button>
                  </div>

                  {/* アイテム一覧：折りたたみ時は非表示 */}
                  {!isCollapsed && (
                    <div style={{ borderTop: "1px solid var(--border)" }}>
                      {group.items.map((item, idx) => (
                        <button
                          key={item.id}
                          onClick={() => handleToggle(item.id)}
                          className="press-effect w-full flex items-start gap-3 px-4 py-3 text-left"
                          style={{ borderBottom: idx < group.items.length - 1 ? "1px solid var(--border)" : undefined }}
                        >
                          <div
                            className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5"
                            style={{ background: item.checked ? "var(--accent)" : "transparent", border: item.checked ? "none" : "1.5px solid var(--border)" }}
                          >
                            {item.checked && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <span
                            className="text-sm flex-1 leading-snug"
                            style={{
                              color: item.checked ? "var(--text-secondary)" : "var(--text-primary)",
                              textDecoration: item.checked ? "line-through" : undefined,
                              opacity: item.checked ? 0.6 : 1,
                              wordBreak: "break-word",
                            }}
                          >
                            {item.ingredient}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {checkedCount === totalCount && totalCount > 0 && (
              <div className="px-4 py-4 rounded-2xl text-center" style={{ background: "#F0FDF4" }}>
                <p className="text-sm font-bold mb-1" style={{ color: "#16A34A" }}>買い物完了！</p>
                <p className="text-xs" style={{ color: "#16A34A", opacity: 0.8 }}>お疲れ様でした 🛒</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* クイック追加バー */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pb-safe"
        style={{ background: "var(--bg)", borderTop: "1px solid var(--border)" }}
      >
        <div className="safe-bottom" />
        <div className="flex gap-2 py-3">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={(e) => { if (e.key === "Enter" && !isComposing) handleManualAdd(); }}
            placeholder="日用品・調理器具など自由に追加…"
            className="flex-1 outline-none px-4 py-2.5 rounded-2xl text-sm"
            style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <button
            onClick={handleManualAdd}
            disabled={!manualInput.trim()}
            className="press-effect flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg"
            style={{
              background: manualInput.trim() ? "var(--accent)" : "var(--border)",
              color: manualInput.trim() ? "#fff" : "var(--text-secondary)",
            }}
          >
            ＋
          </button>
        </div>
      </div>

      {/* 削除確認モーダル */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setConfirmDelete(null)}>
          <div className="w-full rounded-t-3xl px-5 pt-6 pb-10" style={{ background: "var(--bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border)" }} />
            <p className="text-base font-black mb-1" style={{ color: "var(--text-primary)" }}>リストから削除しますか？</p>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>「{confirmDelete.recipeTitle}」の材料をリストから削除します。</p>
            <button
              onClick={() => handleRemoveRecipe(confirmDelete.recipeId)}
              className="press-effect w-full py-3.5 rounded-2xl text-sm font-semibold mb-3"
              style={{ background: "#DC2626", color: "#fff" }}
            >
              削除する
            </button>
            <button
              onClick={() => setConfirmDelete(null)}
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
