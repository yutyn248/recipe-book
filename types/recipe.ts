import { Block } from "./block";

export const GENRES = ["和食", "洋食", "中華", "イタリアン", "韓国料理", "メイン", "麺", "ご飯", "スープ・汁物", "副菜", "デザート・スイーツ", "その他"] as const;
export type Genre = typeof GENRES[number];

export interface Recipe {
  id: string;
  title: string;
  genre: Genre | null;
  blocks: Block[];
  originalImages: string[];
  createdAt: string;
  updatedAt?: string;
}
