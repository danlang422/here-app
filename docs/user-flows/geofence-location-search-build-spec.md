# Geofence Location Search — Build Spec

**Date:** April 8, 2026
**Status:** Build spec — ready for implementation
**Scope:** Wire up geolocation for the admin activity form. When `requires_geofence` is toggled on, the location field gains address search via Nominatim (OpenStreetMap geocoder), silently captures lat/lng, and shows a GPS-fix icon as confirmation. Geofence radius becomes adjustable. No new database migrations required — all columns already exist.

---

## What Exists Today

**Database:** `activities` table has `location_lat` (numeric 10,7), `location_lng` (numeric 10,7), `geofence_radius` (numeric 10,2). `check_ins` table has `check_in_location_lat`, `check_in_location_lng`, `geofence_validated`. All migrated and in use.

**Student check-in flow:** `TodayView.jsx` already handles `requires_geofence` activities — calls `getCurrentPosition()` from `geofenceUtils.js`, runs `validateGeofence()` against `activity.location_lat`/`activity.location_lng`, stores result in the check-in record. Works correctly, but currently compares against null coordinates because there's no way to set them.

**Activity form:** `ActivityDetail.jsx` has `location` as a plain text field and `requires_geofence` as a toggleable behavior flag (MapPin icon). But `location_lat`, `location_lng`, and `geofence_radius` are not in `DEFAULT_VALUES`, `buildInitialValues`, or `onFormSubmit`. The form reads and writes the text `location` field only.

**Utility library:** `src/lib/geofenceUtils.js` has `haversineDistance`, `validateGeofence`, and `getCurrentPosition`. No changes needed.

---

## What This Spec Adds

1. **Nominatim address search** on the location field when `requires_geofence` is on
2. **Silent lat/lng capture** from geocoding results — no coordinate fields exposed to the user
3. **GPS → GPS-fix icon transition** as visual confirmation that coordinates are stored
4. **Geofence radius input** (visible only when `requires_geofence` is on)
5. **Form plumbing** to read/write `location_lat`, `location_lng`, `geofence_radius`
6. **Coordinate clearing logic** when geofence is toggled off and location changes

---

## Detailed Behavior

### Location field — two modes

**Default mode** (`requires_geofence` = false):
- Plain text input, exactly as it works today
- No icon adornment
- Accepts any string: "Room 208", "Main Office", an address, whatever

