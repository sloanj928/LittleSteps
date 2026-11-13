// Common early words, for the add-word dropdown, the way FOOD_SUGGESTIONS
// serves foods. Drawn from the words that most often top first-word
// vocabulary checklists (people, animals and their sounds, food, social
// words), in English, Spanish and Polish. A word two languages share
// ("Mama", "No") is listed once: the duplicate check reads "Mamá" as
// "Mama" anyway. Anything not listed can still be typed.
export const WORD_SUGGESTIONS: readonly string[] = [
  'Mama', 'Dada', 'Baba', 'Nana', 'Papa', 'Grandma', 'Grandpa', 'Baby',
  'Hi', 'Bye-bye', 'Uh-oh', 'No', 'Yes', 'Please', 'Thank you', 'More', 'All done', 'Up', 'Down', 'Again', 'Mine', 'Night-night', 'Peekaboo', 'Wow',
  'Ball', 'Book', 'Car', 'Shoe', 'Hat', 'Cup', 'Spoon', 'Bath', 'Bed', 'Light', 'Door', 'Keys', 'Phone', 'Teddy', 'Blanket', 'Truck', 'Bubbles',
  'Dog', 'Doggy', 'Cat', 'Kitty', 'Duck', 'Cow', 'Bird', 'Fish', 'Bear', 'Horse', 'Pig', 'Sheep', 'Bunny',
  'Woof', 'Meow', 'Moo', 'Quack', 'Baa', 'Oink', 'Vroom', 'Choo-choo',
  'Milk', 'Water', 'Juice', 'Banana', 'Apple', 'Cookie', 'Cracker', 'Cheese', 'Eat', 'Yum',
  'Eyes', 'Nose', 'Mouth', 'Ears', 'Hair', 'Feet', 'Hand', 'Belly',
  'Hot', 'Owie', 'Boo-boo', 'Hug', 'Kiss', 'Go', 'Stop', 'Open', 'Out', 'Outside', 'Sock', 'Diaper', 'Moon', 'Star', 'Tree', 'Flower',
  // Spanish
  'Abuela', 'Abuelo', 'Adiós', 'Agua', 'Bebé', 'Boca', 'Galleta', 'Gato', 'Gracias', 'Hola', 'Leche', 'Más', 'Mío', 'Nariz', 'Nene', 'Nena', 'Ojos', 'Oso', 'Pan', 'Pato', 'Pelota', 'Perro', 'Sí', 'Upa', 'Vaca', 'Ya', 'Zapato',
  // Polish
  'Am am', 'Aua', 'Babcia', 'Brum brum', 'Buzia', 'But', 'Chleb', 'Ciocia', 'Cześć', 'Daj', 'Dobranoc', 'Dziadek', 'Dziadzia', 'Dziękuję', 'Hau hau', 'Jabłko', 'Jeszcze', 'Kot', 'Kwa kwa', 'Lala', 'Miau', 'Miś', 'Mleko', 'Muu', 'Nie', 'Nos', 'Oko', 'Pies', 'Piłka', 'Proszę', 'Tak', 'Tata', 'Woda', 'Wujek',
].sort();
