/**
 * @jest-environment node
 */
/* eslint-disable camelcase -- the Web App Manifest's own names */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import manifest from './manifest'

/** A PNG's size and whether it has an alpha channel, from its header. */
function png(file: string) {
  const data = readFileSync(file)
  expect(data.subarray(1, 4).toString()).toBe('PNG')
  // IHDR: width and height, then bit depth and colour type (2 RGB, 6 RGBA).
  return {
    size: `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,
    alpha: data[25] === 4 || data[25] === 6,
  }
}

const PUBLIC = path.join(process.cwd(), 'public')

describe('app/manifest', () => {
  const app = manifest()

  it('opens from the Home Screen as an app of its own, without the browser’s bars', () => {
    expect(app).toMatchObject({
      id: '/',
      name: 'Sending Stone',
      short_name: 'Sending Stone',
      display: 'standalone',
      start_url: '/characters',
      scope: '/',
    })
    // It opens within what it is the app of.
    expect(app.start_url?.startsWith(app.scope ?? '')).toBe(true)
    expect(app).not.toHaveProperty('display_override')
  })

  it('has the icons an installed app needs, 192 and 512 pixels, and one to mask', () => {
    const icons = app.icons ?? []
    expect(
      icons
        .filter(({ purpose }) => purpose === 'any')
        .map(({ sizes }) => sizes),
    ).toEqual(['192x192', '512x512'])
    expect(icons.filter(({ purpose }) => purpose === 'maskable')).toHaveLength(
      1,
    )
  })

  it.each(manifest().icons ?? [])('has its icon $src, at $sizes', icon => {
    expect(icon.type).toBe('image/png')
    expect(png(path.join(PUBLIC, icon.src)).size).toBe(icon.sizes)
  })

  it('has a maskable icon with no transparency, the stone on its ground to every edge', () => {
    const maskable = (app.icons ?? []).find(
      ({ purpose }) => purpose === 'maskable',
    )
    expect(png(path.join(PUBLIC, maskable?.src ?? '')).alpha).toBe(false)
  })

  it('has an Apple touch icon of 180 pixels with no transparency, which iOS masks itself', () => {
    expect(png(path.join(process.cwd(), 'src/app/apple-icon.png'))).toEqual({
      size: '180x180',
      alpha: false,
    })
  })
})
