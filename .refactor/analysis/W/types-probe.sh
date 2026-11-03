#!/usr/bin/env bash
# Map W: which hand-written types equal their zod schema's output (z.infer), checked by tsc on a
# scratch copy of the schema files (every schema const exported there; the app is not edited).
# Usage: bash .refactor/analysis/W/types-probe.sh <scratch-dir>   (prints one line per pair)
# exact = identical types; mutual = each assignable to the other; hand<schema / schema<hand = one way.
set -euo pipefail
APP="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="${1:?scratch dir}"
mkdir -p "$OUT/probe"
ln -sfn "$APP/node_modules" "$OUT/probe/node_modules"
P="$OUT/probe"
for f in sending-stone roll-request notes cookbook foundry-settings; do
  sed -E 's/^const (\w+) = /export const \1 = /; s/^\}\) as unknown as z\.ZodType<RollRequestInput>/})/' \
    "$APP/src/schemas/$f.ts" > "$P/$f.ts"
done
# The copies import each other by '@/schemas/…'; point those at the copies.
sed -i -E "s#'@/schemas/(sending-stone|foundry-settings)'#'./\1'#" "$P"/*.ts
cat > "$P/tsconfig.json" <<EOF
{ "extends": "$APP/tsconfig.json", "compilerOptions": { "incremental": false, "noEmit": true, "plugins": [] },
  "include": ["$APP/next-env.d.ts", "check.ts"] }
EOF
PAIRS='
SheetInventory:sending-stone:inventorySchema
CombatantSummary:sending-stone:combatantSchema
CombatSnapshot:sending-stone:combatSchema
RollSummary:sending-stone:rollSchema
CharacterSheet:sending-stone:sheetSchema
SerializedMessage:sending-stone:messageSchema
BridgeFeatures:sending-stone:featuresSchema
CommandResult:sending-stone:commandResultSchema
GamePrompt:sending-stone:promptSchema
JournalPage:sending-stone:journalPageSchema
JournalUpdated:sending-stone:journalUpdatedSchema
CompanionEntry:sending-stone:companionEntrySchema
ConnectedCharacter:sending-stone:characterSchema
DishApplied:sending-stone:dishAppliedSchema
DishDismissed:sending-stone:dishDismissedSchema
DamagePreview:sending-stone:damagePreviewSchema
SheetEffect:sending-stone:effectSchema
SheetSpell:sending-stone:spellSchema
SheetAction:sending-stone:actionSchema
SheetItem:sending-stone:itemSchema
SheetCreature:sending-stone:creatureSchema
SheetForm:sending-stone:formSchema
KnownForm:sending-stone:knownFormSchema
SheetWildShape:sending-stone:wildShapeSchema
SheetFavorite:sending-stone:favoriteSchema
SheetFeature:sending-stone:featureSchema
SheetCondition:sending-stone:conditionSchema
SheetEnchant:sending-stone:enchantSchema
SheetUse:sending-stone:useSchema
SheetUses:sending-stone:usesSchema
SheetCheck:sending-stone:checkSchema
SheetCheckOption:sending-stone:checkOptionSchema
SheetForward:sending-stone:forwardSchema
SheetCastLevel:sending-stone:castLevelSchema
SheetWithheld:sending-stone:sheetWithheldSchema
BeastEntry:sending-stone:beastSchema
SheetEffectDie:sending-stone:effectDieSchema
Envelope:sending-stone:envelopeSchema
AskedCheck:sending-stone:askedCheckSchema
Dnd5eTarget:sending-stone:targetSchema
Dnd5eMessageData:sending-stone:dnd5eSchema
MessageAsk:sending-stone:askSchema
SheetCounter:sending-stone:counterSchema
RollRequestInput:roll-request:rollRequestSchema
NoteInput:notes:noteInputSchema
NoteChange:notes:noteChangeSchema
NoteResolve:notes:noteResolveSchema
NoteOrder:notes:noteOrderSchema
NoteOrderResolve:notes:noteOrderResolveSchema
CookbookDishBody:cookbook:cookbookDishSchema
FoundrySettings:foundry-settings:resultSchema
'
typesOf() { case "$1" in
  sending-stone) echo sending-stone;; roll-request) echo roll;; notes) echo notes;; cookbook) echo cookbook;; foundry-settings) echo foundry-settings;; esac; }
{
  echo "import type { z } from 'zod'"
  echo "type Eq<A, B> = (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? 'exact' : [A] extends [B] ? ([B] extends [A] ? 'mutual' : 'hand<schema') : [B] extends [A] ? 'schema<hand' : 'differs'"
  for p in $PAIRS; do
    IFS=: read -r T F S <<<"$p"
    echo "import type { $T as T_$T } from '@/types/$(typesOf "$F")'"
    echo "import type { $S as S_${F//-/_}_$S } from './$F'"
  done
  for p in $PAIRS; do
    IFS=: read -r T F S <<<"$p"
    echo "export const r_$T: Eq<T_$T, z.output<typeof S_${F//-/_}_$S>> = 'probe'"
  done
} > "$P/check.ts"
cd "$P"
"$APP/node_modules/.bin/tsc" -p tsconfig.json 2>&1 | grep -oE "check\.ts\([0-9]+,[0-9]+\): error TS2322: Type '\"probe\"' is not assignable to type '[^']*'" \
  | sed -E "s/check\.ts\(([0-9]+),.*type '\"?([^\"']*)\"?'/\1 \2/" > "$P/result.txt" || true
total=$(grep -c '^export const r_' check.ts)
first=$(grep -n '^export const r_' check.ts | head -1 | cut -d: -f1)
while read -r line verdict; do
  name=$(sed -n "${line}p" check.ts | sed -E 's/export const r_(\w+):.*typeof S_\w+?_(\w+)>.*/\1 \2/')
  echo "$verdict $name"
done < "$P/result.txt" | sort
echo "pairs: $total"
