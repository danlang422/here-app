import { useToastStore } from '@/store/toastStore'

export function Toast() {
  const { toast, dismiss } = useToastStore()

  if (!toast) return null

  return (
    <div
      onClick={dismiss}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-base-content text-base-100 shadow-xl cursor-pointer select-none"
      style={{ animation: 'toast-in 0.25s ease both' }}
    >
      {toast.icon && <span className="text-base-100">{toast.icon}</span>}
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  )
}
