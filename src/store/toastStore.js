import { create } from 'zustand'

let toastTimeout = null

export const useToastStore = create((set) => ({
  toast: null, // { message, icon }
  show(message, icon = null) {
    if (toastTimeout) clearTimeout(toastTimeout)
    set({ toast: { message, icon } })
    toastTimeout = setTimeout(() => set({ toast: null }), 2500)
  },
  dismiss() {
    if (toastTimeout) clearTimeout(toastTimeout)
    set({ toast: null })
  },
}))
