'use client'

import { MapContainer, TileLayer, Marker, useMapEvents, Circle } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'

// Fix for default marker icon in React-Leaflet
// Use CDN URLs instead of importing images
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

type LocationData = {
  formatted_address: string
  lat: number
  lng: number
}

type LocationPickerMapProps = {
  location?: LocationData
  geofenceRadius?: number
  onLocationClick: (location: LocationData) => void
}

// Component to handle map clicks
function MapClickHandler({ onLocationClick }: { onLocationClick: (location: LocationData) => void }) {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng

      try {
        // Reverse geocode to get address
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
          {
            headers: {
              'User-Agent': 'InternTracker/1.0',
            },
          }
        )

        if (!response.ok) {
          throw new Error('Failed to reverse geocode')
        }

        const data = await response.json()

        onLocationClick({
          formatted_address: data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          lat,
          lng,
        })
      } catch (error) {
        console.error('Reverse geocoding error:', error)
        // Fallback to coordinates if reverse geocoding fails
        onLocationClick({
          formatted_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          lat,
          lng,
        })
      }
    },
  })

  return null
}

// Component to recenter map when location changes
function MapRecenter({ location }: { location?: LocationData }) {
  const map = useMapEvents({})

  useEffect(() => {
    if (location) {
      map.setView([location.lat, location.lng], 15)
    }
  }, [location, map])

  return null
}

export default function LocationPickerMap({ location, geofenceRadius = 100, onLocationClick }: LocationPickerMapProps) {
  // Default to Cedar Rapids, Iowa if no location
  const center: [number, number] = location 
    ? [location.lat, location.lng] 
    : [41.9779, -91.6656]
  
  const zoom = location ? 15 : 12

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-300">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        scrollWheelZoom={false}
      >
        {/* OpenStreetMap tiles - free, no API key needed */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map click handler */}
        <MapClickHandler onLocationClick={onLocationClick} />

        {/* Recenter when location changes */}
        <MapRecenter location={location} />

        {/* Marker and geofence circle if location is set */}
        {location && (
          <>
            <Marker position={[location.lat, location.lng]} />
            {/* Show geofence radius circle */}
            <Circle
              center={[location.lat, location.lng]}
              radius={geofenceRadius}
              pathOptions={{
                color: 'blue',
                fillColor: 'blue',
                fillOpacity: 0.1,
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  )
}
