import { create } from 'zustand'

const useUIStore = create((set) => ({
  // Date selection — drives which day's schedule/roster is displayed
  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),

  // Sidebar (desktop)
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Generic modal state — specific modals can extend or use their own state
  activeModal: null, // string identifier or null
  modalData: null,   // arbitrary data to pass to the modal
  openModal: (modal, data = null) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  // Conflict visualization hook-in — not implemented yet
  // agendaConflictState: null,  // future: set by EnrollmentPanel when active
}))

export default useUIStore
