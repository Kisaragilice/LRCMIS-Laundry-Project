import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || DEFAULT_TILE_URL;
export const TILE_ATTRIBUTION = import.meta.env.VITE_MAP_TILE_ATTRIBUTION || DEFAULT_TILE_ATTRIBUTION;

/**
 * Explicit icon instance. Vite rewrites the PNG imports to hashed asset URLs;
 * letting Leaflet auto-detect the default icon path would prepend its own
 * image path and produce a broken double URL (invisible marker).
 */
export const DEFAULT_MARKER_ICON = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

// Keep default markers safe too if a future component forgets the icon prop.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export function createTileLayer() {
  return L.tileLayer(TILE_URL, {
    attribution: TILE_ATTRIBUTION,
    maxZoom: 19,
  });
}
