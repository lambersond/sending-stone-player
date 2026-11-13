import { LoadingStone } from '@/components/loading-stone/loading-stone'

/**
 * Any page while it loads (v0.48.0), inside the header and footer, which stay: the stone, its
 * rune lighting, in the middle of the page's own background.
 */
export default function Loading() {
  return (
    <div className='flex flex-1 items-center justify-center px-4 py-16'>
      <LoadingStone />
    </div>
  )
}
