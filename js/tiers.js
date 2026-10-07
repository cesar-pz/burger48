// Burger ladder: each tile value is one more layer on the stack.
// The number of layers on a tile is its exponent: 2^n has n layers.
//
// To use your own artwork, set `icon` to an image path (e.g. "assets/64.png").
// When `icon` is null, the tile falls back to the generated SVG stack.

const TIERS = [
  { value: 2,    key: "bun",       name: "Bottom Bun",   tile: "#FFF3E0", icon: null },
  { value: 4,    key: "lettuce",   name: "Lettuce",      tile: "#EAF6E3", icon: null },
  { value: 8,    key: "patty",     name: "Patty",        tile: "#F6E6DC", icon: null },
  { value: 16,   key: "tomato",    name: "Tomatoes",     tile: "#FDE4E1", icon: null },
  { value: 32,   key: "mushroom",  name: "Mushrooms",    tile: "#F1E8DD", icon: null },
  { value: 64,   key: "pineapple", name: "Pineapple",    tile: "#FFF6CC", icon: null, effect: "pineapple" },
  { value: 128,  key: "pickles",   name: "Pickles",      tile: "#E9F4D8", icon: null },
  { value: 256,  key: "onions",    name: "Onions",       tile: "#F3E8F8", icon: null },
  { value: 512,  key: "cheese",    name: "Cheese",       tile: "#FFF0C7", icon: null },
  { value: 1024, key: "sauce",     name: "Sauce",        tile: "#FFE3D3", icon: null, effect: "sauce" },
  { value: 2048, key: "topbun",    name: "Top Bun",      tile: "#FFD9A8", icon: null },
];

// One sauce is picked at random each game.
const SAUCES = [
  { key: "bbq",       name: "BBQ Sauce",         color: "#9C5A3C" },
  { key: "mayo",      name: "Mayo",              color: "#FFF4D6" },
  { key: "ketchup",   name: "Ketchup",           color: "#E8615A" },
  { key: "thousand",  name: "Thousand Island",   color: "#F6A878" },
];

function tierIndexFor(value) {
  const i = Math.log2(value) - 1;
  return Math.min(i, TIERS.length - 1);
}
