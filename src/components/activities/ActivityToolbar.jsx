import { getBlocks, getBlockLabel } from '@/lib/constants'

/**
 * ActivityToolbar — search, filter, and sort controls for the activity list.
 *
 * Props:
 *   searchQuery      - current search string
 *   onSearchChange   - called with new search string
 *   filters          - { block, term, status, staff }
 *   onFiltersChange  - called with updated filters object
 *   sortField        - current sort field
 *   sortDir          - 'asc' | 'desc'
 *   onSortChange     - called with new sort field (parent toggles dir on same field)
 *   terms            - array of academic term objects
 *   staffUsers       - array of staff user_profile objects
 *   orgSettings      - org settings object
 */
export default function ActivityToolbar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  sortField,
  sortDir,
  onSortChange,
  terms = [],
  staffUsers = [],
  orgSettings = {},
}) {
  const blockCount = orgSettings?.block_count ?? null
  const blockLabels = orgSettings?.block_labels ?? null
  const blocks = getBlocks(blockCount)

  function setFilter(key, value) {
    onFiltersChange({ ...filters, [key]: value })
  }

  const sortDirSymbol = sortDir === 'asc' ? '↑' : '↓'

  const SORT_OPTIONS = [
    { value: 'block', label: 'Block' },
    { value: 'name', label: 'Name' },
    { value: 'time', label: 'Time' },
    { value: 'enrolled', label: 'Enrolled' },
  ]

  const STATUS_OPTIONS = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'needs_scheduling', label: 'Needs scheduling' },
    { value: 'not_scheduled', label: 'Not scheduled' },
    { value: 'release', label: 'Release' },
  ]

  return (
    <div className="flex flex-wrap gap-2 items-center mb-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search activities..."
        className="input input-bordered input-sm w-64"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {/* Block filter */}
      <select
        className="select select-bordered select-sm"
        value={filters.block}
        onChange={(e) => setFilter('block', e.target.value)}
      >
        <option value="all">Block: All</option>
        {blocks.map((b) => (
          <option key={b} value={b}>{getBlockLabel(b, blockLabels)}</option>
        ))}
        <option value="none">No block</option>
      </select>

      {/* Term filter */}
      <select
        className="select select-bordered select-sm"
        value={filters.term}
        onChange={(e) => setFilter('term', e.target.value)}
      >
        <option value="all">Term: All</option>
        {terms.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
        <option value="none">No term</option>
      </select>

      {/* Status filter */}
      <select
        className="select select-bordered select-sm"
        value={filters.status}
        onChange={(e) => setFilter('status', e.target.value)}
      >
        <option value="all">Status: All</option>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Staff filter */}
      <select
        className="select select-bordered select-sm"
        value={filters.staff}
        onChange={(e) => setFilter('staff', e.target.value)}
      >
        <option value="all">Staff: All</option>
        {staffUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.last_name}, {u.first_name}
          </option>
        ))}
        <option value="none">No staff</option>
      </select>

      {/* Sort */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-base-content/50">Sort:</span>
        <select
          className="select select-bordered select-sm"
          value={sortField}
          onChange={(e) => onSortChange(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square text-base-content/60"
          onClick={() => onSortChange(sortField)}
          title="Toggle direction"
        >
          {sortDirSymbol}
        </button>
      </div>
    </div>
  )
}
