import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { bulkUpdateActivityFields } from '@/api/activities'
import { replaceActivityTerms } from '@/api/activityTerms'

/**
 * Orchestrates bulk edits across multiple activities.
 *
 * changes = {
 *   block?:   number | null           // set block for all
 *   time?:    { start: string, end: string }  // set default_start_time / default_end_time
 *   termIds?: string[]                // replace all terms on each activity
 *   flags?:   Record<string, boolean> // scalar flag overrides (only truthy-or-false entries)
 * }
 *
 * Execution:
 *   Phase 1 — scalar fields (block, time, flags): one .in() round trip
 *   Phase 2 — terms: sequential replaceActivityTerms per activity (bridge table)
 */
export function useBulkEditActivities(orgId) {
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errors, setErrors] = useState([])

  async function bulkEdit({ selectedIds, changes }) {
    const ids = [...selectedIds]
    setIsPending(true)
    setProgress(0)
    setErrors([])
    const collectedErrors = []

    try {
      // Phase 1: scalar fields
      if (hasScalar(changes)) {
        const updates = buildScalarUpdates(changes)
        try {
          await bulkUpdateActivityFields(ids, updates)
        } catch (err) {
          // Scalar failure is fatal — don't proceed to terms
          collectedErrors.push({ phase: 'scalar', error: err })
          setErrors(collectedErrors)
          return { success: false, errors: collectedErrors }
        }
        setProgress((p) => p + 1)
      }

      // Phase 2: terms (per-activity, sequential)
      if (changes.termIds != null) {
        for (const activityId of ids) {
          try {
            await replaceActivityTerms(activityId, changes.termIds)
          } catch (err) {
            collectedErrors.push({ activityId, error: err })
          }
          setProgress((p) => p + 1)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['activities', orgId] })

      if (collectedErrors.length > 0) {
        setErrors(collectedErrors)
        return { success: false, errors: collectedErrors }
      }
      return { success: true }
    } finally {
      setIsPending(false)
    }
  }

  return { bulkEdit, isPending, progress, errors }
}

function hasScalar(changes) {
  return changes.block !== undefined || changes.time != null || changes.flags != null || changes.calendarId !== undefined
}

function buildScalarUpdates(changes) {
  const updates = {}
  if (changes.block !== undefined) updates.block = changes.block
  if (changes.time != null) {
    updates.default_start_time = changes.time.start || null
    updates.default_end_time = changes.time.end || null
  }
  if (changes.flags != null) {
    Object.assign(updates, changes.flags)
  }
  if (changes.calendarId !== undefined) updates.calendar_id = changes.calendarId
  return updates
}
