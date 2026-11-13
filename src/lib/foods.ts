import type { FoodGroup } from '@/db/schema';

// Common first foods, by group. It powers the add-food autocomplete and
// guesses the group for the Nursery Shelf jars; anything not listed is filed
// under "other" and can be changed by hand.
const FOODS: Record<Exclude<FoodGroup, 'other'>, string[]> = {
  fruit: ['Apple', 'Applesauce', 'Apricot', 'Avocado', 'Banana', 'Blackberries', 'Blueberries', 'Cantaloupe', 'Cherries', 'Grapes', 'Kiwi', 'Mango', 'Melon', 'Orange', 'Papaya', 'Peach', 'Pear', 'Pineapple', 'Plum', 'Prunes', 'Raspberries', 'Strawberries', 'Watermelon'],
  vegetable: ['Asparagus', 'Beets', 'Broccoli', 'Butternut squash', 'Carrot', 'Cauliflower', 'Corn', 'Cucumber', 'Green beans', 'Kale', 'Peas', 'Potato', 'Pumpkin', 'Spinach', 'Squash', 'Sweet potato', 'Tomato', 'Zucchini'],
  grain: ['Barley', 'Bread', 'Cereal', 'Crackers', 'Oatmeal', 'Pancake', 'Pasta', 'Quinoa', 'Rice', 'Rice cereal', 'Toast', 'Tortilla', 'Waffle'],
  protein: ['Beans', 'Beef', 'Black beans', 'Chicken', 'Chickpeas', 'Egg', 'Fish', 'Hummus', 'Lamb', 'Lentils', 'Peanut butter', 'Pork', 'Salmon', 'Shrimp', 'Tofu', 'Turkey'],
  dairy: ['Butter', 'Cheese', 'Cottage cheese', 'Cream cheese', 'Milk', 'Yogurt'],
};

export const FOOD_SUGGESTIONS: readonly string[] = Object.values(FOODS).flat().sort();

const GROUP_OF = new Map<string, FoodGroup>();
for (const [group, names] of Object.entries(FOODS)) for (const n of names) GROUP_OF.set(n.toLowerCase(), group as FoodGroup);

export const FOOD_GROUP_LABELS: Record<FoodGroup, string> = {
  fruit: 'Fruit',
  vegetable: 'Vegetables',
  grain: 'Grains',
  protein: 'Protein',
  dairy: 'Dairy',
  other: 'Other',
};

/** Exact match first, then the last word, so "mashed banana" and "bananas" still land in fruit. */
export function guessFoodGroup(title: string): FoodGroup {
  const name = title.trim().toLowerCase();
  const exact = GROUP_OF.get(name);
  if (exact) return exact;
  for (const word of name.split(/\s+/).reverse()) {
    const hit = GROUP_OF.get(word) ?? GROUP_OF.get(word.replace(/s$/, '')) ?? GROUP_OF.get(`${word}s`);
    if (hit) return hit;
  }
  return 'other';
}
