import { nameKey } from './match';

// Words for the add-word dropdown, the way FOOD_SUGGESTIONS serves foods.
// Not just first words: a toddler of 18-30 months says hundreds, so the
// English list follows the categories of the MacArthur-Bates CDI, the
// vocabulary checklist pediatricians and speech therapists count words by
// (sounds, animals, vehicles, toys, food, clothes, body, home, outside,
// places, people, routines, actions, describing words, time and the little
// words), with Spanish and Polish lists beside it.
//
// Only what that count accepts as a word: a sound used consistently for a
// meaning. Animal sounds and names count; so do fixed units like "thank
// you", "all gone" and "night-night". Recited sequences (number words) and
// sentence-like phrases ("I love you", "my turn") do not, so they aren't
// offered. Anything not listed can still be typed.

const list = (words: string) =>
  words
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

const ENGLISH = list(`
  Mama, Dada, Mommy, Daddy, Baba, Nana, Papa, Grandma, Grandpa, Baby,

  Achoo, Baa, Beep beep, Boom, Buzz, Choo-choo, Cock-a-doodle-doo, Ew, Grr, Hiss, Hoot, Meow, Moo, Neigh, Oink, Ouch, Pop, Quack, Ribbit, Roar, Shh, Splash, Tweet, Uh-oh, Vroom, Whee, Woof, Yuck, Yum,

  Alligator, Animal, Ant, Bat, Bear, Bee, Bird, Bug, Bunny, Butterfly, Calf, Camel, Cat, Caterpillar, Chick, Chicken, Cow, Crab, Deer, Dinosaur, Dog, Doggy, Dolphin, Donkey, Dragon, Duck, Elephant, Fish, Flamingo, Fox, Frog, Giraffe, Goat, Goose, Hen, Hippo, Horse, Kangaroo, Kitten, Kitty, Koala, Ladybug, Lamb, Lion, Monkey, Moose, Mouse, Octopus, Owl, Panda, Parrot, Peacock, Penguin, Pig, Pony, Puppy, Raccoon, Rhino, Rooster, Seal, Shark, Sheep, Snake, Spider, Squirrel, Teddy bear, Tiger, Turtle, Unicorn, Whale, Wolf, Worm, Zebra,

  Airplane, Ambulance, Bike, Boat, Bus, Car, Car seat, Digger, Excavator, Fire truck, Garbage truck, Helicopter, Motorcycle, Police car, Rocket, School bus, Scooter, Sled, Stroller, Taxi, Tractor, Train, Truck, Van, Wagon,

  Ball, Balloon, Block, Book, Bubbles, Chalk, Crayon, Doll, Drum, Game, Gift, Glue, Kite, Music, Paint, Paper, Pen, Pencil, Play dough, Present, Puppet, Puzzle, Robot, Song, Stickers, Story, Teddy, Toy,

  Apple, Avocado, Bagel, Banana, Beans, Berries, Blueberry, Bread, Broccoli, Burrito, Butter, Cake, Candy, Carrot, Cereal, Cheese, Chocolate, Coffee, Cookie, Corn, Cracker, Cupcake, Donut, Egg, French fries, Grapes, Gum, Hamburger, Honey, Hot dog, Ice, Ice cream, Jelly, Juice, Lollipop, Meat, Melon, Milk, Muffin, Noodles, Nuts, Orange, Pancake, Pasta, Peanut butter, Peas, Pickle, Pie, Pizza, Popcorn, Popsicle, Potato, Pretzel, Pumpkin, Raisin, Rice, Salt, Sandwich, Sauce, Snack, Soup, Spaghetti, Strawberry, Sushi, Taco, Tea, Toast, Tomato, Tuna, Vitamins, Waffle, Water, Watermelon, Yogurt,

  Backpack, Beads, Belt, Bib, Boots, Button, Coat, Crown, Diaper, Dress, Glasses, Gloves, Hat, Hood, Jacket, Jeans, Mittens, Necklace, Pajamas, Pants, Pocket, Sandals, Scarf, Shirt, Shoe, Shorts, Slipper, Sneaker, Sock, Sweater, Swimsuit, Tights, Underwear, Zipper,

  Ankle, Arm, Back, Belly, Belly button, Bottom, Cheek, Chin, Ear, Elbow, Eye, Face, Feet, Finger, Foot, Hair, Hand, Head, Knee, Leg, Lips, Mouth, Nails, Neck, Nose, Owie, Boo-boo, Shoulder, Teeth, Thumb, Toe, Tongue, Tooth, Tummy,

  Bag, Basket, Bathtub, Battery, Blanket, Bottle, Bowl, Box, Broom, Brush, Bucket, Camera, Can, Clock, Comb, Computer, Cup, Dish, Fan, Fork, Garbage, Glass, Hammer, Jar, Keys, Lamp, Light, Medicine, Mirror, Money, Mop, Napkin, Pacifier, Penny, Phone, Picture, Pillow, Plant, Plate, Purse, Radio, Remote, Scissors, Soap, Spoon, Tablet, Tape, Tissue, Toothbrush, Towel, Trash, Tray, TV, Umbrella, Vacuum, Wallet, Watch,
  Basement, Bathroom, Bed, Bedroom, Chair, Closet, Couch, Crib, Door, Drawer, Dryer, Fridge, Garage, High chair, Kitchen, Living room, Oven, Porch, Potty, Room, Shower, Sink, Stairs, Stove, Table, Toilet, Washer, Window,

  Backyard, Cloud, Dirt, Fire, Flag, Flower, Garden, Grass, Hill, Hose, Ladder, Lake, Lawn mower, Leaf, Moon, Mud, Ocean, Puddle, Rain, Rainbow, River, Rock, Roof, Sand, Sandbox, Shovel, Sidewalk, Sky, Slide, Snow, Snowman, Sprinkler, Star, Stick, Street, Sun, Swing, Tree, Wind,

  Airport, Beach, Camp, Church, Circus, City, Daycare, Farm, Gas station, Grocery store, Gym, Home, Hospital, House, Library, Movie, Museum, Outside, Park, Party, Picnic, Playground, Pool, Restaurant, School, Store, Work, Zoo,

  Aunt, Babysitter, Boy, Brother, Child, Clown, Cousin, Cowboy, Doctor, Firefighter, Friend, Ghost, Girl, King, Kid, Lady, Mail carrier, Man, Monster, Neighbor, Nurse, People, Person, Pirate, Police, Prince, Princess, Queen, Santa, Sister, Superhero, Teacher, Uncle, Witch,

  All done, All gone, Bath, Breakfast, Bye, Bye-bye, Dinner, Go potty, Goodnight, Hello, Help, Hi, High five, Hush, Lunch, Nap, Night-night, No, Okay, Patty cake, Peekaboo, Please, Shopping, So big, Sorry, Thank you, Uh-huh, Wait, Yes,

  Bite, Blow, Bounce, Break, Bring, Build, Buy, Carry, Catch, Chase, Clap, Clean, Climb, Close, Color, Cook, Cough, Count, Cover, Crawl, Cry, Cut, Dance, Draw, Drink, Drive, Drop, Dump, Eat, Fall, Feed, Find, Finish, Fit, Fix, Fly, Get, Give, Go, Have, Hear, Hide, Hit, Hold, Hop, Hug, Hurry, Jump, Kick, Kiss, Knock, Lick, Like, Listen, Look, Love, Make, Open, Pee, Pick, Play, Point, Poop, Pour, Pretend, Pull, Push, Put, Read, Ride, Rip, Roll, Run, Say, See, Shake, Share, Show, Sing, Sit, Sleep, Smile, Sneeze, Spill, Spin, Stand, Stay, Stop, Sweep, Swim, Take, Talk, Taste, Tear, Think, Throw, Tickle, Touch, Wake up, Walk, Want, Wash, Wave, Wipe, Wish, Write, Yawn,

  Asleep, Awake, Bad, Beautiful, Big, Black, Blue, Broken, Brown, Bumpy, Careful, Clean, Cold, Cool, Cozy, Cute, Dark, Dirty, Done, Dry, Empty, Fast, Fine, First, Full, Funny, Gentle, Good, Gray, Green, Gross, Happy, Hard, Heavy, High, Hot, Hungry, Hurt, Last, Little, Long, Loud, Mad, Naughty, New, Nice, Noisy, Old, Pink, Pretty, Purple, Quiet, Rainy, Red, Sad, Scared, Scary, Sick, Silly, Sleepy, Slow, Smooth, Snowy, Soft, Sticky, Stinky, Stuck, Sunny, Sweet, Thirsty, Tiny, Tired, Warm, Wet, White, Windy, Yellow, Yucky, Yummy,

  After, Before, Birthday, Christmas, Day, Halloween, Later, Morning, Night, Now, Soon, Today, Tomorrow, Tonight, Yesterday,

  I, Me, My, Mine, Myself, You, Your, He, She, It, We, They, Him, Her, Us, Them, This, That, These, Those,
  How, What, When, Where, Which, Who, Why,
  About, Above, Around, Away, Behind, By, Down, For, Here, In, Inside, Into, Next to, Of, Off, On, On top, Out, Over, There, To, Under, Up, With,
  A lot, Again, All, Another, Any, Each, Every, More, Much, None, Not, Other, Same, Some, Too,
  Am, Are, Be, Can, Could, Did, Do, Does, Don't, Gonna, Gotta, Is, Need, Try, Wanna, Will,
  And, Because, But, If, So, Then,
  Circle, Heart, Square, Triangle,
`);

