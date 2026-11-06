/** Which of its two numbers a field of the hit points editor sets (module 0.44.0). */
export type HitPointsKey = 'value' | 'temp'

/** The editor's two numbers, each as a field has it: what's typed in it, or the number it's at. */
export type HitPointsPair<T> = Record<HitPointsKey, T>
