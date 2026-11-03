// Mapper R: per area file, the importers outside the area (prod vs test), with names.
// Usage: node .refactor/analysis/R/importers.cjs <graph.json>
const fs = require('fs');
const { graph } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const AREA = [/^src\/components\/dice-entry\//, /^src\/components\/character-sheet\/(roll-tray|roll-button|roll-menu|rolls-button|roll-toasts|modify-roll|d20-rolls|damage-menu)(\.|$)/, /^src\/hooks\/(use-sheet-roller|use-table-rolls|use-roll-toasts|use-rolls-locked|use-hold)(\.|$)/, /^src\/utils\/(effect-dice|typed-dice|faces|formulas|damage-modifiers|dice-modifiers|roll-modifiers|damage-alone|move-words|roll-toasts|roll-mode)(\.|$)/];
const inArea = (f) => AREA.some((r) => r.test(f));
const isTest = (f) => /\.test\.|__tests__|\/mocks\//.test(f);
const by = {};
for (const [f, es] of Object.entries(graph)) for (const e of es) {
  if (!inArea(e.to) || inArea(f)) continue;
  (by[e.to] ||= { prod: {}, test: {} });
  const b = isTest(f) ? by[e.to].test : by[e.to].prod;
  (b[f] ||= new Set());
  e.names.forEach((n) => b[f].add(n));
}
for (const t of Object.keys(by).sort()) {
  console.log(`\n## ${t}`);
  for (const k of ['prod', 'test']) for (const [f, s] of Object.entries(by[t][k])) console.log(`  ${k} ${f}: ${[...s].join(',')}`);
}
