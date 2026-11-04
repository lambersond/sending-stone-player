import { MessageSquare } from 'lucide-react'
import { ChatMessage } from './chat-message'
import { EmptyState } from '@/components/empty-state/empty-state'
import { LocalTime } from '@/components/local-time/local-time'
import type { TableMessage } from '@/types/table'

/**
 * The table's chat, oldest first; while it's empty, that nothing has been said yet, or, since its
 * chat was cleared (v0.44), when, in words true for either seat and either way of clearing.
 * @param clearedAt - When the campaign's chat was last cleared, if it was.
 */
export function ChatLog({
  messages,
  clearedAt,
}: Readonly<{ messages: TableMessage[]; clearedAt?: string }>) {
  if (messages.length === 0) {
    return clearedAt ? (
      <EmptyState icon={MessageSquare} title='Chat cleared'>
        The chat was cleared at <LocalTime value={clearedAt} />. Chat and rolls
        from the table appear here as they happen.
      </EmptyState>
    ) : (
      <EmptyState icon={MessageSquare} title='No messages yet'>
        Chat and rolls from the table appear here as they happen.
      </EmptyState>
    )
  }
  return (
    <ol
      aria-label='Chat log'
      className='mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 @xl:px-8 @xl:py-6'
    >
      {messages.map(message => (
        <li key={message.id}>
          <ChatMessage message={message} />
        </li>
      ))}
    </ol>
  )
}
