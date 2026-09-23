"use client";

import { useEffect } from "react";
import { isChunkLoadError, reloadOnce } from "@/lib/chunk-error";

/**
 * Reactのレンダリング中に投げられたエラーをここで受け取る。
 * デプロイ直後の古いチャンク参照エラーはwindowのerrorイベントとして
 * 表面化しない場合があるため、こちらでも同じ判定でリロードを試みる。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError = isChunkLoadError(error.message ?? "");

  useEffect(() => {
    if (isChunkError) reloadOnce();
  }, [isChunkError]);

  if (isChunkError) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 24,
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p style={{ marginBottom: 16, color: "#1A1712" }}>問題が発生しました。</p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          borderRadius: 12,
          background: "#D4601F",
          color: "#fff",
          border: "none",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        再試行する
      </button>
    </div>
  );
}
