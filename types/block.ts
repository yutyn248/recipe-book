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

export type Block = PhotoBlock | IngredientsBlock | StepBlock;
