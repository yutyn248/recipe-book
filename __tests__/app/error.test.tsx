import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "@/app/error";

const reloadMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  reloadMock.mockClear();
  Object.defineProperty(window, "location", {
    value: { ...window.location, reload: reloadMock },
    writable: true,
  });
});

describe("app/error.tsx", () => {
  it("チャンクロードエラーの場合は自動リロードし、フォールバックUIは表示しない", () => {
    const error = Object.assign(new Error("Loading chunk 42 failed"), { digest: "x" });
    const { container } = render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });

  it("それ以外のエラーはフォールバックUIを表示し、リロードはしない", () => {
    const error = Object.assign(new Error("Unexpected error"), { digest: "y" });
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(reloadMock).not.toHaveBeenCalled();
    expect(screen.getByText("問題が発生しました。")).toBeInTheDocument();
  });

  it("再試行するボタンを押すとresetが呼ばれる", () => {
    const error = Object.assign(new Error("Unexpected error"), { digest: "z" });
    const reset = vi.fn();
    render(<ErrorPage error={error} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "再試行する" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