const SPANISH = list(`
  Mamá, Papá, Abuela, Abuelo, Tía, Tío, Hermano, Hermana, Bebé, Nene, Nena, Niño, Niña, Amigo, Amiga, Maestra,
  Guau guau, Miau, Mu, Cuac cuac, Pío pío, Quiquiriquí,
  Perro, Perrito, Gato, Gatito, Pato, Vaca, Caballo, Pájaro, Pez, Oso, León, Tigre, Mono, Elefante, Conejo, Ratón, Pollito, Puerco, Oveja, Rana, Mariposa, Abeja, Tortuga, Jirafa, Burro, Dinosaurio,
  Agua, Leche, Pan, Jugo, Galleta, Manzana, Plátano, Huevo, Queso, Arroz, Pollo, Sopa, Carne, Frijoles, Uvas, Naranja, Fresa, Helado, Dulce, Comida, Tortilla, Papas,
  Pelota, Zapato, Carro, Coche, Avión, Tren, Barco, Camión, Bici, Libro, Muñeca, Juguete, Globo, Casa, Cama, Silla, Mesa, Puerta, Ventana, Luz, Baño, Taza, Plato, Cuchara, Vaso, Biberón, Chupón, Pañal, Sombrero, Camisa, Calcetín, Chaqueta, Llaves, Teléfono, Tele, Basura, Escuela, Parque, Tienda,
  Ojos, Nariz, Boca, Mano, Pie, Pelo, Cabeza, Oreja, Dientes, Panza, Pancita,
  Hola, Adiós, Gracias, Por favor, Sí, Más, Ya, Upa, Mío, Dame, Toma, Ven, Vamos, Mira, Qué, Aquí, Allí, Arriba, Abajo, Otra vez, Se acabó, Buenas noches, Besito, Abrazo, Ay, Uy, Mucho, Poquito,
  Grande, Chiquito, Caliente, Frío, Bonito, Feo, Sucio, Limpio, Rojo, Azul, Verde, Amarillo, Rosa, Negro, Blanco,
  Comer, Dormir, Jugar, Bañar, Caminar, Correr, Saltar, Abrir, Cerrar, Ver, Lavar, Ayuda,
`);

