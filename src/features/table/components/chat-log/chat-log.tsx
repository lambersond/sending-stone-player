import { MessageSquare } from 'lucide-react'
import { ChatMessage } from './chat-message'
import { EmptyState } from '@/components/empty-state/empty-state'
import type { TableMessage } from '@/types/table'

export function ChatLog({ messages }: Readonly<{ messages: TableMessage[] }>) {
  if (messages.length === 0) {
    return (
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
