import type { DemoDatabase } from '@/types'
import { createSeedDatabase, DEMO_DB_VERSION } from '@/lib/seed'

const STORAGE_KEY = 'relay.demo.db'

let cache: DemoDatabase | null = null

function isValid(data: unknown): data is DemoDatabase {
  if (!data || typeof data !== 'object') return false
  const db = data as DemoDatabase
  return (
    db.version === DEMO_DB_VERSION &&
    Array.isArray(db.profiles) &&
    Array.isArray(db.handoffs) &&
    Array.isArray(db.items) &&
    Array.isArray(db.teams)
  )
}

export function loadDatabase(): DemoDatabase {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (isValid(parsed)) {
        cache = parsed
        return parsed
      }
    }
  } catch {
    // Corrupt or unavailable storage falls back to a fresh seed.
  }
  const seeded = createSeedDatabase()
  saveDatabase(seeded)
  return seeded
}

export function saveDatabase(db: DemoDatabase) {
  cache = db
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch (error) {
    console.warn('RELAY demo storage is unavailable. Data will reset on reload.', error)
  }
}

export function updateDatabase(mutator: (draft: DemoDatabase) => void): DemoDatabase {
  const db = structuredClone(loadDatabase())
  mutator(db)
  saveDatabase(db)
  window.dispatchEvent(new CustomEvent('relay:data'))
  return db
}

export function resetDatabase(): DemoDatabase {
  const seeded = createSeedDatabase()
  saveDatabase(seeded)
  window.dispatchEvent(new CustomEvent('relay:data'))
  return seeded
}

export function seedIfEmpty() {
  loadDatabase()
}

export function getDatabaseForExport() {
  return structuredClone(loadDatabase())
}

export function setDemoUser(userId: string | null) {
  return updateDatabase((db) => {
    db.currentUserId = userId
  })
}
