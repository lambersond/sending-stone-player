import { render } from '@testing-library/react'
import { useChatScroll } from './use-chat-scroll'

/** The chat's scroller, as the Chat pane holds it. */
function Chat({ inView }: Readonly<{ inView: boolean }>) {
  const { scroller, onScroll } = useChatScroll(inView, [])
  return <div data-testid='chat' ref={scroller} onScroll={onScroll} />
}

/** Each observer's callback, to say the scroller's size changed, as a browser would. */
let resized: () => void

beforeEach(() => {
  jest
    .spyOn(globalThis, 'ResizeObserver')
    .mockImplementation((callback: ResizeObserverCallback) => {
      resized = () => callback([], {} as ResizeObserver)
      return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }
    })
})

afterEach(() => {
  jest.restoreAllMocks()
})

/** The scroller, 600 px of messages in a box 200 px tall, scrolled to `top`. */
function sized(element: HTMLElement, top: number) {
  Object.defineProperty(element, 'scrollHeight', { value: 600 })
  Object.defineProperty(element, 'clientHeight', { value: 200 })
  element.scrollTop = top
}

describe('features/table/hooks/use-chat-scroll', () => {
  it('keeps the newest message in view as the chat shrinks, as when the dice tray opens beneath it (v0.44)', () => {
    const { getByTestId } = render(<Chat inView />)
    const chat = getByTestId('chat')
    sized(chat, 0)
    resized()
    expect(chat.scrollTop).toBe(600)
  })

  it('leaves the chat where the player scrolled up to read', () => {
    const { getByTestId } = render(<Chat inView />)
    const chat = getByTestId('chat')
    sized(chat, 100)
    chat.dispatchEvent(new Event('scroll'))
    resized()
    expect(chat.scrollTop).toBe(100)
  })
})
