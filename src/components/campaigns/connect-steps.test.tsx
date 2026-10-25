import { render, screen } from '@testing-library/react'
import { ConnectSteps } from './connect-steps'

describe('components/campaigns/connect-steps', () => {
  it('tells a Gamemaster what Foundry lists the module as from 0.37.0, and still finds its settings by its name', () => {
    render(<ConnectSteps destination='https://stone.example' />)
    const [install, settings] = screen.getAllByRole('listitem')

    // From round 0.37.0 §7.13: Foundry's lists show the new title.
    expect(install).toHaveTextContent(
      'From 0.37.0, Foundry lists it as illagria/sending-stone.',
    )
    expect(
      [...install.querySelectorAll('em')].map(name => name.textContent),
    ).toEqual(['illagria/sending-stone'])
    // Its settings' section keeps the module's name (round 0.37.0 §3.1).
    expect(settings).toHaveTextContent(
      'In Configure Settings, choose Open Settings under Sending Stone',
    )
  })
})
