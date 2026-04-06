import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RecipeCard from "@/components/RecipeCard";
import type { Recipe } from "@/types/recipe";

// next/link をシンプルな <a> にモック
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const baseRecipe: Recipe = {
  id: "recipe-1",
  title: "唐揚げ",
  genre: "和食",
  blocks: [
    { id: "b1", type: "ingredients", items: ["鶏肉", "醤油", "砂糖"] },
    { id: "b2", type: "step", text: "鶏肉を切る" },
    { id: "b3", type: "step", text: "揚げる" },
  ],
  originalImages: [],
  createdAt: "2026-04-01T00:00:00.000Z",
};

describe("RecipeCard", () => {
  it("タイトルとジャンルが表示される", () => {
    render(<RecipeCard recipe={baseRecipe} />);
    expect(screen.getByText("唐揚げ")).toBeInTheDocument();
    expect(screen.getByText("和食")).toBeInTheDocument();
  });

  it("材料数と工程数が表示される", () => {
    render(<RecipeCard recipe={baseRecipe} />);
    expect(screen.getByText("材料 3品 · 2工程")).toBeInTheDocument();
  });

  it("ジャンルなしでもクラッシュしない", () => {
    const r = { ...baseRecipe, genre: null };
    render(<RecipeCard recipe={r} />);
    expect(screen.getByText("唐揚げ")).toBeInTheDocument();
  });

  it("お気に入り時に♥が表示される", () => {
    render(<RecipeCard recipe={baseRecipe} meta={{ favorite: true }} />);
    expect(screen.getByText("♥")).toBeInTheDocument();
  });

  it("お気に入りでない時は♥が表示されない", () => {
    render(<RecipeCard recipe={baseRecipe} meta={{ favorite: false }} />);
    expect(screen.queryByText("♥")).not.toBeInTheDocument();
  });

  it("評価が★で表示される（3の場合）", () => {
    render(<RecipeCard recipe={baseRecipe} meta={{ rating: 3 }} />);
    expect(screen.getByText("★★★☆☆")).toBeInTheDocument();
  });

  it("最終調理日が表示される", () => {
    render(<RecipeCard recipe={baseRecipe} meta={{ lastCookedAt: "2026-03-15T10:00:00.000Z" }} />);
    expect(screen.getByText(/最終調理/)).toBeInTheDocument();
  });

  it("重複時は赤枠のアウトラインが付く", () => {
    const { container } = render(<RecipeCard recipe={baseRecipe} isDuplicate={true} />);
    const card = container.querySelector("[style*='outline']");
    expect(card).toBeInTheDocument();
  });

  it("重複なしはアウトラインがない", () => {
    const { container } = render(<RecipeCard recipe={baseRecipe} isDuplicate={false} />);
    const card = container.querySelector("[style*='outline: 1.5px']");
    expect(card).not.toBeInTheDocument();
  });

  it("レシピ詳細ページへのリンクが正しい", () => {
    render(<RecipeCard recipe={baseRecipe} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/recipes/recipe-1");
  });

  it("材料ブロックなしでも表示される", () => {
    const r = { ...baseRecipe, blocks: [{ id: "b1", type: "step" as const, text: "炒める" }] };
    render(<RecipeCard recipe={r} />);
    expect(screen.getByText("唐揚げ")).toBeInTheDocument();
  });
});
