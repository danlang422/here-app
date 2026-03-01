// General utility functions

// Get display name for a user profile (preferred name or first name)
export function getDisplayName(profile) {
  if (!profile) return 'Unknown'
  return profile.preferred_name || profile.first_name || 'Unknown'
}

// Get full name for a user profile
export function getFullName(profile) {
  if (!profile) return 'Unknown'
  const first = profile.preferred_name || profile.first_name || ''
  return `${first} ${profile.last_name || ''}`.trim() || 'Unknown'
}

// Get initials for avatar display
export function getInitials(profile) {
  if (!profile) return '?'
  const first = (profile.first_name || '')[0] || ''
  const last = (profile.last_name || '')[0] || ''
  return (first + last).toUpperCase() || '?'
}

// Capitalize first letter
export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Check if two arrays have any common elements
export function hasIntersection(a, b) {
  if (!a || !b) return false
  const setB = new Set(b)
  return a.some(item => setB.has(item))
}

// Get the intersection of two arrays
export function intersection(a, b) {
  if (!a || !b) return []
  const setB = new Set(b)
  return a.filter(item => setB.has(item))
}

// Deduplicate an array
export function unique(arr) {
  return [...new Set(arr)]
}

// Group an array of objects by a key
export function groupBy(arr, keyFn) {
  return arr.reduce((groups, item) => {
    const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn]
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})
}

// Sort comparator for names (last name, then first name)
export function compareByName(a, b) {
  const lastCmp = (a.last_name || '').localeCompare(b.last_name || '')
  if (lastCmp !== 0) return lastCmp
  return (a.first_name || '').localeCompare(b.first_name || '')
}
