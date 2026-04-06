import { Block } from "./block";

export const GENRES = ["和食", "洋食", "中華", "イタリアン", "韓国料理", "肉・魚メイン", "麺・ごはん", "スープ・汁物", "サラダ・和え物", "デザート・スイーツ", "その他"] as const;
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
