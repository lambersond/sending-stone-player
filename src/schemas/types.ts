import type { RollRequestInput } from '@/types/roll'

/** Reports what a schema's rule finds wrong: at which field, and why. */
export type Issue = (path: string, message: string) => void

/** One of a roll request's rules: what it finds wrong with the request, each as an issue. */
export type RequestRule = (request: RollRequestInput, issue: Issue) => void
