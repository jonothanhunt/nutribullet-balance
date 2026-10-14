import type { Ink } from "./programs";

/** Per 100 g, rounded from USDA FoodData Central. Good enough for a smoothie. */
export interface Food {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  sugar: number;
  fibre: number;
  fat: number;
}

const f = (
  id: string,
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  sugar: number,
  fibre: number,
  fat: number,
): Food => ({ id, name, kcal, protein, carbs, sugar, fibre, fat });

export const FOODS: Food[] = [
  f("banana", "Banana", 89, 1.1, 22.8, 12.2, 2.6, 0.3),
  f("frozen-banana", "Frozen banana", 89, 1.1, 22.8, 12.2, 2.6, 0.3),
  f("strawberry", "Strawberries", 32, 0.7, 7.7, 4.9, 2.0, 0.3),
  f("blueberry", "Blueberries", 57, 0.7, 14.5, 10.0, 2.4, 0.3),
  f("raspberry", "Raspberries", 52, 1.2, 11.9, 4.4, 6.5, 0.7),
  f("mixed-berries", "Mixed berries (frozen)", 48, 0.8, 11.0, 7.0, 3.5, 0.3),
  f("mango", "Mango", 60, 0.8, 15.0, 13.7, 1.6, 0.4),
  f("pineapple", "Pineapple", 50, 0.5, 13.1, 9.9, 1.4, 0.1),
  f("apple", "Apple", 52, 0.3, 13.8, 10.4, 2.4, 0.2),
  f("pear", "Pear", 57, 0.4, 15.2, 9.8, 3.1, 0.1),
  f("kiwi", "Kiwi", 61, 1.1, 14.7, 9.0, 3.0, 0.5),
  f("orange", "Orange", 47, 0.9, 11.8, 9.4, 2.4, 0.1),
  f("cherries", "Cherries (frozen)", 63, 1.1, 16.0, 12.8, 2.1, 0.2),
  f("avocado", "Avocado", 160, 2.0, 8.5, 0.7, 6.7, 14.7),
  f("spinach", "Spinach", 23, 2.9, 3.6, 0.4, 2.2, 0.4),
  f("kale", "Kale", 49, 4.3, 8.8, 2.3, 3.6, 0.9),
  f("cucumber", "Cucumber", 15, 0.7, 3.6, 1.7, 0.5, 0.1),
  f("celery", "Celery", 16, 0.7, 3.0, 1.3, 1.6, 0.2),
  f("ginger", "Fresh ginger", 80, 1.8, 17.8, 1.7, 2.0, 0.8),
  f("mint", "Mint", 70, 3.8, 14.9, 0, 8.0, 0.9),
  f("lime", "Lime juice", 25, 0.4, 8.4, 1.7, 0.4, 0.1),
  f("dates", "Medjool dates", 277, 1.8, 75.0, 66.5, 6.7, 0.2),
  f("oats", "Rolled oats", 379, 13.2, 67.7, 1.0, 10.1, 6.5),
  f("peanut-butter", "Peanut butter", 588, 25.1, 20.0, 9.2, 6.0, 50.4),
  f("almond-butter", "Almond butter", 614, 21.0, 18.8, 4.4, 10.3, 55.5),
  f("chia", "Chia seeds", 486, 16.5, 42.1, 0, 34.4, 30.7),
  f("flax", "Ground flaxseed", 534, 18.3, 28.9, 1.6, 27.3, 42.2),
  f("hemp", "Hemp hearts", 553, 31.6, 8.7, 1.5, 4.0, 48.8),
  f("cacao", "Cacao powder", 228, 19.6, 57.9, 1.8, 37.0, 13.7),
  f("whey", "Whey protein", 380, 78.0, 8.0, 5.0, 0, 5.0),
  f("greek-yogurt", "Greek yoghurt", 97, 9.0, 3.9, 3.6, 0, 5.0),
  f("milk", "Milk (semi-skimmed)", 47, 3.4, 4.8, 4.8, 0, 1.7),
  f("oat-milk", "Oat milk", 46, 1.0, 6.7, 4.0, 0.8, 1.5),
  f("almond-milk", "Almond milk", 13, 0.4, 0.3, 0, 0.2, 1.1),
  f("coconut-water", "Coconut water", 19, 0.7, 3.7, 2.6, 1.1, 0.2),
  f("orange-juice", "Orange juice", 45, 0.7, 10.4, 8.4, 0.2, 0.2),
  f("water", "Water", 0, 0, 0, 0, 0, 0),
  f("ice", "Ice", 0, 0, 0, 0, 0, 0),
  f("honey", "Honey", 304, 0.3, 82.4, 82.1, 0.2, 0),
  f("maple", "Maple syrup", 260, 0, 67.0, 60.5, 0, 0.1),
];

