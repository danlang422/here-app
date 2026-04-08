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
