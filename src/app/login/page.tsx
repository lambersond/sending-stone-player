import { redirect } from 'next/navigation'
import { enabledSocialProviders } from '@/auth-providers'
import { SignInButtons } from '@/components/sign-in-buttons'
import { getCurrentUser } from '@/lib/session'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  if (await getCurrentUser()) redirect('/characters')

  // Set by Better Auth when it sends someone back here from a failed sign-in.
  const { error } = await searchParams
  const providers = enabledSocialProviders()

  return (
    <div className='flex flex-1 items-center justify-center px-4 py-16'>
      <div className='w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8'>
        <h1 className='text-2xl font-semibold tracking-tight'>Sign in</h1>
        <p className='mt-2 text-text-secondary'>
          Sign in to choose a character and follow your game.
        </p>
        {error && (
          <p role='alert' className='mt-4 text-sm text-danger'>
            That sign-in did not go through. Try again.
          </p>
        )}
        <div className='mt-6'>
          {providers.length > 0 ? (
            <SignInButtons providers={providers} callbackURL='/characters' />
          ) : (
            <p className='rounded-xl border border-dashed border-border p-4 text-sm text-text-secondary'>
              No sign-in providers are set up yet. Set{' '}
              <code className='font-mono'>AUTH_GOOGLE_ENABLED</code> or{' '}
              <code className='font-mono'>AUTH_DISCORD_ENABLED</code> to{' '}
              <code className='font-mono'>true</code> with that provider&apos;s
              credentials.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
