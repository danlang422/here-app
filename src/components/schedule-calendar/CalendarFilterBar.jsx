export function CalendarFilterBar() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-base-200">
      <input
        type="text"
        className="input input-bordered input-sm w-64"
        placeholder="Filter activities..."
        disabled
      />
    </div>
  )
}
