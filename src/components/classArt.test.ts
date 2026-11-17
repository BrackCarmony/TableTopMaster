import { describe, expect, it } from 'vitest'
import { CLASS_TIERS } from '../game/data/classes'
import { CLASS_CAPTION, classSlug } from './classArt'

// Every file in public/classes, as /public/classes/<name>.jpg.
const files = new Set(Object.keys(import.meta.glob('/public/classes/*.jpg')))
const existsSync = (path: string) => files.has(`/${path}`)

const names = Object.values(CLASS_TIERS).flatMap((tiers) => tiers.flatMap((t) => t.names))

describe('class art', () => {
  it('has a portrait, a thumbnail and a caption for every class', () => {
    for (const n of names) {
      expect(existsSync(`public/classes/${classSlug(n)}.jpg`), n).toBe(true)
      expect(existsSync(`public/classes/${classSlug(n)}-thumb.jpg`), n).toBe(true)
      expect(CLASS_CAPTION[n], n).toBeTruthy()
    }
  })

  it('gives every class its own file', () => {
    expect(new Set(names.map(classSlug)).size).toBe(names.length)
  })
})
