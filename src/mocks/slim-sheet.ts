/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { characterSheet, TEXTS } from '@/mocks/sending-stone'
import type { CharacterSheet } from '@/types/sending-stone'

// A sheet in full, as module 0.22.0 builds it, and the same sheet in slim format 1, written out by
// hand rather than made by a port of the module's slimSheet: Quill, a wizard with a staff of two
// activities, another staff unequipped, an item not identified yet, nested containers, and
// features that roll and don't. Synthetic: nothing in it comes from a real game.

type Json = Record<string, unknown>

const NO_ROLLS = {
  toHit: null,
  attackId: null,
  activity: null,
  attackModes: null,
  ammunition: null,
  save: null,
}

/** Whom an activity is used at, in full. */
const targets = (fields: Json = {}) => ({
  self: false,
  area: false,
  count: null,
  perLevel: null,
  affects: null,
  ...fields,
})

/** A part of damage, in full. */
const part = (formula: string, fields: Json = {}) => ({
  formula,
  type: null,
  healing: false,
  ...fields,
})

/** A spell's row, in full. */
const spell = (fields: Json & { id: string; name: string }) => ({
  img: null,
  level: 0,
  school: null,
  components: null,
  materials: null,
  concentration: false,
  ritual: false,
  activation: null,
  range: null,
  duration: null,
  target: null,
  prepared: null,
  uses: null,
  castFrom: null,
  text: null,
  ...fields,
})

/** An item's row, in full. */
const item = (fields: Json & { id: string; name: string }) => ({
  img: null,
  type: 'loot',
  quantity: 1,
  weight: null,
  price: null,
  equipped: null,
  attunement: null,
  attuned: false,
  uses: null,
  rarity: null,
  properties: [],
  identified: true,
  text: null,
  ...fields,
})

/** A container's row, in full. */
const container = (fields: Json & { id: string; name: string }) => ({
  ...item({ type: 'container', ...fields }),
  capacity: null,
  contents: null,
  ...fields,
})

/** A feature's row, in full. */
const feature = (fields: Json & { id: string; name: string }) => ({
  img: null,
  kind: null,
  requirements: null,
  activation: null,
  passive: false,
  uses: null,
  text: null,
  ...fields,
})

/** One of an item's activities, in full. */
const entry = (fields: Json & { id: string; name: string; type: string }) => ({
  activation: null,
  activationType: null,
  range: null,
  target: null,
  uses: null,
  ...NO_ROLLS,
  damage: [],
  ...fields,
})

/** An item's rolls, where it rolls: its usage, then what it rolls. */
const itemRolls = (fields: Json = {}) => ({
  activation: null,
  range: null,
  target: null,
  concentration: false,
  ...NO_ROLLS,
  damage: [],
  ...fields,
})

/** An action's keys that aren't its row's, in full. */
const actionOf = (fields: Json & { id: string; name: string }) => ({
  img: null,
  type: 'feat',
  activation: null,
  activationType: null,
  range: null,
  target: null,
  ...NO_ROLLS,
  damage: [],
  uses: null,
  level: null,
  castFrom: null,
  concentration: false,
  identified: true,
  text: null,
  ...fields,
})

const STAFF_DAMAGE = [part('1d6 + 2', { type: 'Bludgeoning' })]
const STAFF_MODES = [
  { value: 'oneHanded', label: 'One-Handed' },
  { value: 'twoHanded', label: 'Two-Handed' },
]
const EMBERS_USES = { value: 3, max: 3, recovery: 'Dawn' }
const MISSILE_USE = {
  id: 'missileDamage',
  type: 'damage',
  targets: targets({ count: 3, perLevel: 1, affects: 'creature' }),
}
const FLAME_STEP_USE = {
  id: 'flameStep',
  type: 'utility',
  targets: targets({ self: true }),
}
const CONE_USE = {
  id: 'coneCast',
  type: 'save',
  targets: targets({ area: true }),
}
const CONE_CAST = { level: 5, concentration: false, charges: 3, short: false }

