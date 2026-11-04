import type { useCookbookView } from '@/features/cookbook/hooks/use-cookbook-view'

/** What the panel shows of the player's book, as its owner reads it. */
export type CookbookRead = ReturnType<typeof useCookbookView>
