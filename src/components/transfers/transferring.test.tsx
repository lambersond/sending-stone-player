import { render, screen } from '@testing-library/react'
import {
  NO_TRANSFERS,
  Transferring,
  useTransferring,
  type TransferControls,
} from './transferring'

/** What the controls it's given show of the coin. */
function Coins() {
  return <p>{useTransferring().coins?.([]) ?? 'none'}</p>
}

describe('components/transfers/transferring', () => {
  it('gives nothing until a sheet gives its controls, and the nearest sheet’s alone', () => {
    const outer: TransferControls = { coins: () => 'Give coins' }
    const inner: TransferControls = { coins: () => 'Take coins' }
    render(
      <>
        <Coins />
        <Transferring controls={outer}>
          <Coins />
          <Transferring controls={inner}>
            <Coins />
          </Transferring>
          <Transferring controls={NO_TRANSFERS}>
            <Coins />
          </Transferring>
        </Transferring>
      </>,
    )
    expect(screen.getAllByRole('paragraph').map(p => p.textContent)).toEqual([
      'none',
      'Give coins',
      'Take coins',
      'none',
    ])
  })
})
