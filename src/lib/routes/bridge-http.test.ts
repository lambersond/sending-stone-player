/**
 * @jest-environment node
 */
import { refuse } from './bridge-http'

const GAME = 'https://my-game.forge-vtt.com'
const request = () =>
  new Request('https://player.example/api/events', {
    method: 'POST',
    headers: { Origin: GAME },
  })

describe('lib/bridge-http', () => {
  describe('refuse', () => {
    it('keeps the status and says why in JSON, with CORS headers', async () => {
      const response = refuse(request(), 404, {
        reason: 'notSetUp',
        message: `No campaign is set up for ${GAME} in Sending Stone`,
      })

      expect(response.status).toBe(404)
      expect(response.headers.get('content-type')).toMatch(/^application\/json/)
      expect(response.headers.get('access-control-allow-origin')).toBe(GAME)
      expect(response.headers.get('vary')).toBe('Origin')
      await expect(response.json()).resolves.toEqual({
        reason: 'notSetUp',
        message: `No campaign is set up for ${GAME} in Sending Stone`,
      })
    })

    it('leaves out the extras not given, and keeps those that are', async () => {
      const response = refuse(request(), 400, {
        reason: 'malformed',
        message: 'Malformed chat.cleared',
        type: 'chat.cleared',
        detail: undefined,
        limit: undefined,
        protocol: 0,
      })

      const body = await response.json()
      expect(body).toEqual({
        reason: 'malformed',
        message: 'Malformed chat.cleared',
        type: 'chat.cleared',
        protocol: 0,
      })
      expect(Object.keys(body)).not.toContain('detail')
      expect(Object.keys(body)).not.toContain('limit')
    })

    it("answers with the route's own headers, adding JSON's type, without changing them", async () => {
      const headers = new Headers({
        'Access-Control-Allow-Origin': GAME,
        'Cache-Control': 'no-store',
      })

      const response = refuse(
        request(),
        413,
        { reason: 'tooLarge', message: 'Larger', limit: 4096 },
        headers,
      )

      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('access-control-allow-origin')).toBe(GAME)
      expect(response.headers.get('content-type')).toMatch(/^application\/json/)
      expect(headers.has('content-type')).toBe(false)
      await expect(response.json()).resolves.toEqual({
        reason: 'tooLarge',
        message: 'Larger',
        limit: 4096,
      })
    })
  })
})
