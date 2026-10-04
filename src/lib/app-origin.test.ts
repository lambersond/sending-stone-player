/**
 * @jest-environment node
 */
import { headers } from 'next/headers'
import { appOrigin } from './app-origin'

jest.mock('next/headers', () => ({ headers: jest.fn() }))

const withHeaders = (values: Record<string, string>) =>
  jest.mocked(headers).mockResolvedValue(new Headers(values) as any)

describe('lib/app-origin', () => {
  it('uses the forwarded host and protocol behind a proxy', async () => {
    withHeaders({
      host: 'internal:3000',
      'x-forwarded-host': 'stone.example',
      'x-forwarded-proto': 'https, http',
    })

    await expect(appOrigin()).resolves.toBe('https://stone.example')
  })

  it('assumes plain http on localhost', async () => {
    withHeaders({ host: 'localhost:3000' })

    await expect(appOrigin()).resolves.toBe('http://localhost:3000')
  })

  it('assumes https anywhere else', async () => {
    withHeaders({ host: 'stone.example' })

    await expect(appOrigin()).resolves.toBe('https://stone.example')
  })
})
