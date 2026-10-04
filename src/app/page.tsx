import { Gem, MessageSquare, Swords, UserRound } from 'lucide-react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/session'

const STEPS = [
  {
    Icon: Gem,
    title: 'Your Gamemaster connects',
    text: 'They set up the campaign here, connect Foundry, and share an invite link.',
  },
  {
    Icon: UserRound,
    title: 'You choose your character',
    text: "Open the invite link, sign in and pick who you're playing.",
  },
  {
    Icon: Swords,
    title: 'Follow the table',
    text: 'Choose your character to keep up with chat, rolls and combat.',
  },
]

export default async function HomePage() {
  const user = await getCurrentUser()

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col px-4 py-16 sm:py-24'>
      <section className='flex flex-col items-center text-center'>
        <span className='inline-flex rounded-2xl bg-primary/10 p-3 text-primary'>
          <MessageSquare aria-hidden className='size-7' />
        </span>
        <h1 className='mt-6 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl'>
          Your character, wherever you are at the table
        </h1>
        <p className='mt-5 max-w-xl text-lg text-pretty text-text-secondary'>
          Sending Stone follows your Foundry VTT game on The Forge, so you can
          keep up with your character from a phone or a second screen.
        </p>
        <Link
          href={user ? '/characters' : '/login'}
          className='mt-8 inline-flex h-12 items-center rounded-xl bg-primary px-6 font-medium text-on-primary transition-colors hover:bg-primary-hover'
        >
          {user ? 'Choose your character' : 'Sign in to get started'}
        </Link>
      </section>

      <ol className='mt-20 grid gap-4 sm:grid-cols-3'>
        {STEPS.map(({ Icon, title, text }, index) => (
          <li
            key={title}
            className='rounded-2xl border border-border bg-card p-5'
          >
            <div className='flex items-center gap-3'>
              <Icon aria-hidden className='size-5 text-primary' />
              <span className='text-sm font-medium text-text-secondary'>
                Step {index + 1}
              </span>
            </div>
            <h2 className='mt-3 font-semibold'>{title}</h2>
            <p className='mt-1 text-sm text-text-secondary'>{text}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
