"use client";

import { useEffect } from "react";
import { isChunkLoadError, reloadOnce } from "@/lib/chunk-error";

/**
 * デプロイ直後など、開いたままのタブが古いJSチャンクを参照して
 * 読み込みに失敗する（ChunkLoadError等）場合に自動でリロードする。
 * window単位で発生するエラー（scriptタグの読み込み失敗など）を捕捉する。
 * Reactのレンダリング中に発生するものは app/error.tsx 側で捕捉する。
 */
export default function ChunkErrorReload() {
  useEffect(() => {
    function onError(e: ErrorEvent) {
      if (isChunkLoadError(e.message ?? "")) reloadOnce();
    }
    function onRejection(e: PromiseRejectionEvent) {
      const message = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
      if (isChunkLoadError(message)) reloadOnce();
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
