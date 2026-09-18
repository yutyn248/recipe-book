import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import ChunkErrorReload from "@/components/ChunkErrorReload";

const reloadMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  reloadMock.mockClear();
  // jsdomのwindow.location.reloadはデフォルトで未実装のため差し替える
  Object.defineProperty(window, "location", {
    value: { ...window.location, reload: reloadMock },
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChunkErrorReload", () => {
  it("ChunkLoadError系のエラーが発生したらリロードする", () => {
    render(<ChunkErrorReload />);
    window.dispatchEvent(new ErrorEvent("error", { message: "Loading chunk 123 failed" }));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("動的importの失敗（unhandledrejection）でもリロードする", () => {
    render(<ChunkErrorReload />);
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", { value: new Error("Failed to fetch dynamically imported module") });
    window.dispatchEvent(event);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("チャンクエラーと無関係なエラーではリロードしない", () => {
    render(<ChunkErrorReload />);
    window.dispatchEvent(new ErrorEvent("error", { message: "TypeError: something else" }));
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("同一セッションで2回目以降はリロードしない（無限ループ防止）", () => {
    render(<ChunkErrorReload />);
    window.dispatchEvent(new ErrorEvent("error", { message: "ChunkLoadError" }));
    window.dispatchEvent(new ErrorEvent("error", { message: "ChunkLoadError" }));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
