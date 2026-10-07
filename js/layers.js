// Placeholder SVG artwork. Each layer draws itself into a 100-wide box
// between y and y + h; burgerSVG stacks them bottom-up.

const LAYER_HEIGHT = {
  bun: 13, lettuce: 8, patty: 12, tomato: 8, mushroom: 8, pineapple: 8,
  pickles: 7, onions: 7, cheese: 8, sauce: 7, topbun: 22,
};

const LAYERS = {
  bun(y, h) {
    return `
      <rect x="12" y="${y}" width="76" height="${h}" rx="${h * 0.45}" fill="#EDB97A"/>
      <rect x="12" y="${y}" width="76" height="${h / 2}" fill="#EDB97A"/>
      <rect x="12" y="${y}" width="76" height="${Math.max(1.5, h * 0.18)}" fill="#F7D3A2"/>`;
  },
  lettuce(y, h) {
    let d = `M8,${y + h * 0.35} C30,${y - h * 0.1} 70,${y - h * 0.1} 92,${y + h * 0.35} L92,${y + h * 0.55}`;
    for (let x = 92; x > 8; x -= 12) d += ` Q${x - 6},${y + h * 1.15} ${x - 12},${y + h * 0.55}`;
    return `<path d="${d} Z" fill="#A6D89B" stroke="#7FBF74" stroke-width="1"/>`;
  },
  patty(y, h) {
    return `
      <rect x="10" y="${y}" width="80" height="${h}" rx="${h * 0.42}" fill="#A8735A"/>
      <path d="M24,${y + h * 0.4} h8 M44,${y + h * 0.6} h10 M66,${y + h * 0.4} h8"
            stroke="#8A5A44" stroke-width="${h * 0.14}" stroke-linecap="round"/>`;
  },
  tomato(y, h) {
    return [24, 50, 76].map(cx => `
      <ellipse cx="${cx}" cy="${y + h / 2}" rx="14" ry="${h / 2}" fill="#F48A82" stroke="#E06A62" stroke-width="1"/>
      <ellipse cx="${cx}" cy="${y + h / 2}" rx="8" ry="${h / 4}" fill="#F9B3AC"/>`).join("");
  },
  mushroom(y, h) {
    return [20, 40, 60, 80].map(cx => `
      <path d="M${cx - 10},${y + h} A10,${h} 0 0 1 ${cx + 10},${y + h} Z" fill="#D9BC9C" stroke="#BF9D7A" stroke-width="1"/>`).join("");
  },
  pineapple(y, h) {
    return [30, 70].map(cx => `
      <ellipse cx="${cx}" cy="${y + h / 2}" rx="21" ry="${h / 2}" fill="#FFE27A" stroke="#F0C44A" stroke-width="1.2"/>
      <ellipse cx="${cx}" cy="${y + h / 2}" rx="6" ry="${h / 4}" fill="#F3CB55"/>`).join("");
  },
  pickles(y, h) {
    return [18, 34, 50, 66, 82].map(cx => `
      <ellipse cx="${cx}" cy="${y + h / 2}" rx="8" ry="${h / 2}" fill="#B8DB8C" stroke="#8DBB5E" stroke-width="1"/>
      <circle cx="${cx - 2.5}" cy="${y + h / 2}" r="0.9" fill="#7FA650"/>
      <circle cx="${cx + 2.5}" cy="${y + h / 2}" r="0.9" fill="#7FA650"/>`).join("");
  },
  onions(y, h) {
    return [22, 41, 59, 78].map(cx => `
      <ellipse cx="${cx}" cy="${y + h / 2}" rx="11" ry="${h / 2 - 0.8}" fill="none" stroke="#D3B3E6" stroke-width="1.8"/>`).join("");
  },
  cheese(y, h) {
    const top = h * 0.6;
    const drips = [24, 50, 74].map(x =>
      `<path d="M${x - 6},${y + top - 0.5} L${x},${y + h} L${x + 6},${y + top - 0.5} Z" fill="#FFD66B"/>`).join("");
    return `<rect x="9" y="${y}" width="82" height="${top}" rx="1.5" fill="#FFD66B"/>${drips}`;
  },
  sauce(y, h, sauce) {
    const m = y + h / 2;
    const d = `M12,${m} Q21,${y} 30,${m} Q39,${y + h} 48,${m} Q57,${y} 66,${m} Q75,${y + h} 84,${m}`;
    const outline = sauce.key === "mayo" // pale sauce needs an edge to read on a pale tile
      ? `<path d="${d}" fill="none" stroke="#D9C49A" stroke-width="${h * 0.75 + 1.2}" stroke-linecap="round"/>` : "";
    return `${outline}
      <path d="${d}" fill="none" stroke="${sauce.color}" stroke-width="${h * 0.75}" stroke-linecap="round"/>
      <circle cx="39" cy="${y + h + 1}" r="1.6" fill="${sauce.color}"/>
      <circle cx="71" cy="${y + h + 1.5}" r="1.3" fill="${sauce.color}"/>`;
  },
  topbun(y, h) {
    const seeds = [[34, 0.4], [50, 0.28], [66, 0.4], [42, 0.65], [58, 0.65]]
      .map(([x, fy]) =>
        `<ellipse cx="${x}" cy="${y + h * fy}" rx="2.4" ry="1.3" fill="#FFF4DC"/>`).join("");
    return `
      <path d="M10,${y + h} C12,${y - h * 0.18} 88,${y - h * 0.18} 90,${y + h} Z" fill="#EDB97A"/>
      <path d="M10,${y + h} h80" stroke="#D99E5C" stroke-width="1.5"/>${seeds}`;
  },
};

// Full stack for a tier index (0 = bottom bun only, 10 = complete burger).
function burgerSVG(tierIndex, sauce) {
  const keys = TIERS.slice(0, tierIndex + 1).map(t => t.key);
  const natural = keys.reduce((s, k) => s + LAYER_HEIGHT[k], 0);
  const scale = Math.min(1.8, 82 / natural);
  const total = natural * scale;
  let y = 50 + total / 2;
  let body = "";
  for (const k of keys) {
    const h = LAYER_HEIGHT[k] * scale;
    y -= h;
    body += LAYERS[k](y, h, sauce); // upper layers draw last so drips/lettuce hang over
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}
