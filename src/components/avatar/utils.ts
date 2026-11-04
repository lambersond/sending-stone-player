import { firstLetter } from '@/utils/initials'

export const initial = (name: string) =>
  firstLetter(name.trim()).toUpperCase() || '?'
