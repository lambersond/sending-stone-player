import { AskResult } from './ask-result'
import { CheckResult } from './check-result'
import { DamageResult } from './damage-result'
import { FormulaResult } from './formula-result'
import { GmResult } from './gm-result'
import { UseResult } from './use-result'
import type { TableRolls } from '../../types'
import type { LocalRoll } from '@/types/roll'

/** The latest roll, in full, and its way to the game. */
export function LatestResult({
  roll,
  table,
}: Readonly<{ roll: LocalRoll; table?: TableRolls }>) {
  const state = table?.states.get(roll.id)
  switch (roll.kind) {
    case 'damage': {
      return <DamageResult roll={roll} state={state} />
    }
    case 'formula': {
      return <FormulaResult roll={roll} state={state} />
    }
    case 'ask': {
      return <AskResult roll={roll} state={state} />
    }
    case 'use': {
      return (
        <UseResult
          roll={roll}
          state={state}
          onRollDamage={table?.rollDamage}
          modifies={table?.modifies}
        />
      )
    }
    case 'check': {
      return (
        <CheckResult
          roll={roll}
          state={state}
          onRollDamage={table?.rollDamage}
          modifies={table?.modifies}
        />
      )
    }
    case 'gm': {
      return <GmResult roll={roll} state={state} />
    }
  }
}
