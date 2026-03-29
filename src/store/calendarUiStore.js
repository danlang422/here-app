import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCalendarUiStore = create(
  persist(
    (set, get) => ({
      // { [calendarId]: boolean } — missing key = visible (default all visible)
      calendarVisibility: {},
      sidebarMinimized: false,

      isCalendarVisible(calendarId) {
        const vis = get().calendarVisibility
        return vis[calendarId] !== false // default true for unknown IDs
      },

      toggleCalendar(calendarId) {
        set((state) => ({
          calendarVisibility: {
            ...state.calendarVisibility,
            [calendarId]: !get().isCalendarVisible(calendarId),
          },
        }))
      },

      setGroupVisibility(calendarIds, visible) {
        set((state) => {
          const updates = {}
          calendarIds.forEach((id) => {
            updates[id] = visible
          })
          return { calendarVisibility: { ...state.calendarVisibility, ...updates } }
        })
      },

      toggleSidebarMinimized() {
        set((state) => ({ sidebarMinimized: !state.sidebarMinimized }))
      },
    }),
    { name: 'calendar-ui' } // localStorage key
  )
)
