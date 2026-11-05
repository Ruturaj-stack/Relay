import { updateDatabase } from '@/lib/demoDb'
import {
  deleteOperation,
  dispatchQueueEvent,
  getAppliedOperations,
  listOperations,
  markOperationApplied,
  putOperation,
} from '@/lib/offline'

export interface SyncResult {
  synced: number
  conflicts: number
  failed: number
}

/**
 * Reconciles device-local operations with the workspace.
 * Every operation has an idempotency key, so a retried sync cannot be applied twice.
 * Conflicting edits are surfaced instead of being silently overwritten.
 */
export async function syncOfflineQueue(): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, conflicts: 0, failed: 0 }
  }
  const operations = await listOperations()
  const result: SyncResult = { synced: 0, conflicts: 0, failed: 0 }
  if (!operations.length) return result

  const applied = getAppliedOperations()

  for (const operation of operations) {
    if (operation.status === 'failed') continue
    if (applied.includes(operation.idempotencyKey)) {
      await deleteOperation(operation.id)
      result.synced += 1
      continue
    }

    await putOperation({ ...operation, status: 'syncing', attempts: operation.attempts + 1 })

    try {
      let conflictMessage: string | null = null
      let missingMessage: string | null = null

      updateDatabase((db) => {
        if (operation.kind === 'handoff.create') {
          const handoffId = String(operation.payload.handoffId ?? '')
          const handoff = db.handoffs.find((entry) => entry.id === handoffId)
          if (!handoff) {
            missingMessage = 'This offline handoff no longer exists in the workspace.'
            return
          }
          handoff.pendingSync = false
        } else if (operation.kind === 'handoff.status') {
          const handoffId = String(operation.payload.handoffId ?? '')
          const targetStatus = operation.payload.status as string | undefined
          const handoff = db.handoffs.find((entry) => entry.id === handoffId)
          if (!handoff) {
            missingMessage = 'The handoff was removed before this change could sync.'
            return
          }
          if (targetStatus && handoff.status !== targetStatus) {
            conflictMessage = `This handoff changed to “${handoff.status.replace('_', ' ')}” before the offline change synced. Review it before retrying.`
            return
          }
          handoff.pendingSync = false
        } else if (operation.kind === 'item.create') {
          const itemId = String(operation.payload.itemId ?? '')
          if (!db.items.some((entry) => entry.id === itemId)) {
            missingMessage = 'This offline item no longer exists in the workspace.'
          }
        } else if (operation.kind === 'issue.report') {
          const handoffId = operation.payload.handoffId
          if (handoffId && !db.handoffs.some((entry) => entry.id === handoffId)) {
            missingMessage = 'The handoff linked to this issue no longer exists.'
          }
        }
      })

      if (conflictMessage || missingMessage) {
        const failedOperation = {
          ...operation,
          status: 'failed' as const,
          error: conflictMessage ?? missingMessage ?? 'The change could not be reconciled.',
        }
        await putOperation(failedOperation)
        if (conflictMessage) result.conflicts += 1
        else result.failed += 1
        continue
      }

      markOperationApplied(operation.idempotencyKey)
      await deleteOperation(operation.id)
      result.synced += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed.'
      await putOperation({ ...operation, status: 'failed', error: message, attempts: operation.attempts + 1 })
      result.failed += 1
    }
  }

  dispatchQueueEvent()
  if (result.synced > 0) window.dispatchEvent(new CustomEvent('relay:data'))
  return result
}

export async function retryFailedOperations() {
  const operations = await listOperations()
  for (const operation of operations) {
    if (operation.status === 'failed') {
      await putOperation({ ...operation, status: 'pending', error: undefined, attempts: 0 })
    }
  }
  dispatchQueueEvent()
}

export async function discardFailedOperations() {
  const operations = await listOperations()
  for (const operation of operations) {
    if (operation.status === 'failed') await deleteOperation(operation.id)
  }
  dispatchQueueEvent()
}