/** The staff of embers' activities, in full: its attack, then Fire Bolt. */
const EMBERS_ACTIVITIES = [
  entry({
    id: 'embersAttack',
    name: 'Attack',
    type: 'attack',
    activation: 'Action',
    activationType: 'action',
    range: '5 ft',
    toHit: 5,
    attackId: 'embersAttack',
    damage: [part('1d6 + 1', { type: 'Bludgeoning' })],
  }),
  entry({
    id: 'fireBolt',
    name: 'Fire Bolt',
    type: 'attack',
    activation: 'Action',
    activationType: 'action',
    range: '120 ft',
    toHit: 5,
    attackId: 'fireBolt',
    damage: [part('2d10', { type: 'Fire' })],
    uses: EMBERS_USES,
  }),
  entry({
    id: 'flameStep',
    name: 'Flame Step',
    type: 'utility',
    activation: '1 Bonus Action',
    activationType: 'bonus',
    range: 'Self',
    activity: FLAME_STEP_USE,
  }),
]

/** Quill's sheet in full, as the module builds it. */
export function quillSheet(): CharacterSheet {
  return characterSheet({
    spells: [
      {
        id: 'spell0',
        label: 'Cantrips',
        slots: null,
        spells: [
          spell({
            id: 'detect',
            name: 'Detect Magic',
            level: 1,
            school: 'Divination',
            components: 'V, S',
            concentration: true,
            ritual: true,
            activation: '1 Action',
            range: 'Self',
            duration: '10 Minutes',
            prepared: 0,
            text: TEXTS.bless,
          }),
        ],
      },
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: 2, max: 4, level: 1 },
        spells: [
          spell({
            id: 'missile',
            name: 'Magic Missile',
            level: 1,
            school: 'Evocation',
            components: 'V, S',
            activation: '1 Action',
            range: '120 ft',
            duration: 'Instantaneous',
            target: '3 creatures',
            prepared: 1,
            ...NO_ROLLS,
            activity: MISSILE_USE,
            damage: [part('1d4 + 1', { type: 'Force' })],
          }),
          spell({
            id: 'coneCopy',
            name: 'Cone of Cold',
            level: 5,
            castFrom: { id: 'frost', name: 'Staff of Frost', usable: false },
          }),
        ],
      },
    ],
    inventory: {
      sections: [
        {
          id: 'weapons',
          label: 'Weapons',
          items: [
            item({
              id: 'staff',
              name: 'Quarterstaff',
              type: 'weapon',
              weight: { value: 4, units: 'lb' },
              price: '2 SP',
              equipped: true,
              properties: ['Versatile'],
              ...itemRolls({
                activation: 'Action',
                range: '5 ft',
                toHit: 4,
                attackId: 'staffAttack',
                attackModes: STAFF_MODES,
                damage: STAFF_DAMAGE,
              }),
              text: TEXTS.warhammer,
            }),
            item({
              id: 'embers',
              name: 'Staff of Embers',
              type: 'weapon',
              equipped: true,
              attunement: 'required',
              attuned: true,
              uses: EMBERS_USES,
              rarity: 'Rare',
              ...itemRolls({
                activation: 'Action',
                range: '5 ft',
                toHit: 5,
                attackId: 'embersAttack',
                damage: [part('1d6 + 1', { type: 'Bludgeoning' })],
                activities: EMBERS_ACTIVITIES,
              }),
            }),
            item({
              id: 'frost',
              name: 'Staff of Frost',
              type: 'weapon',
              equipped: false,
              ...itemRolls({
                activation: 'Action',
                range: '5 ft',
                toHit: 3,
                attackId: 'frostAttack',
                damage: [part('1d6', { type: 'Bludgeoning' })],
                activities: [
                  entry({
                    id: 'frostAttack',
                    name: 'Attack',
                    type: 'attack',
                    activation: 'Action',
                    activationType: 'action',
                    range: '5 ft',
                    toHit: 3,
                    attackId: 'frostAttack',
                    damage: [part('1d6', { type: 'Bludgeoning' })],
                  }),
                  entry({
                    id: 'coneCast',
                    name: 'Cone of Cold',
                    type: 'cast',
                    activation: 'Action',
                    activationType: 'action',
                    range: 'Self',
                    target: '60 ft cone',
                    activity: CONE_USE,
                    save: { ability: 'CON', dc: 15 },
                    damage: [part('8d8', { type: 'Cold' })],
                    cast: CONE_CAST,
                  }),
                ],
              }),
            }),
          ],
        },
        {
          id: 'consumables',
          label: 'Consumables',
          items: [
            // Not identified yet: it keeps its rolls to itself.
            item({
              id: 'potion',
              name: 'Murky Potion',
              type: 'consumable',
              identified: false,
              ...itemRolls({ activation: 'Action' }),
            }),
          ],
        },
      ],
      containers: [
        container({
          id: 'backpack',
          name: 'Backpack',
          equipped: false,
          capacity: { value: 7, max: 30, units: 'lb' },
          contents: [
            item({ id: 'rope', name: 'Rope', quantity: 2, text: TEXTS.rope }),
            container({
              id: 'pouch',
              name: 'Pouch',
              contents: [
                item({
                  id: 'wand',
                  name: 'Wand of Sparks',
                  type: 'consumable',
                  uses: { value: 2, max: 7, recovery: 'Dawn' },
                  ...itemRolls({
                    activation: 'Action',
                    range: '60 ft',
                    toHit: 5,
                    attackId: 'sparks',
                    damage: [part('2d6', { type: 'Lightning' })],
                  }),
                }),
              ],
            }),
          ],
          text: TEXTS.backpack,
        }),
        // Empty, which isn't secret, and secret.
        container({ id: 'chest', name: 'Chest', contents: [] }),
        container({ id: 'box', name: 'Puzzle Box', identified: false }),
      ],
      currency: [{ id: 'gp', label: 'Gold', abbreviation: 'GP', value: 12 }],
      encumbrance: null,
      attunement: { value: 1, max: 3 },
    },
    features: [
      {
        id: 'wizard',
        label: 'Wizard',
        text: null,
        features: [
          feature({
            id: 'recovery',
            name: 'Arcane Recovery',
            kind: 'Class Feature',
            requirements: 'Wizard 1',
            uses: { value: 1, max: 1, recovery: 'Long Rest' },
          }),
          feature({
            id: 'wind',
            name: 'Second Wind',
            kind: 'Class Feature',
            activation: '1 Bonus Action',
            range: 'Self',
            target: null,
            concentration: false,
            ...NO_ROLLS,
            activity: {
              id: 'windHeal',
              type: 'heal',
              targets: targets({ self: true }),
            },
            damage: [part('1d10 + 5', { type: 'Healing', healing: true })],
            text: TEXTS.secondWind,
          }),
          feature({
            id: 'surge',
            name: 'Action Surge',
            kind: 'Class Feature',
            activation: 'Free',
            passive: false,
            range: null,
            target: null,
            concentration: false,
            ...NO_ROLLS,
            activity: {
              id: 'surgeUse',
              type: 'utility',
              targets: targets({ self: true }),
            },
            damage: [],
          }),
        ],
      },
    ],
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          actionOf({
            id: 'staff',
            name: 'Quarterstaff',
            type: 'weapon',
            activation: 'Action',
            activationType: 'action',
            range: '5 ft',
            toHit: 4,
            attackId: 'staffAttack',
            attackModes: STAFF_MODES,
            damage: STAFF_DAMAGE,
            consumable: false,
            text: TEXTS.warhammer,
          }),
          actionOf({
            id: 'embers',
            name: 'Staff of Embers',
            type: 'weapon',
            activation: 'Action',
            activationType: 'action',
            range: '5 ft',
            toHit: 5,
            attackId: 'embersAttack',
            damage: [part('1d6 + 1', { type: 'Bludgeoning' })],
            activities: EMBERS_ACTIVITIES.slice(0, 2),
            uses: EMBERS_USES,
          }),
          actionOf({
            id: 'missile',
            name: 'Magic Missile',
            type: 'spell',
            activation: '1 Action',
            activationType: 'action',
            range: '120 ft',
            target: '3 creatures',
            activity: MISSILE_USE,
            damage: [part('1d4 + 1', { type: 'Force' })],
            level: 1,
          }),
          // The unequipped staff's one Cast: without the staff's activities.
          actionOf({
            id: 'frost',
            name: 'Staff of Frost',
            type: 'weapon',
            activityName: 'Cone of Cold',
            activation: 'Action',
            activationType: 'action',
            range: 'Self',
            target: '60 ft cone',
            activity: CONE_USE,
            save: { ability: 'CON', dc: 15 },
            damage: [part('8d8', { type: 'Cold' })],
            cast: CONE_CAST,
          }),
          actionOf({
            id: 'potion',
            name: 'Murky Potion',
            type: 'consumable',
            activation: 'Action',
            activationType: 'action',
            identified: false,
            consumable: true,
          }),
          actionOf({
            id: 'wand',
            name: 'Wand of Sparks',
            type: 'consumable',
            activation: 'Action',
            activationType: 'action',
            range: '60 ft',
            toHit: 5,
            attackId: 'sparks',
            damage: [part('2d6', { type: 'Lightning' })],
            uses: { value: 2, max: 7, recovery: 'Dawn' },
            consumable: true,
          }),
          // A class item Tidy 5e lists, in no tab: sent whole.
          actionOf({
            id: 'wizardClass',
            name: 'Wizard',
            type: 'class',
            activation: 'Action',
            activity: { id: 'study', type: 'utility', targets: targets() },
            damage: [part('1d4')],
          }),
        ],
      },
      {
        id: 'bonus',
        label: 'Bonus Actions',
        actions: [
          // The staff again, for its activity of another kind: its own row in this section.
          actionOf({
            id: 'embers',
            name: 'Staff of Embers',
            type: 'weapon',
            activityName: 'Flame Step',
            activation: '1 Bonus Action',
            activationType: 'bonus',
            range: 'Self',
            activity: FLAME_STEP_USE,
            activities: [EMBERS_ACTIVITIES[2]],
            uses: EMBERS_USES,
          }),
          actionOf({
            id: 'wind',
            name: 'Second Wind',
            activation: '1 Bonus Action',
            activationType: 'bonus',
            range: 'Self',
            activity: {
              id: 'windHeal',
              type: 'heal',
              targets: targets({ self: true }),
            },
            damage: [part('1d10 + 5', { type: 'Healing', healing: true })],
            text: TEXTS.secondWind,
          }),
        ],
      },
    ],
    favorites: [
      {
        type: 'item',
        id: 'staff',
        itemType: 'weapon',
        name: 'Quarterstaff',
        img: null,
      },
      {
        type: 'activity',
        id: 'fireBolt',
        itemId: 'embers',
        itemType: 'weapon',
        itemName: 'Staff of Embers',
        name: 'Fire Bolt',
        img: null,
        activation: 'Action',
        activationType: 'action',
        range: '120 ft',
        target: null,
        toHit: 5,
        attackId: 'fireBolt',
        activity: null,
        attackModes: null,
        ammunition: null,
        save: null,
        damage: [part('2d10', { type: 'Fire' })],
        uses: EMBERS_USES,
      },
      {
        type: 'activity',
        id: 'windHeal',
        itemId: 'wind',
        itemType: 'feat',
        itemName: 'Second Wind',
        name: 'Second Wind',
        img: null,
        activation: '1 Bonus Action',
        range: 'Self',
        target: null,
        toHit: null,
        activity: {
          id: 'windHeal',
          type: 'heal',
          targets: targets({ self: true }),
        },
        save: null,
        damage: [part('1d10 + 5', { type: 'Healing', healing: true })],
        uses: { value: 1, max: 1, recovery: 'Short Rest' },
      },
    ],
  } as unknown as Partial<CharacterSheet>)
}

