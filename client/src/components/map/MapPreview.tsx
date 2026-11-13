import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { cn } from '../ui';
import { createTileLayer, DEFAULT_MARKER_ICON } from '../../lib/leaflet';

interface MapPreviewProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  height?: number | string;
  interactive?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Read-only Leaflet map with a single marker. Used for outlet previews and
 * saved pickup addresses.
 */
export function MapPreview({
  latitude,
  longitude,
  zoom = 16,
  height,
  interactive = false,
  className,
  ariaLabel = 'Peta lokasi',
}: MapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: false,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive,
      attributionControl: true,
    }).setView([latitude, longitude], zoom);

    createTileLayer().addTo(map);
    L.marker([latitude, longitude], { icon: DEFAULT_MARKER_ICON }).addTo(map);

    // Leaflet needs a measurable container. Modals and responsive grids can
    // report zero size on the first paint, so re-measure shortly afterwards.
    const timer = window.setTimeout(() => map.invalidateSize(), 150);

    return () => {
      window.clearTimeout(timer);
      map.remove();
    };
  }, [latitude, longitude, zoom, interactive]);

  return (
    <div
      ref={containerRef}
      style={height === undefined ? undefined : { height }}
      className={cn('z-0 w-full overflow-hidden', className)}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