const POLISH = list(`
  Mama, Tata, Babcia, Dziadek, Dziadzia, Ciocia, Wujek, Brat, Siostra, Dzidzia, Dziecko, Pani, Pan,
  Hau hau, Miau, Muu, Kwa kwa, Kukuryku, Ko ko, Ihaha, Brum brum, Ciuch ciuch, Bum, Am am, Mniam, Fuj, Aua, Ała, Bęc,
  Kot, Kotek, Pies, Piesek, Kaczka, Krowa, Koń, Konik, Świnka, Owca, Kura, Kogut, Ptak, Ptaszek, Ryba, Rybka, Miś, Lew, Tygrys, Słoń, Małpa, Żyrafa, Zając, Królik, Mysz, Żaba, Motyl, Pszczoła, Biedronka, Żółw, Wąż, Dinozaur,
  Mleko, Woda, Sok, Chleb, Bułka, Jabłko, Banan, Jajko, Ser, Zupa, Kaszka, Ciastko, Cukierek, Lody, Owoce, Marchewka, Ziemniak, Makaron, Mięso, Herbata, Jogurt,
  Piłka, But, Buty, Czapka, Skarpetki, Kurtka, Spodnie, Pielucha, Smoczek, Butelka, Kubek, Łyżka, Talerz, Miska, Samochód, Auto, Autobus, Pociąg, Samolot, Rower, Traktor, Łódka, Książka, Lalka, Zabawka, Balon, Klocki, Dom, Łóżko, Krzesło, Stół, Drzwi, Okno, Światło, Lampa, Wanna, Kąpiel, Telefon, Klucze, Śmieci, Szkoła, Przedszkole, Sklep, Plac zabaw, Spacer, Na dwór,
  Oko, Oczy, Nos, Buzia, Ręka, Rączka, Noga, Nóżka, Brzuszek, Włosy, Głowa, Ucho, Ząbki, Palec,
  Cześć, Pa pa, Dzień dobry, Dobranoc, Dziękuję, Proszę, Tak, Nie, Jeszcze, Daj, Masz, Chodź, Patrz, Tu, Tam, To, Gdzie, Nie ma, Jest, Koniec, Sam, Sama, Moje, Mój, Buziak, Przepraszam, Hop, Siku, Kupa,
  Duży, Mały, Gorące, Zimne, Ładne, Brudne, Czerwony, Niebieski, Zielony, Żółty, Dobre, Be, Ojej,
  Jeść, Pić, Spać, Idziemy, Siadaj, Myć, Otwórz, Zamknij, Pomóż, Chcę, Śpiewać, Tańczyć,
`);

/**
 * Every language's words, once each. A word two lists share ("Mama",
 * "Pan", "Miau"), or that only differs by an accent or a plural ("Mamá"),
 * is one entry: it's the duplicate check's own rule (`nameKey`), so the
 * dropdown never offers two spellings of a single saved word.
 */
export const WORD_SUGGESTIONS: readonly string[] = (() => {
  const seen = new Set<string>();
  return [...ENGLISH, ...SPANISH, ...POLISH]
    .filter((w) => {
      const key = nameKey(w);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b));
})();
