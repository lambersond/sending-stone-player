import { render, screen } from '@testing-library/react'
import { Sparkles } from 'lucide-react'
import { SheetTabs } from './sheet-tabs'

describe('features/sheet/character-pane/sheet-tabs', () => {
  it('says one hidden condition in the singular on the Effects tab', () => {
    render(
      <SheetTabs
        rowRef={jest.fn()}
        tabs={[{ id: 'effects', label: 'Effects', icon: Sparkles }]}
        tab='effects'
        idPrefix=''
        conditions={1}
        onShow={jest.fn()}
        settings={{}}
        cookbookModal={null}
      />,
    )

    expect(screen.getByRole('tab').textContent).toBe('Effects, 1 condition')
  })
})
