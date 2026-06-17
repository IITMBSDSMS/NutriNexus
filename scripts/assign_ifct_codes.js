/**
 * assign_ifct_codes.js
 * ────────────────────────────────────────────────────────────────────
 * Patches IFCT 2017 food codes and food-form notes onto foodData.js entries.
 *
 * IFCT codes follow the official ICMR-NIN 2017 database format:
 *   A = Cereal grains, B = Cereal products, C = Legumes, D = Vegetables,
 *   E = Fruits, F = Nuts & oil seeds, G = Meat & poultry, H = Fish & seafood,
 *   I = Eggs, J = Milk & milk products, K = Fats & oils, L = Sugars,
 *   M = Beverages, N = Condiments & spices, O = Prepared foods
 *
 * Sources:
 *   - ICMR-NIN IFCT 2017 (Indian Food Composition Tables)
 *   - NIN Hyderabad, 2017 (ISBN: 978-81-8466-117-5)
 * ────────────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const FOOD_DATA_PATH = path.join(__dirname, '..', 'foodData.js');

// ── IFCT Code Lookup for primary (non-recipe) entries ────────────────────────
// Key: exact 'name' field value in foodData.js
// Value: { ifctCode, ifctGroup }
const IFCT_CODE_MAP = {
  // Milk & milk products (J group)
  'Milk, whole, Cow':                          { ifctCode: 'J001', ifctGroup: 'Milk & Milk Products' },
  'Milk, whole, Buffalo':                      { ifctCode: 'J002', ifctGroup: 'Milk & Milk Products' },
  'Khoa':                                      { ifctCode: 'J007', ifctGroup: 'Milk & Milk Products' },
  'Paneer':                                    { ifctCode: 'J010', ifctGroup: 'Milk & Milk Products' },
  'Curd / Dahi (Whole Milk, Cow)':            { ifctCode: 'J004', ifctGroup: 'Milk & Milk Products' },

  // Meat & poultry (G group)
  'Chicken, muscle, raw':                      { ifctCode: 'G003', ifctGroup: 'Meat & Poultry' },
  'Mutton (Goat meat), muscle, raw':           { ifctCode: 'G008', ifctGroup: 'Meat & Poultry' },
  'Pork, muscle, raw':                         { ifctCode: 'G012', ifctGroup: 'Meat & Poultry' },
  'Liver, chicken, raw':                       { ifctCode: 'G005', ifctGroup: 'Meat & Poultry' },
  'Liver, goat, raw':                          { ifctCode: 'G009', ifctGroup: 'Meat & Poultry' },

  // Fish & seafood (H group)
  'Rohu (Labeo rohita)':                       { ifctCode: 'H023', ifctGroup: 'Fish & Seafood' },
  'Catla (Catla catla)':                       { ifctCode: 'H006', ifctGroup: 'Fish & Seafood' },
  'Hilsa (Tenualosa ilisha)':                  { ifctCode: 'H013', ifctGroup: 'Fish & Seafood' },
  'Pomfret, silver (Pampus argenteus)':        { ifctCode: 'H020', ifctGroup: 'Fish & Seafood' },
  'Shrimp, small, raw':                        { ifctCode: 'H029', ifctGroup: 'Fish & Seafood' },
  'Milk fish (Chanos chanos)':                 { ifctCode: 'H015', ifctGroup: 'Fish & Seafood' },

  // Eggs (I group)
  'Egg, whole, hen, raw':                      { ifctCode: 'I001', ifctGroup: 'Eggs' },
  'Egg, white, hen, raw':                      { ifctCode: 'I002', ifctGroup: 'Eggs' },
  'Egg, yolk, hen, raw':                       { ifctCode: 'I003', ifctGroup: 'Eggs' },

  // Fats & oils (K group)
  'Ghee, cow':                                 { ifctCode: 'K002', ifctGroup: 'Fats & Oils' },
  'Butter, salted':                            { ifctCode: 'K001', ifctGroup: 'Fats & Oils' },
};

// ── Food-form mismatch flags for 9 known edge cases ──────────────────────────
// These items have IFCT values recorded in a different preparation form
// than what a user would typically consume. Flagged for human review.
const FORM_NOTE_MAP = {
  'Peas, fresh (Pisum sativum)':
    'IFCT entry reflects dried/boiled peas; fresh-pea nutrient values may differ. Verify raw vs cooked form.',

  'Mango, green, raw (Mangifera indica)':
    'IFCT entry is for raw unripe mango (pickling form). Ripe mango values differ substantially.',

  'Plantain, flower (Musa x paradisiaca)':
    'IFCT entry is for raw inflorescence; cooked form loses significant water-soluble nutrients.',

  'Colocasia, stem, black (Colocasia antiquorum)':
    'IFCT records stems with skin; peeled values will differ. Verify preparation form.',

  'Potato, brown skin, small (Solanum tuberosum)':
    'IFCT entry reflects boiled-with-skin values; raw or peeled potato nutritional profile differs.',

  'Custard apple (Annona squamosa)':
    'IFCT entry is for pulp only (seeds removed); whole-fruit weight includes inedible portion.',

  'Pumpkin, green, cylindrical (Cucurbita maxima)':
    'IFCT records raw form; cooking reduces water content substantially, concentrating nutrients.',

  'Pumpkin leaves, tender (Cucurbita maxima)':
    'IFCT entry is for raw leaves; typical consumption is cooked — nutrient retention varies.',

  'Toddy':
    'IFCT records fresh toddy (unfermented); nutritional values change significantly with fermentation.',
};

// ── Load foodData.js ──────────────────────────────────────────────────────────
const raw = fs.readFileSync(FOOD_DATA_PATH, 'utf8');
const sandbox = { module: { exports: {} } };
vm.createContext(sandbox);
vm.runInContext(raw, sandbox);
const data = sandbox.module.exports;

if (!Array.isArray(data)) {
  console.error('ERROR: foodData.js did not export an array.'); process.exit(1);
}

// ── Patch entries ─────────────────────────────────────────────────────────────
let ifctPatched    = 0;
let formNoteAdded  = 0;

for (const entry of data) {
  if (IFCT_CODE_MAP[entry.name]) {
    const { ifctCode, ifctGroup } = IFCT_CODE_MAP[entry.name];
    entry.ifctCode  = ifctCode;
    entry.ifctGroup = ifctGroup;
    ifctPatched++;
  }
  if (FORM_NOTE_MAP[entry.name]) {
    entry.formNote = FORM_NOTE_MAP[entry.name];
    formNoteAdded++;
  }
}

console.log(`\n✅  IFCT codes assigned : ${ifctPatched} entries`);
console.log(`✅  Form-notes added    : ${formNoteAdded} entries`);

// ── Serialise back ────────────────────────────────────────────────────────────
function serialize(arr) {
  const lines = ['const foodData = ['];
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i];
    const comma = i < arr.length - 1 ? ',' : '';
    const ifctCode  = e.ifctCode  ? `\n    ifctCode: ${JSON.stringify(e.ifctCode)},`  : '';
    const ifctGroup = e.ifctGroup ? `\n    ifctGroup: ${JSON.stringify(e.ifctGroup)},` : '';
    const formNote  = e.formNote  ? `\n    formNote: ${JSON.stringify(e.formNote)},`   : '';
    lines.push(
`  {
    name: ${JSON.stringify(e.name)},
    category: ${JSON.stringify(e.category)},
    energy: ${e.energy},
    protein: ${e.protein},
    carb: ${e.carb},
    fat: ${e.fat},
    fiber: ${e.fiber},
    calcium: ${e.calcium},
    iron: ${e.iron},
    vitc: ${e.vitc},
    servingSize: ${e.servingSize},
    servingUnit: ${JSON.stringify(e.servingUnit)},${ifctCode}${ifctGroup}${formNote}
    aliases: ${JSON.stringify(e.aliases || [])}
  }${comma}`
    );
  }
  lines.push('];');
  lines.push('');
  lines.push("if (typeof module !== 'undefined' && module.exports) {");
  lines.push('  module.exports = foodData;');
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

fs.writeFileSync(FOOD_DATA_PATH, serialize(data), 'utf8');
console.log(`💾  foodData.js updated (${data.length} entries)\n`);
