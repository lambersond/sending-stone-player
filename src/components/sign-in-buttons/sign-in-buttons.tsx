'use client'

import { useState, type ComponentType, type SVGProps } from 'react'
import { LoaderCircle } from 'lucide-react'
import { authClient } from '@/clients/auth-client'
import { DiscordIcon, GoogleIcon } from '@/components/icons'
import type { SocialProviderId } from '@/auth-providers'

const PROVIDERS: Record<
  SocialProviderId,
  { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  google: { label: 'Google', Icon: GoogleIcon },
  discord: { label: 'Discord', Icon: DiscordIcon },
}

type Props = {
  providers: SocialProviderId[]
  /** Where to land once signed in. */
  callbackURL: string
}

export function SignInButtons({ providers, callbackURL }: Readonly<Props>) {
  // Stays set after a successful request, while the browser leaves for the provider.
  const [chosen, setChosen] = useState<SocialProviderId>()
  const [failed, setFailed] = useState<SocialProviderId>()

  const signIn = async (provider: SocialProviderId) => {
    setFailed(undefined)
    setChosen(provider)
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL,
      errorCallbackURL: '/login',
    })
    if (error) {
      setChosen(undefined)
      setFailed(provider)
    }
  }

  return (
    <div className='grid gap-3'>
      {providers.map(provider => {
        const { label, Icon } = PROVIDERS[provider]
        return (
          <button
            key={provider}
            type='button'
            onClick={() => signIn(provider)}
            disabled={chosen !== undefined}
            className='inline-flex h-11 items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60'
          >
            {chosen === provider ? (
              <LoaderCircle aria-hidden className='size-5 animate-spin' />
            ) : (
              <Icon className='size-5' />
            )}
            Continue with {label}
          </button>
        )
      })}
      {failed && (
        <p role='alert' className='text-sm text-danger'>
          Could not reach {PROVIDERS[failed].label}. Try again.
        </p>
      )}
    </div>
  )
}
