import { describe, it, expect, vi, beforeEach } from "vitest";
import { isChunkLoadError, reloadOnce } from "@/lib/chunk-error";

describe("isChunkLoadError", () => {
  it("webpackのChunkLoadErrorを検知する", () => {
    expect(isChunkLoadError("Loading chunk 123 failed")).toBe(true);
    expect(isChunkLoadError("ChunkLoadError")).toBe(true);
  });

  it("Turbopackのエラー文言を検知する", () => {
    expect(isChunkLoadError("Failed to fetch dynamically imported module")).toBe(true);
    expect(isChunkLoadError("Failed to load chunk from module xyz")).toBe(true);
  });

  it("無関係なエラーは検知しない", () => {
    expect(isChunkLoadError("TypeError: something else")).toBe(false);
    expect(isChunkLoadError("")).toBe(false);
  });
});

describe("reloadOnce", () => {
  const reloadMock = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reloadMock.mockClear();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });
  });

  it("初回はリロードしてtrueを返す", () => {
    expect(reloadOnce()).toBe(true);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("2回目以降はリロードせずfalseを返す（無限ループ防止）", () => {
    reloadOnce();
    reloadMock.mockClear();
    expect(reloadOnce()).toBe(false);
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
