import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UploadModal from "@/components/UploadModal";

const saveRecipeMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/storage", () => ({
  saveRecipe: (...args: unknown[]) => saveRecipeMock(...args),
}));

beforeEach(() => {
  saveRecipeMock.mockClear();
});

function setup(existingTitles: string[] = []) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<UploadModal onClose={onClose} onSaved={onSaved} existingTitles={existingTitles} />);
  return { onClose, onSaved };
}

describe("UploadModal 手動作成", () => {
  it("「手動」タブを押すと、AIを経由せず編集画面（内容を確認・修正）へ進む", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "手動" }));
    expect(screen.getByText("内容を確認・修正")).toBeInTheDocument();
  });

  it("手動作成時は料理名が空で始まり、材料1件・手順1件のブロックが用意されている", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "手動" }));
    // 料理名は即編集状態（input）で始まる
    const titleInput = screen.getByLabelText("料理名");
    expect(titleInput.tagName).toBe("INPUT");
    expect(screen.getByText("材料")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("材料（分量）")).toBeInTheDocument();
    // 手順ブロックが1件、未入力状態で用意されている
    expect(screen.getAllByText("タップして入力…")).toHaveLength(1);
  });

  it("料理名が空のままだと「確認する→」が押せない", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "手動" }));
    fireEvent.blur(screen.getByLabelText("料理名"));
    const confirmButton = screen.getByRole("button", { name: "確認する →" });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByText("料理名を入力してください")).toBeInTheDocument();
  });

  it("料理名を入力すると「確認する→」が押せるようになり、保存まで到達できる", async () => {
    const { onSaved } = setup();
    fireEvent.click(screen.getByRole("button", { name: "手動" }));

    const titleInput = screen.getByLabelText("料理名");
    fireEvent.change(titleInput, { target: { value: "自作の肉じゃが" } });
    fireEvent.blur(titleInput);

    const confirmButton = screen.getByRole("button", { name: "確認する →" });
    expect(confirmButton).not.toBeDisabled();
    fireEvent.click(confirmButton);

    const saveButton = await screen.findByRole("button", { name: "保存する" });
    fireEvent.click(saveButton);

    await waitFor(() => expect(saveRecipeMock).toHaveBeenCalledTimes(1));
    const savedArg = saveRecipeMock.mock.calls[0][0];
    expect(savedArg.title).toBe("自作の肉じゃが");
    expect(savedArg.originalImages).toEqual([]);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("既に登録済みの料理名だと「確認する→」が押せない", () => {
    setup(["肉じゃが"]);
    fireEvent.click(screen.getByRole("button", { name: "手動" }));
    const titleInput = screen.getByLabelText("料理名");
    fireEvent.change(titleInput, { target: { value: "肉じゃが" } });
    fireEvent.blur(titleInput);
    expect(screen.getByRole("button", { name: "確認する →" })).toBeDisabled();
  });
});
