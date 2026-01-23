'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

// Dynamically import the map component to avoid SSR issues
const MapComponent = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
})

export type LocationData = {
  formatted_address: string
  lat: number
  lng: number
}

type LocationPickerProps = {
  value?: LocationData
  geofenceRadius?: number
  onChange: (location: LocationData | undefined) => void
  className?: string
}

export default function LocationPicker({ value, geofenceRadius = 100, onChange, className = '' }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Initialize search query from value
  useEffect(() => {
    if (value?.formatted_address && !searchQuery) {
      setSearchQuery(value.formatted_address)
    }
  }, [value])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter an address to search')
      return
    }

    setIsSearching(true)
    setSearchError(null)

    try {
      // Using Nominatim (OpenStreetMap's free geocoding service)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        {
          headers: {
            'User-Agent': 'InternTracker/1.0', // Nominatim requires a User-Agent
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to search location')
      }

      const data = await response.json()

      if (data.length === 0) {
        setSearchError('Location not found. Try a different search term.')
        return
      }

      const result = data[0]
      const locationData: LocationData = {
        formatted_address: result.display_name,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      }

      onChange(locationData)
      setSearchQuery(result.display_name)
    } catch (error) {
      console.error('Geocoding error:', error)
      setSearchError('Failed to search location. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleMapClick = (location: LocationData) => {
    onChange(location)
    setSearchQuery(location.formatted_address)
  }

  const handleClearLocation = () => {
    onChange(undefined)
    setSearchQuery('')
    setSearchError(null)
  }

  return (
    <div className={className}>
      {/* Search Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Search Address
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter address or place name..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleClearLocation}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {searchError && (
          <p className="text-sm text-red-600">{searchError}</p>
        )}

        {value && (
          <p className="text-sm text-gray-600">
            Selected: {value.formatted_address}
          </p>
        )}
      </div>

      {/* Map */}
      <div className="mt-4">
        <MapComponent location={value} geofenceRadius={geofenceRadius} onLocationClick={handleMapClick} />
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Click on the map to set a location, or search for an address above
      </p>
    </div>
  )
}
