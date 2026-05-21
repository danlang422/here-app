import { useEffect, useRef } from 'react'
import { supabase } from '@/api/supabase'

export function useAttendanceSubscription(instanceIds, onUpdate) {
  // Keep a ref to the latest callback so the subscription doesn't need to re-open
  // when the caller re-renders and produces a new function identity.
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => {
    onUpdateRef.current = onUpdate
  })

  const instanceKey = instanceIds?.length ? [...instanceIds].sort().join(',') : ''

  useEffect(() => {
    if (!instanceKey) return

    const channelName = `attendance-${instanceKey.replace(/,/g, '-')}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `activity_instance_id=in.(${instanceKey})`,
        },
        (payload) => onUpdateRef.current(payload)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [instanceKey])
}
