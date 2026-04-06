export interface ShoppingItem {
  id: string;
  recipeId: string;
  recipeTitle: string;
  ingredient: string;
  checked: boolean;
}

const KEY = "shopping_list";

export function getShoppingItems(): ShoppingItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function save(items: ShoppingItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addToShoppingList(recipeId: string, recipeTitle: string, ingredients: string[]) {
  const current = getShoppingItems();
  const newItems: ShoppingItem[] = ingredients.map((ingredient) => ({
    id: crypto.randomUUID(),
    recipeId,
    recipeTitle,
    ingredient,
    checked: false,
  }));
  save([...current, ...newItems]);
}

export function toggleShoppingItem(id: string) {
  save(getShoppingItems().map((item) => item.id === id ? { ...item, checked: !item.checked } : item));
}

export function removeCheckedItems() {
  save(getShoppingItems().filter((item) => !item.checked));
}

export function removeRecipeFromList(recipeId: string) {
  save(getShoppingItems().filter((item) => item.recipeId !== recipeId));
}

export function addManualItem(text: string) {
  if (!text.trim()) return;
  const current = getShoppingItems();
  const item: ShoppingItem = {
    id: crypto.randomUUID(),
    recipeId: "__manual__",
    recipeTitle: "メモ",
    ingredient: text.trim(),
    checked: false,
  };
  save([...current, item]);
}

export function clearShoppingList() {
  localStorage.removeItem(KEY);
}
