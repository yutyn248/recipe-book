export interface HeroBlock {
  id: string;
  type: "hero";
  base64: string;
}

export interface PhotoBlock {
  id: string;
  type: "photo";
  base64: string;
}

export interface IngredientsBlock {
  id: string;
  type: "ingredients";
  items: string[];
}

export interface StepBlock {
  id: string;
  type: "step";
  text: string;
}

export interface MemoBlock {
  id: string;
  type: "memo";
  text: string;
}

export type Block = HeroBlock | PhotoBlock | IngredientsBlock | StepBlock | MemoBlock;
