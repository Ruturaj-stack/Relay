import type { OfflineOperation } from '@/types'
import { uid } from '@/lib/utils'

const DB_NAME = 'relay-offline'
const DB_VERSION = 1
const STORE = 'operations'
const APPLIED_KEY = 'relay.appliedOperations'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open offline storage.'))
  })
  return dbPromise
}

function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const store = tx.objectStore(STORE)
        const request = work(store)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        tx.onerror = () => reject(tx.error)
      }),
  )
}

export async function enqueueOperation(
  kind: OfflineOperation['kind'],
  payload: Record<string, unknown>,
  idempotencyKey = uid('op'),
): Promise<OfflineOperation> {
  const operation: OfflineOperation = {
    id: uid('queue'),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
    idempotencyKey,
  }
  await transaction('readwrite', (store) => store.put(operation))
  dispatchQueueEvent()
  return operation
}

export async function listOperations(): Promise<OfflineOperation[]> {
  try {
    const operations = await transaction<OfflineOperation[]>('readonly', (store) => store.getAll())
    return operations.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  } catch {
    return []
  }
}

export async function putOperation(operation: OfflineOperation) {
  await transaction('readwrite', (store) => store.put(operation))
  dispatchQueueEvent()
}

export async function deleteOperation(id: string) {
  await transaction('readwrite', (store) => store.delete(id))
  dispatchQueueEvent()
}

export async function pendingOperationCount() {
  return (await listOperations()).filter((operation) => operation.status !== 'failed').length
}

export function getAppliedOperations(): string[] {
  try {
    const raw = localStorage.getItem(APPLIED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function markOperationApplied(key: string) {
  const applied = getAppliedOperations()
  if (applied.includes(key)) return
  const next = [...applied, key].slice(-200)
  try {
    localStorage.setItem(APPLIED_KEY, JSON.stringify(next))
  } catch {
    // Idempotency keys are best-effort when storage is full.
  }
}

export function dispatchQueueEvent() {
  window.dispatchEvent(new CustomEvent('relay:queue'))
}
