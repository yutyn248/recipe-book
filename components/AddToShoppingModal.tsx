"use client";

import { useState } from "react";
import { addToShoppingList, getShoppingItems } from "@/lib/shopping";

interface Props {
  recipeId: string;
  recipeTitle: string;
  ingredients: string[];
  onClose: () => void;
  onAdded: () => void;
}

export default function AddToShoppingModal({ recipeId, recipeTitle, ingredients, onClose, onAdded }: Props) {
  // すでにリストに入っている材料を取得
  const alreadyAdded = new Set(
    getShoppingItems()
      .filter((i) => i.recipeId === recipeId)
      .map((i) => i.ingredient)
  );

  const newIngredients = ingredients.filter((i) => !alreadyAdded.has(i));
  const [selected, setSelected] = useState<Set<string>>(new Set(newIngredients));

  function toggle(item: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(item) ? next.delete(item) : next.add(item);
      return next;
    });
  }

  function handleAdd() {
    const items = newIngredients.filter((i) => selected.has(i));
    if (items.length === 0) { onClose(); return; }
    addToShoppingList(recipeId, recipeTitle, items);
    onAdded();
  }

  const hasNew = newIngredients.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        className="w-full rounded-t-3xl flex flex-col"
        style={{ background: "var(--bg)", maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex-shrink-0 pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-2 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-black" style={{ color: "var(--text-primary)" }}>買い物リストに追加</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{recipeTitle}</p>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!hasNew && (
            <p className="text-sm text-center py-4" style={{ color: "var(--text-secondary)" }}>
              すべての材料はすでにリストに追加済みです
            </p>
          )}
          <div className="space-y-1">
            {/* 追加済み材料（グレー表示） */}
            {ingredients.filter((i) => alreadyAdded.has(i)).map((item) => (
              <div
                key={item}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl"
                style={{ background: "var(--surface)", opacity: 0.5 }}
              >
                <div className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "var(--accent)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-sm flex-1" style={{ color: "var(--text-secondary)", wordBreak: "break-word" }}>{item}</span>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--text-secondary)" }}>追加済み</span>
              </div>
            ))}

            {/* 未追加材料（選択可能） */}
            {newIngredients.map((item) => {
              const checked = selected.has(item);
              return (
                <button
                  key={item}
                  onClick={() => toggle(item)}
                  className="press-effect w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left"
                  style={{ background: checked ? "var(--accent-light)" : "var(--surface)" }}
                >
                  <div
                    className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center"
                    style={{ background: checked ? "var(--accent)" : "transparent", border: checked ? "none" : "1.5px solid var(--border)" }}
                  >
                    {checked && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm flex-1" style={{ color: checked ? "var(--text-primary)" : "var(--text-secondary)", wordBreak: "break-word" }}>
                    {item}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 pt-3 pb-8 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          {hasNew && (
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setSelected(new Set(newIngredients))}
                className="text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
              >
                すべて選択
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
              >
                すべて解除
              </button>
            </div>
          )}
          <button
            onClick={hasNew ? handleAdd : onClose}
            disabled={hasNew && selected.size === 0}
            className="press-effect w-full py-3.5 rounded-2xl text-sm font-semibold"
            style={{
              background: !hasNew || selected.size > 0 ? "var(--accent)" : "var(--border)",
              color: !hasNew || selected.size > 0 ? "#fff" : "var(--text-secondary)",
            }}
          >
            {!hasNew ? "閉じる" : selected.size > 0 ? `${selected.size}品をリストに追加` : "項目を選択してください"}
          </button>
          {hasNew && (
            <button
              onClick={onClose}
              className="press-effect w-full py-3 rounded-2xl text-sm font-medium"
              style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
            >
              キャンセル
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
