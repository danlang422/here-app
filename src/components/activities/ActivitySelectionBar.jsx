/**
 * ActivitySelectionBar — shown in place of ActivityToolbar when activities are selected.
 *
 * Props:
 *   selectedCount       - number of currently selected activities
 *   totalFilteredCount  - total activities in the current filtered list
 *   onDeselectAll       - clears selection
 *   onSelectAll         - selects all activities in the filtered list
 *   onBulkEdit          - opens the BulkEditModal
 */
export default function ActivitySelectionBar({
  selectedCount,
  totalFilteredCount,
  onDeselectAll,
  onSelectAll,
  onBulkEdit,
}) {
  const allSelected = selectedCount === totalFilteredCount

  return (
    <div className="flex items-center gap-3 px-1 py-2 min-h-[2.75rem]">
      <span className="font-medium text-sm">
        {selectedCount} selected
      </span>

      {!allSelected && (
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onSelectAll}
        >
          Select all {totalFilteredCount}
        </button>
      )}

      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={onDeselectAll}
      >
        Deselect all
      </button>

      <div className="ml-auto">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onBulkEdit}
        >
          Edit selected
        </button>
      </div>
    </div>
  )
}
