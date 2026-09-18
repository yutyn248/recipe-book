"use client";

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "chunk_error_reload_guard";

/**
 * デプロイ直後など、開いたままのタブが古いJSチャンクを参照して
 * 読み込みに失敗する（ChunkLoadError等）場合に自動でリロードする。
 * 無限リロードを防ぐため、1セッションにつき1回だけ実行する。
 */
function isChunkLoadError(message: string): boolean {
  return /Loading chunk .* failed|ChunkLoadError|Failed to fetch dynamically imported module/i.test(message);
}

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
  } catch {
    // sessionStorageが使えない場合もそのままリロードする
  }
  window.location.reload();
}

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