**Geocoding mode** (`requires_geofence` = true):
- Same text input, but with debounced Nominatim autocomplete
- `Gps` icon (Phosphor) appears at the right edge of the input as a trailing indicator
- As the user types, a dropdown shows matching addresses from Nominatim
- Selecting a result: populates the field with Nominatim's `display_name`, stores `lat`/`lon` from the result in form state
- User can continue editing the text after selection (but this clears the stored lat/lng — they'd need to re-select to re-geocode)
- Existing text is preserved on toggle — the admin can backspace from "501 1st St SE, Cedar Rapids, IA 52401" to "501 1st St" and pick from the results

### GPS icon states

| State | Icon | Style | Meaning |
|-------|------|-------|---------|
| Geofence on, no coordinates stored | `Gps` | Default text color (`text-base-content/40`) | "Search for an address to enable validation" |
| Geofence on, coordinates stored | `GpsFix` | Success color (`text-success`) | "Coordinates locked" |
| Geofence off | No icon | — | Plain text mode |

The icon is **not** clickable — it's purely an indicator. In view mode, the GPS-fix icon still appears next to the location text if the activity has stored coordinates and `requires_geofence` is true, so admins can see at a glance which activities are geofence-ready.

### Geofence radius

- Appears **only** when `requires_geofence` is true, below the location field
- Small input with label: "Geofence radius"
- Default: 100 meters
- Unit label: "meters" (static, not a selector)
- Helper text: "How close the student needs to be to check in. 100m ≈ a short city block."
- Stored as `geofence_radius` on the activity

### Nominatim integration

**API endpoint:** `https://nominatim.openstreetmap.org/search`

**Query parameters:**
- `q` — the search string
- `format=json`
- `addressdetails=1`
- `limit=5`
- `countrycodes=us` (reasonable default for City View; could be made configurable later)

**Request headers:**
- `User-Agent: HereApp/1.0 (attendance tracking app)` — required by Nominatim usage policy

**Debounce:** 600ms after last keystroke before firing a request. No request if input is under 3 characters.

**Dropdown behavior:**
- Shows below the location input (absolutely positioned, z-indexed above form content)
- Each result shows `display_name` (the full formatted address)
- Clicking a result: sets `location` to `display_name`, sets `location_lat` to `lat`, sets `location_lng` to `lon`, closes dropdown
- Clicking outside or pressing Escape closes dropdown without selection
- Loading state: small spinner in the dropdown area while request is in flight

**Error handling:** If Nominatim is unreachable or returns an error, silently fail — the field remains a plain text input. No toast or modal. The admin can still type a location; they just won't get autocomplete. The Gps icon (not GpsFix) signals that coordinates weren't captured.

**Implementation:** Create a new utility file `src/lib/nominatimSearch.js` with a single exported function:

```js
export async function searchAddress(query, options = {}) {
  const { limit = 5, countrycodes = 'us' } = options
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    countrycodes,
  })
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'User-Agent': 'HereApp/1.0 (attendance tracking app)' } }
  )
  if (!res.ok) return []
  return res.json() // Array of { display_name, lat, lon, ... }
}
```

---

## Form Plumbing Changes (ActivityDetail.jsx)

### DEFAULT_VALUES — add:

```js
location_lat: null,
location_lng: null,
geofence_radius: 100,
```

### buildInitialValues — add:

```js
location_lat: activity.location_lat ?? null,
location_lng: activity.location_lng ?? null,
geofence_radius: activity.geofence_radius ?? 100,
```

### onFormSubmit — add to the `data` object:

```js
location_lat: formValues.location_lat,
location_lng: formValues.location_lng,
geofence_radius: formValues.requires_geofence
  ? (formValues.geofence_radius ?? 100)
  : (formValues.geofence_radius ?? null),
  // Preserve radius even if toggle is off, same rationale as lat/lng
```

### Coordinate clearing logic in onFormSubmit:

```js
// If geofence is off AND location text changed, clear coordinates
const locationChanged = activity?.location !== formValues.location?.trim()
if (!formValues.requires_geofence && locationChanged) {
  data.location_lat = null
  data.location_lng = null
  data.geofence_radius = null
}
```

This means:
- Toggle off, no location change → lat/lng/radius persist (easy to re-enable)
- Toggle off + location text changed → clear everything (user is repurposing the activity)

### Form state for geocoding (local component state, not react-hook-form):

The autocomplete dropdown and Nominatim results need local state in `ActivityDetail` (or a sub-component):

```js
const [nominatimResults, setNominatimResults] = useState([])
const [nominatimLoading, setNominatimLoading] = useState(false)
const [showDropdown, setShowDropdown] = useState(false)
```

When a Nominatim result is selected:
```js
setValue('location', result.display_name)
setValue('location_lat', parseFloat(result.lat))
setValue('location_lng', parseFloat(result.lon))
setShowDropdown(false)
```

When the user manually edits the location text after a selection:
```js
// Clear stored coordinates — they no longer match the text
setValue('location_lat', null)
setValue('location_lng', null)
```

---

## Component Structure

The geocoding-enhanced location field should be extracted as a sub-component to keep `ActivityDetail` manageable:

**`LocationField`** (new, inline in ActivityDetail.jsx or a separate file if it gets large)

Props:
- `register` — react-hook-form register
- `watch` — react-hook-form watch
- `setValue` — react-hook-form setValue
- `geofenceEnabled` — boolean (watched `requires_geofence`)
- `hasCoordinates` — boolean (derived from watched `location_lat`)
- `mode` — 'view' | 'edit'

Renders:
- The location input with optional trailing GPS/GPS-fix icon
- The Nominatim autocomplete dropdown (edit mode + geofence enabled only)
- The geofence radius input (edit mode + geofence enabled only)

---

## View Mode Display

When `mode === 'view'` and the activity has a location:

- Show the location text as today (plain text string)
- If `requires_geofence` is true and `location_lat`/`location_lng` are non-null: show `GpsFix` icon in success color inline after the location text
- If `requires_geofence` is true but coordinates are null: show `Gps` icon in muted color (signals "geofence enabled but not yet geocoded")

This gives admins at-a-glance visibility into which geofenced activities still need coordinates.

---

## Phosphor Icon Imports

The `Gps` and `GpsFix` icons were added in `@phosphor-icons/react` v2.1.x. Verify the installed version supports them; bump if needed.

```js
import { Gps, GpsFix } from '@phosphor-icons/react'
```

If the package requires the `Icon` suffix for these newer icons:
```js
import { GpsIcon, GpsFixIcon } from '@phosphor-icons/react'
```

Check at implementation time — the non-suffixed names should work as aliases.

---

## What This Spec Does NOT Cover

- **Map visual** (Leaflet) — future enhancement. Nominatim provides the geocoding; Leaflet would add a visual map layer on top. No conflict between the two.
- **Internship opportunity catalog** — future feature that would auto-populate location/geofence fields from a catalog record. The fields this spec wires up are the same ones the catalog would write to.
- **Teacher-side geofence indicators** — showing `geofence_validated` status on the teacher agenda/roster. Tracked separately.
- **Geocoding provider swap** — Nominatim is free and sufficient for City View's scale. If a paid provider is ever needed, the `searchAddress` function is the only thing that changes.

---

## Testing Considerations

- Toggle `requires_geofence` on → location field should show Gps icon and enable autocomplete
- Type an address → Nominatim results should appear after debounce
- Select a result → location text updates, Gps icon changes to GpsFix in success color
- Edit the text after selection → coordinates clear, icon reverts to Gps
- Save → `location_lat`, `location_lng`, `geofence_radius` should persist to the database
- Reload the activity → coordinates and radius should load back into the form, GpsFix icon visible
- Toggle `requires_geofence` off without changing location → save preserves lat/lng
- Toggle `requires_geofence` off AND change location text → save clears lat/lng/radius
- Student check-in on an activity with coordinates → geofence validation should work (existing flow, no changes needed)
