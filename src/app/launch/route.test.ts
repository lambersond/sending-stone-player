/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { GET, dynamic } from './route'
import { launchDocument } from '@/features/launch/utils'

describe('app/launch', () => {
  it('answers the launch page, whole, with the stone’s image within it', async () => {
    const stone = readFileSync(
      path.join(process.cwd(), 'public/brand/stone-icon-288.png'),
    )

    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    )
    expect(await response.text()).toBe(
      launchDocument(`data:image/png;base64,${stone.toString('base64')}`),
    )
  })

  it('is built once with the app, the same for everyone: it reads nothing of a request', () => {
    expect(dynamic).toBe('force-static')
    expect(GET).toHaveLength(0)
  })
})