/** The staff of embers' activities, slim: what isn't each one's default. */
const SLIM_EMBERS_ACTIVITIES = [
  {
    id: 'embersAttack',
    name: 'Attack',
    type: 'attack',
    activation: 'Action',
    activationType: 'action',
    range: '5 ft',
    toHit: 5,
    attackId: 'embersAttack',
    damage: [{ formula: '1d6 + 1', type: 'Bludgeoning' }],
  },
  {
    id: 'fireBolt',
    name: 'Fire Bolt',
    type: 'attack',
    activation: 'Action',
    activationType: 'action',
    range: '120 ft',
    toHit: 5,
    attackId: 'fireBolt',
    damage: [{ formula: '2d10', type: 'Fire' }],
    uses: EMBERS_USES,
  },
  {
    id: 'flameStep',
    name: 'Flame Step',
    type: 'utility',
    activation: '1 Bonus Action',
    activationType: 'bonus',
    range: 'Self',
    activity: { id: 'flameStep', type: 'utility', targets: { self: true } },
  },
]

/** Quill's sheet in slim format 1, as module 0.22.0 sends it. */
export function slimQuillSheet(): Json {
  const full = quillSheet()
  return {
    ...full,
    slim: 1,
    spells: [
      {
        id: 'spell0',
        label: 'Cantrips',
        slots: null,
        spells: [
          // It rolls nothing, so it has none of what rolling takes.
          {
            id: 'detect',
            name: 'Detect Magic',
            level: 1,
            school: 'Divination',
            components: 'V, S',
            concentration: true,
            ritual: true,
            activation: '1 Action',
            range: 'Self',
            duration: '10 Minutes',
            prepared: 0,
            text: TEXTS.bless,
          },
        ],
      },
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: 2, max: 4, level: 1 },
        spells: [
          {
            id: 'missile',
            name: 'Magic Missile',
            level: 1,
            school: 'Evocation',
            components: 'V, S',
            activation: '1 Action',
            range: '120 ft',
            duration: 'Instantaneous',
            target: '3 creatures',
            prepared: 1,
            activity: {
              id: 'missileDamage',
              type: 'damage',
              targets: { count: 3, perLevel: 1, affects: 'creature' },
            },
            damage: [{ formula: '1d4 + 1', type: 'Force' }],
          },
          {
            id: 'coneCopy',
            name: 'Cone of Cold',
            level: 5,
            castFrom: { id: 'frost', name: 'Staff of Frost', usable: false },
          },
        ],
      },
    ],
    inventory: {
      ...full.inventory,
      sections: [
        {
          id: 'weapons',
          label: 'Weapons',
          items: [
            {
              id: 'staff',
              name: 'Quarterstaff',
              type: 'weapon',
              weight: { value: 4, units: 'lb' },
              price: '2 SP',
              equipped: true,
              properties: ['Versatile'],
              activation: 'Action',
              range: '5 ft',
              toHit: 4,
              attackId: 'staffAttack',
              attackModes: STAFF_MODES,
              damage: [{ formula: '1d6 + 2', type: 'Bludgeoning' }],
              text: TEXTS.warhammer,
            },
            {
              id: 'embers',
              name: 'Staff of Embers',
              type: 'weapon',
              equipped: true,
              attunement: 'required',
              attuned: true,
              uses: EMBERS_USES,
              rarity: 'Rare',
              activation: 'Action',
              range: '5 ft',
              toHit: 5,
              attackId: 'embersAttack',
              damage: [{ formula: '1d6 + 1', type: 'Bludgeoning' }],
              activities: SLIM_EMBERS_ACTIVITIES,
            },
            {
              id: 'frost',
              name: 'Staff of Frost',
              type: 'weapon',
              equipped: false,
              activation: 'Action',
              range: '5 ft',
              toHit: 3,
              attackId: 'frostAttack',
              damage: [{ formula: '1d6', type: 'Bludgeoning' }],
              activities: [
                {
                  id: 'frostAttack',
                  name: 'Attack',
                  type: 'attack',
                  activation: 'Action',
                  activationType: 'action',
                  range: '5 ft',
                  toHit: 3,
                  attackId: 'frostAttack',
                  damage: [{ formula: '1d6', type: 'Bludgeoning' }],
                },
                {
                  id: 'coneCast',
                  name: 'Cone of Cold',
                  type: 'cast',
                  activation: 'Action',
                  activationType: 'action',
                  range: 'Self',
                  target: '60 ft cone',
                  activity: {
                    id: 'coneCast',
                    type: 'save',
                    targets: { area: true },
                  },
                  save: { ability: 'CON', dc: 15 },
                  damage: [{ formula: '8d8', type: 'Cold' }],
                  cast: CONE_CAST,
                },
              ],
            },
          ],
        },
        {
          id: 'consumables',
          label: 'Consumables',
          items: [
            // It rolls, with no damage: its damage says so.
            {
              id: 'potion',
              name: 'Murky Potion',
              type: 'consumable',
              identified: false,
              activation: 'Action',
              damage: [],
            },
          ],
        },
      ],
      containers: [
        {
          id: 'backpack',
          name: 'Backpack',
          type: 'container',
          equipped: false,
          capacity: { value: 7, max: 30, units: 'lb' },
          contents: [
            {
              id: 'rope',
              name: 'Rope',
              type: 'loot',
              quantity: 2,
              text: TEXTS.rope,
            },
            {
              id: 'pouch',
              name: 'Pouch',
              type: 'container',
              contents: [
                {
                  id: 'wand',
                  name: 'Wand of Sparks',
                  type: 'consumable',
                  uses: { value: 2, max: 7, recovery: 'Dawn' },
                  activation: 'Action',
                  range: '60 ft',
                  toHit: 5,
                  attackId: 'sparks',
                  damage: [{ formula: '2d6', type: 'Lightning' }],
                },
              ],
            },
          ],
          text: TEXTS.backpack,
        },
        { id: 'chest', name: 'Chest', type: 'container', contents: [] },
        { id: 'box', name: 'Puzzle Box', type: 'container', identified: false },
      ],
    },
    features: [
      {
        id: 'wizard',
        label: 'Wizard',
        text: null,
        features: [
          {
            id: 'recovery',
            name: 'Arcane Recovery',
            kind: 'Class Feature',
            requirements: 'Wizard 1',
            uses: { value: 1, max: 1, recovery: 'Long Rest' },
          },
          {
            id: 'wind',
            name: 'Second Wind',
            kind: 'Class Feature',
            activation: '1 Bonus Action',
            range: 'Self',
            activity: { id: 'windHeal', type: 'heal', targets: { self: true } },
            damage: [{ formula: '1d10 + 5', type: 'Healing', healing: true }],
            text: TEXTS.secondWind,
          },
          {
            id: 'surge',
            name: 'Action Surge',
            kind: 'Class Feature',
            activation: 'Free',
            activity: {
              id: 'surgeUse',
              type: 'utility',
              targets: { self: true },
            },
            damage: [],
          },
        ],
      },
    ],
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          // Where its row lacks a key, the action keeps its own.
          {
            id: 'staff',
            ref: true,
            activationType: 'action',
            level: null,
            castFrom: null,
            consumable: false,
          },
          {
            id: 'embers',
            ref: true,
            activationType: 'action',
            activities: SLIM_EMBERS_ACTIVITIES.slice(0, 2),
            level: null,
            castFrom: null,
          },
          {
            id: 'missile',
            ref: true,
            type: 'spell',
            activationType: 'action',
            identified: true,
          },
          {
            id: 'frost',
            ref: true,
            activityName: 'Cone of Cold',
            activationType: 'action',
            range: 'Self',
            target: '60 ft cone',
            toHit: null,
            attackId: null,
            activity: { id: 'coneCast', type: 'save', targets: { area: true } },
            save: { ability: 'CON', dc: 15 },
            damage: [{ formula: '8d8', type: 'Cold' }],
            cast: CONE_CAST,
            level: null,
            castFrom: null,
            drop: ['activities'],
          },
          {
            id: 'potion',
            ref: true,
            activationType: 'action',
            level: null,
            castFrom: null,
            consumable: true,
          },
          // Its row is in a container in a container.
          {
            id: 'wand',
            ref: true,
            activationType: 'action',
            level: null,
            castFrom: null,
            consumable: true,
          },
          {
            id: 'wizardClass',
            name: 'Wizard',
            img: null,
            type: 'class',
            activation: 'Action',
            activationType: null,
            range: null,
            target: null,
            ...NO_ROLLS,
            activity: { id: 'study', type: 'utility', targets: {} },
            damage: [{ formula: '1d4' }],
            uses: null,
            level: null,
            castFrom: null,
            concentration: false,
            identified: true,
            text: null,
          },
        ],
      },
      {
        id: 'bonus',
        label: 'Bonus Actions',
        actions: [
          {
            id: 'embers',
            ref: true,
            activityName: 'Flame Step',
            activation: '1 Bonus Action',
            activationType: 'bonus',
            range: 'Self',
            toHit: null,
            attackId: null,
            activity: {
              id: 'flameStep',
              type: 'utility',
              targets: { self: true },
            },
            damage: [],
            activities: [SLIM_EMBERS_ACTIVITIES[2]],
            level: null,
            castFrom: null,
          },
          {
            id: 'wind',
            ref: true,
            type: 'feat',
            activationType: 'bonus',
            level: null,
            castFrom: null,
            identified: true,
          },
        ],
      },
    ],
    favorites: [
      {
        type: 'item',
        id: 'staff',
        itemType: 'weapon',
        name: 'Quarterstaff',
        img: null,
      },
      {
        type: 'activity',
        id: 'fireBolt',
        itemId: 'embers',
        itemType: 'weapon',
        itemName: 'Staff of Embers',
        name: 'Fire Bolt',
        img: null,
        activation: 'Action',
        activationType: 'action',
        range: '120 ft',
        target: null,
        toHit: 5,
        attackId: 'fireBolt',
        activity: null,
        attackModes: null,
        ammunition: null,
        save: null,
        damage: [{ formula: '2d10', type: 'Fire' }],
        uses: EMBERS_USES,
      },
      {
        type: 'activity',
        id: 'windHeal',
        itemId: 'wind',
        itemType: 'feat',
        itemName: 'Second Wind',
        name: 'Second Wind',
        img: null,
        activation: '1 Bonus Action',
        range: 'Self',
        target: null,
        toHit: null,
        activity: { id: 'windHeal', type: 'heal', targets: { self: true } },
        save: null,
        damage: [{ formula: '1d10 + 5', type: 'Healing', healing: true }],
        uses: { value: 1, max: 1, recovery: 'Short Rest' },
      },
    ],
  }
}
