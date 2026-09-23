const RELOAD_GUARD_KEY = "chunk_error_reload_guard";

/**
 * デプロイ直後、開いたままのタブが古いJSチャンクを参照して読み込みに失敗する
 * 場合のエラーメッセージを判定する。webpack（ChunkLoadError等）・Turbopack
 * （Failed to load chunk from module等）どちらの文言にも対応する。
 */
export function isChunkLoadError(message: string): boolean {
  return /Loading chunk .* failed|ChunkLoadError|Failed to (fetch|load) (dynamically imported module|chunk)/i.test(
    message
  );
}

/** 1セッションにつき1回だけページをリロードする（無限リロード防止） */
export function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
  } catch {
    // sessionStorageが使えない場合もそのままリロードする
  }
  window.location.reload();
  return true;
}
