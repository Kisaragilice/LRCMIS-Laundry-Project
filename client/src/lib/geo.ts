export interface Coordinates {
  latitude: number | null;
  longitude: number | null;
}

export function hasCoordinates(value: Coordinates): value is { latitude: number; longitude: number } {
  return typeof value.latitude === 'number' && typeof value.longitude === 'number';
}

/** Google Maps navigation link. Uses the exact pin when coordinates are available. */
export function googleMapsUrl(value: Coordinates & { address?: string | null }) {
  if (hasCoordinates(value)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${value.latitude},${value.longitude}`;
  }
  if (value.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.address)}`;
  }
  return null;
}

export function formatCoordinates(value: Coordinates) {
  if (!hasCoordinates(value)) return null;
  return `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}`;
}