export const food = (id: string) => FOODS.find((x) => x.id === id);

export interface Item {
  food: string;
  grams: number;
}

export interface Recipe {
  id: string;
  name: string;
  blurb: string;
  ink: Ink;
  program: string;
  items: Item[];
  /** User-made rather than shipped. */
  mine?: boolean;
}

/** In pour order: soft things and liquid last, so the blades see them first. */
export const RECIPES: Recipe[] = [
  {
    id: "green-machine",
    name: "Green machine",
    blurb: "Spinach you won't taste, pineapple you will.",
    ink: "leaf",
    program: "super",
    items: [
      { food: "spinach", grams: 40 },
      { food: "pineapple", grams: 120 },
      { food: "banana", grams: 100 },
      { food: "ginger", grams: 5 },
      { food: "coconut-water", grams: 250 },
    ],
  },
  {
    id: "berry-oat",
    name: "Berry oat breakfast",
    blurb: "A bowl of porridge you drink on the bus.",
    ink: "grape",
    program: "standard",
    items: [
      { food: "oats", grams: 40 },
      { food: "mixed-berries", grams: 150 },
      { food: "banana", grams: 80 },
      { food: "greek-yogurt", grams: 100 },
      { food: "oat-milk", grams: 200 },
    ],
  },
  {
    id: "pb-banana",
    name: "PB & banana",
    blurb: "Post-gym. Tastes like a milkshake, isn't one.",
    ink: "sun",
    program: "standard",
    items: [
      { food: "frozen-banana", grams: 120 },
      { food: "peanut-butter", grams: 25 },
      { food: "oats", grams: 30 },
      { food: "whey", grams: 30 },
      { food: "milk", grams: 250 },
    ],
  },
  {
    id: "tropical",
    name: "Tropical",
    blurb: "Mango, pineapple, lime. Holiday in a cup.",
    ink: "flame",
    program: "crush",
    items: [
      { food: "mango", grams: 150 },
      { food: "pineapple", grams: 100 },
      { food: "lime", grams: 15 },
      { food: "ice", grams: 80 },
      { food: "coconut-water", grams: 200 },
    ],
  },
  {
    id: "choc-cherry",
    name: "Chocolate cherry",
    blurb: "Black forest gâteau, minus the gâteau.",
    ink: "rose",
    program: "super",
    items: [
      { food: "cherries", grams: 150 },
      { food: "cacao", grams: 10 },
      { food: "dates", grams: 25 },
      { food: "chia", grams: 10 },
      { food: "almond-milk", grams: 250 },
    ],
  },
  {
    id: "cucumber-mint",
    name: "Cucumber cooler",
    blurb: "Barely sweet, very cold, very green.",
    ink: "sea",
    program: "crush",
    items: [
      { food: "cucumber", grams: 150 },
      { food: "apple", grams: 120 },
      { food: "mint", grams: 5 },
      { food: "lime", grams: 15 },
      { food: "ice", grams: 100 },
      { food: "water", grams: 150 },
    ],
  },
  {
    id: "blue-protein",
    name: "Blueberry protein",
    blurb: "Thick, purple, 35g protein.",
    ink: "sky",
    program: "standard",
    items: [
      { food: "blueberry", grams: 150 },
      { food: "greek-yogurt", grams: 150 },
      { food: "whey", grams: 25 },
      { food: "flax", grams: 10 },
      { food: "almond-milk", grams: 200 },
    ],
  },
  {
    id: "avo-kale",
    name: "Avocado & kale",
    blurb: "Silky. Keeps you full till lunch.",
    ink: "leaf",
    program: "super",
    items: [
      { food: "kale", grams: 30 },
      { food: "avocado", grams: 60 },
      { food: "pear", grams: 150 },
      { food: "hemp", grams: 15 },
      { food: "lime", grams: 10 },
      { food: "water", grams: 250 },
    ],
  },
];

export interface Totals {
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  sugar: number;
  fibre: number;
  fat: number;
}

export function totals(items: Item[]): Totals {
  const t: Totals = { grams: 0, kcal: 0, protein: 0, carbs: 0, sugar: 0, fibre: 0, fat: 0 };
  for (const { food: id, grams } of items) {
    t.grams += grams;
    const x = food(id);
    if (!x) continue;
    const k = grams / 100;
    t.kcal += x.kcal * k;
    t.protein += x.protein * k;
    t.carbs += x.carbs * k;
    t.sugar += x.sugar * k;
    t.fibre += x.fibre * k;
    t.fat += x.fat * k;
  }
  return t;
}
