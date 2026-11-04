import type { BodyRead, BodyRules } from '@/lib/routes/types'

/**
 * A request's JSON body, read within its route's limit; or why it can't be: not sent as JSON
 * (`type`, where the route asks for it, as a page on another site can't send JSON without asking
 * first), larger than the limit (`size`: refused before reading where the route trusts a declared
 * size, and checked again once read), or no JSON (`json`). Each route answers each as it always
 * has.
 */
export async function readBody(
  request: Request,
  { limit, type, declared = false, reviver }: BodyRules,
): Promise<BodyRead> {
  if (type) {
    const given = request.headers.get('content-type')
    const said = type === 'lower' ? given?.toLowerCase() : given
    if (!said?.startsWith('application/json')) return { ok: false, why: 'type' }
  }
  if (declared && Number(request.headers.get('content-length')) > limit) {
    return { ok: false, why: 'size' }
  }
  const text = await request.text()
  if (Buffer.byteLength(text) > limit) return { ok: false, why: 'size' }
  try {
    return { ok: true, text, value: JSON.parse(text, reviver) }
  } catch {
    return { ok: false, why: 'json' }
  }
}
