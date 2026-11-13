import type { FoodGroup } from '@/db/schema';

// Common first foods, by group, including dishes from the kitchens many
// American families cook from (Mexican and Latin American, Chinese, Japanese,
// Korean, Vietnamese, Thai, Indian, Middle Eastern, Italian, Polish and
// Eastern European, Caribbean, West African, Ethiopian, Jewish). It powers
// the add-food autocomplete and guesses the group for the Nursery Shelf
// jars. Mixed dishes are listed under "other" so the guess doesn't file
// "fried rice" as a grain by its last word; anything not listed is "other"
// too, and the group can always be changed by hand.
const FOODS: Record<FoodGroup, string[]> = {
  fruit: [
    'Apple', 'Applesauce', 'Apricot', 'Asian pear', 'Avocado', 'Banana', 'Blackberries', 'Blueberries', 'Cantaloupe', 'Cherries', 'Dates', 'Dragon fruit', 'Figs', 'Grapes', 'Guava',
    'Jackfruit', 'Kiwi', 'Lychee', 'Mango', 'Melon', 'Orange', 'Papaya', 'Peach', 'Pear', 'Persimmon', 'Pineapple', 'Plantain', 'Plum', 'Pomegranate', 'Prunes', 'Raspberries', 'Strawberries', 'Watermelon',
  ],
  vegetable: [
    'Asparagus', 'Beets', 'Bok choy', 'Broccoli', 'Butternut squash', 'Callaloo', 'Carrot', 'Cauliflower', 'Chayote', 'Collard greens', 'Corn', 'Cucumber', 'Daikon', 'Edamame', 'Eggplant',
    'Green beans', 'Jicama', 'Kale', 'Okra', 'Peas', 'Potato', 'Pumpkin', 'Sauerkraut', 'Seaweed', 'Spinach', 'Squash', 'Sweet potato', 'Tomato', 'Yam', 'Yuca', 'Zucchini',
  ],
  grain: [
    'Arepa', 'Bagel', 'Barley', 'Bread', 'Buckwheat', 'Bulgur', 'Cereal', 'Challah', 'Congee', 'Cornbread', 'Couscous', 'Crackers', 'Dosa', 'Fufu', 'Gnocchi', 'Grits', 'Idli', 'Injera', 'Kasha',
    'Matzo', 'Naan', 'Oatmeal', 'Pancake', 'Pasta', 'Pastina', 'Pita', 'Polenta', 'Quinoa', 'Ragi', 'Ramen', 'Rice', 'Rice cereal', 'Rice noodles', 'Risotto', 'Roti', 'Rye bread', 'Soba', 'Teff', 'Toast', 'Tortilla', 'Udon', 'Waffle',
  ],
  protein: [
    'Beans', 'Beef', 'Black beans', 'Black-eyed peas', 'Chicken', 'Chickpeas', 'Dal', 'Egg', 'Falafel', 'Fish', 'Hummus', 'Kielbasa', 'Lamb', 'Lentils', 'Mung beans', 'Peanut butter',
    'Pinto beans', 'Pork', 'Refried beans', 'Salmon', 'Sardines', 'Shrimp', 'Tahini', 'Tempeh', 'Tofu', 'Turkey',
  ],
  dairy: ['Butter', 'Cheese', 'Cottage cheese', 'Cream cheese', 'Farmer cheese', 'Feta', 'Ghee', 'Halloumi', 'Kefir', 'Labneh', 'Milk', 'Mozzarella', 'Paneer', 'Parmesan', 'Queso fresco', 'Raita', 'Ricotta', 'Yogurt'],
  other: [
    'Arroz con pollo', 'Baba ganoush', 'Bao', 'Borscht', 'Butter chicken', 'Chana masala', 'Dumplings', 'Empanada', 'Fried rice', 'Golabki', 'Guacamole', 'Jollof rice', 'Khichdi', 'Kimchi', 'Kugel',
    'Latkes', 'Lentil soup', 'Lo mein', 'Minestrone', 'Miso soup', 'Mochi', 'Pad thai', 'Pho', 'Pierogi', 'Potato pancakes', 'Pupusa', 'Quesadilla', 'Rice and beans', 'Sushi', 'Tabbouleh', 'Tamale', 'Upma',
  ],
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
