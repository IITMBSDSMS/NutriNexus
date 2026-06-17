/**
 * deduplicate_fooddata.js
 * ────────────────────────────────────────────────────────────────────
 * Collapses byte-identical duplicate entries in foodData.js.
 * Strategy: EXACT field-match only (name + energy + protein + carb + fat).
 * Legitimately distinct near-duplicates (same name, different values) are PRESERVED.
 * Aliases from all duplicates are MERGED (union) into the surviving entry.
 * IFCT food codes and formNotes (if present) are also preserved.
 * ────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, '..', 'foodData.js');
const OUTPUT = path.join(__dirname, '..', 'foodData.js');

// ── 1. Read raw file and extract the array ────────────────────────────────────
const raw = fs.readFileSync(INPUT, 'utf8');

// Strip the JS module wrapper to get valid JSON-like content
// foodData.js exports: const foodData = [...]; ... module.exports = foodData;
// We eval it in a controlled sandbox
const vm = require('vm');
const sandbox = { module: { exports: {} } };
vm.createContext(sandbox);
vm.runInContext(raw, sandbox);
const data = sandbox.module.exports;

if (!Array.isArray(data)) {
  console.error('ERROR: foodData.js did not export an array. Aborting.');
  process.exit(1);
}

console.log(`\n📂  Loaded ${data.length} total entries from foodData.js`);

// ── 2. Deduplicate with alias merging ─────────────────────────────────────────
// Key = name | energy | protein | carb | fat  (ALL exact, no rounding)
const canonical = new Map(); // key → entry index in result[]
const result    = [];

let duplicatesRemoved = 0;

for (const entry of data) {
  const key = [
    entry.name,
    entry.energy,
    entry.protein,
    entry.carb,
    entry.fat
  ].join('|');

  if (canonical.has(key)) {
    // Merge aliases into existing canonical entry
    const existing = result[canonical.get(key)];
    if (Array.isArray(entry.aliases) && entry.aliases.length > 0) {
      const aliasSet = new Set(existing.aliases || []);
      entry.aliases.forEach(a => aliasSet.add(a));
      existing.aliases = Array.from(aliasSet).sort();
    }
    duplicatesRemoved++;
  } else {
    canonical.set(key, result.length);
    // Clone to avoid mutation
    result.push({ ...entry, aliases: Array.isArray(entry.aliases) ? [...entry.aliases] : [] });
  }
}

console.log(`✅  Duplicates removed : ${duplicatesRemoved}`);
console.log(`✅  Unique entries kept: ${result.length}`);

// ── 3. Serialise back to JS module format ─────────────────────────────────────
function serialize(arr) {
  const lines = ['const foodData = ['];
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i];
    const comma = i < arr.length - 1 ? ',' : '';

    // Build aliases string
    const aliasStr = JSON.stringify(e.aliases || []);

    // Optional fields
    const ifctCode = e.ifctCode ? `\n    ifctCode: ${JSON.stringify(e.ifctCode)},` : '';
    const formNote = e.formNote ? `\n    formNote: ${JSON.stringify(e.formNote)},` : '';

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
    servingUnit: ${JSON.stringify(e.servingUnit)},${ifctCode}${formNote}
    aliases: ${aliasStr}
  }${comma}`
    );
  }
  lines.push('];');
  lines.push('');
  lines.push('if (typeof module !== \'undefined\' && module.exports) {');
  lines.push('  module.exports = foodData;');
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

const output = serialize(result);
fs.writeFileSync(OUTPUT, output, 'utf8');

console.log(`\n💾  Written ${result.length} entries → foodData.js`);
console.log(`    File size: ${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(2)} MB\n`);

// ── 4. Verification pass ──────────────────────────────────────────────────────
const vm2 = require('vm');
const sandbox2 = { module: { exports: {} } };
vm2.createContext(sandbox2);
vm2.runInContext(fs.readFileSync(OUTPUT, 'utf8'), sandbox2);
const verify = sandbox2.module.exports;

if (!Array.isArray(verify) || verify.length !== result.length) {
  console.error('❌  VERIFICATION FAILED — output file does not load correctly.');
  process.exit(1);
}
console.log(`🔍  Verification passed: ${verify.length} entries load correctly from output.`);
