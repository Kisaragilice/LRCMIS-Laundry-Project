import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Check, Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { Input, cn } from '../ui';
import { api, ApiError } from '../../lib/api';
import { createTileLayer, DEFAULT_MARKER_ICON } from '../../lib/leaflet';
import { OUTLET } from '../../lib/outlet';
import { formatCoordinates } from '../../lib/geo';

export interface LocationPickerPatch {
  latitude?: number | null;
  longitude?: number | null;
  addressText?: string;
}

interface GeocodePlace {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  type: string | null;
}

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  addressText: string;
  onChange: (patch: LocationPickerPatch) => void;
  height?: number;
  className?: string;
}

const roundCoordinate = (value: number) => Number(value.toFixed(6));

function geolocationUnavailableMessage(): string | null {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return 'Perangkat ini tidak mendukung geolokasi. Gunakan pencarian alamat atau pin manual.';
  }
  // Browsers only expose geolocation on secure origins (HTTPS or localhost).
  // On a plain http://LAN-IP origin Chrome/Safari never show a permission popup.
  if (!window.isSecureContext) {
    return 'Browser hanya mengizinkan lokasi lewat HTTPS atau localhost. Buka dashboard lewat https://, lalu coba lagi. Sementara itu gunakan pencarian alamat atau pin manual.';
  }
  return null;
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case 1:
      return 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser, lalu coba lagi.';
    case 2:
      return 'Lokasi perangkat tidak tersedia. Aktifkan GPS/lokasi, lalu coba lagi atau gunakan pencarian alamat.';
    case 3:
      return 'Pencarian lokasi terlalu lama. Coba lagi atau gunakan pencarian alamat.';
    default:
      return 'Lokasi tidak dapat diakses. Gunakan pencarian alamat atau pasang pin manual.';
  }
}

/**
 * Interactive address picker backed by Leaflet + OpenStreetMap. Customers can
 * search an address (through the backend Nominatim proxy) or drop/drag a pin.
 */
export function LocationPicker({
  latitude,
  longitude,
  addressText,
  onChange,
  height = 260,
  className,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const addressTextRef = useRef(addressText);

  const searchSeq = useRef(0);
  const reverseSeq = useRef(0);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodePlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<GeocodePlace | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    addressTextRef.current = addressText;
  }, [addressText]);

  const reverseLookup = useCallback(async (lat: number, lng: number) => {
    const seq = ++reverseSeq.current;
    setReverseLoading(true);
    setSuggestion(null);
    try {
      const place = await api.get<GeocodePlace>(
        `/geocode/reverse?lat=${roundCoordinate(lat)}&lng=${roundCoordinate(lng)}`,
      );
      if (seq !== reverseSeq.current) return;
      if (place?.displayName) {
        // Keep the customer's detailed address if they already wrote one.
        // Otherwise a dropped pin fills the field automatically.
        if (addressTextRef.current.trim().length === 0) {
          onChangeRef.current({ addressText: place.displayName });
          setSuggestion(null);
        } else {
          setSuggestion(place);
        }
      }
    } catch {
      // Reverse geocoding is a convenience; the pin itself stays usable.
      if (seq === reverseSeq.current) setSuggestion(null);
    } finally {
      if (seq === reverseSeq.current) setReverseLoading(false);
    }
  }, []);

  const ensureMarker = useCallback(
    (lat: number, lng: number) => {
      const map = mapRef.current;
      if (!map) return null;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        return markerRef.current;
      }
      const marker = L.marker([lat, lng], { draggable: true, icon: DEFAULT_MARKER_ICON }).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        const next = { latitude: roundCoordinate(position.lat), longitude: roundCoordinate(position.lng) };
        onChangeRef.current(next);
        void reverseLookup(next.latitude, next.longitude);
      });
      markerRef.current = marker;
      return marker;
    },
    [reverseLookup],
  );

  const setPin = useCallback(
    (lat: number, lng: number, lookup = true) => {
      const next = { latitude: roundCoordinate(lat), longitude: roundCoordinate(lng) };
      ensureMarker(next.latitude, next.longitude);
      onChangeRef.current(next);
      if (lookup) void reverseLookup(next.latitude, next.longitude);
    },
    [ensureMarker, reverseLookup],
  );

  // Initialise once. Subsequent coordinate changes are synchronised below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const hasValue = latitude !== null && longitude !== null;
    const center: [number, number] = hasValue ? [latitude, longitude] : [OUTLET.latitude, OUTLET.longitude];
    const map = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView(center, hasValue ? 16 : 14);

    createTileLayer().addTo(map);
    map.on('click', (event) => setPin(event.latlng.lat, event.latlng.lng));
    mapRef.current = map;

    if (hasValue) ensureMarker(latitude, longitude);

    const timer = window.setTimeout(() => map.invalidateSize(), 150);

    return () => {
      window.clearTimeout(timer);
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
    // Values are read once for the initial view; the effect below keeps the
    // marker in sync when the parent form changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync when the value changes from outside the map
  // (opening a saved address, clearing the pin, or applying a search result).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (latitude === null || longitude === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const current = markerRef.current?.getLatLng();
    if (current && Math.abs(current.lat - latitude) < 1e-6 && Math.abs(current.lng - longitude) < 1e-6) {
      return;
    }

    ensureMarker(latitude, longitude);
    map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
    void map.invalidateSize();
  }, [latitude, longitude, ensureMarker]);

  // Debounced address search. Nominatim is called through the API proxy so the
  // server can enforce its user agent, timeout, and usage policy.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      searchSeq.current += 1;
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    const seq = ++searchSeq.current;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const places = await api.get<GeocodePlace[]>(
          `/geocode/search?q=${encodeURIComponent(term)}&limit=5`,
        );
        if (seq !== searchSeq.current) return;
        setResults(places);
      } catch (error) {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setSearchError(error instanceof ApiError ? error.message : 'Gagal mencari alamat');
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [query]);

  const selectPlace = (place: GeocodePlace) => {
    ensureMarker(place.latitude, place.longitude);
    mapRef.current?.setView([place.latitude, place.longitude], 17);
    onChangeRef.current({
      latitude: place.latitude,
      longitude: place.longitude,
      addressText: place.displayName,
    });
    setQuery('');
    setResults([]);
    setSuggestion(null);
    setSearchError(null);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    onChangeRef.current({ addressText: suggestion.displayName });
    setSuggestion(null);
  };

  const locateMe = () => {
    const unavailable = geolocationUnavailableMessage();
    if (unavailable) {
      setLocateError(unavailable);
      return;
    }

    setLocating(true);
    setLocateError(null);

    const applyPosition = (position: GeolocationPosition) => {
      setLocating(false);
      const nextLatitude = roundCoordinate(position.coords.latitude);
      const nextLongitude = roundCoordinate(position.coords.longitude);
      ensureMarker(nextLatitude, nextLongitude);
      mapRef.current?.setView([nextLatitude, nextLongitude], 17);
      onChangeRef.current({ latitude: nextLatitude, longitude: nextLongitude });
      void reverseLookup(nextLatitude, nextLongitude);
    };

    const fail = (error: GeolocationPositionError) => {
      setLocating(false);
      setLocateError(geolocationErrorMessage(error));
    };

    // High accuracy can time out on desktops without GPS or when the OS
    // location service is off. Retry once with network-based positioning.
    navigator.geolocation.getCurrentPosition(
      applyPosition,
      (error) => {
        if (error.code === 2 || error.code === 3) {
          navigator.geolocation.getCurrentPosition(applyPosition, fail, {
            enableHighAccuracy: false,
            timeout: 15_000,
            maximumAge: 60_000,
          });
          return;
        }
        fail(error);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  };

  const clearPin = () => {
    reverseSeq.current += 1;
    setReverseLoading(false);
    markerRef.current?.remove();
    markerRef.current = null;
    setSuggestion(null);
    onChangeRef.current({ latitude: null, longitude: null });
  };

  const hasPin = latitude !== null && longitude !== null;
  const showResults = query.trim().length >= 3 && (results.length > 0 || searching || Boolean(searchError));

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-ink-100 bg-white', className)}>
      <div className="border-b border-ink-100 p-3 sm:p-4">
        <div className="relative z-20">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9 pr-9"
            placeholder="Cari alamat, jalan, atau tempat..."
            aria-label="Cari alamat pada peta"
            autoComplete="off"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />
          )}
          {showResults && (
            <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-lg">
              {searchError ? (
                <p className="px-3 py-3 text-xs text-red-600">{searchError}</p>
              ) : searching && results.length === 0 ? (
                <p className="px-3 py-3 text-xs text-ink-500">Mencari alamat...</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-3 text-xs text-ink-500">Alamat tidak ditemukan. Coba kata kunci lain.</p>
              ) : (
                <ul className="max-h-56 overflow-y-auto py-1">
                  {results.map((place) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        onClick={() => selectPlace(place)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-brand-50"
                      >
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold leading-snug text-ink-800">
                            {place.displayName}
                          </span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-ink-400">
                            {place.type ?? 'Alamat'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
          >
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
            Lokasi saya
          </button>
          {hasPin ? (
            <>
              <span className="font-mono text-ink-400">{formatCoordinates({ latitude, longitude })}</span>
              <button
                type="button"
                onClick={clearPin}
                className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 font-semibold text-ink-400 transition hover:text-red-600"
              >
                <X className="h-3 w-3" /> Hapus pin
              </button>
            </>
          ) : (
            <span className="text-ink-400">Pin belum dipasang.</span>
          )}
        </div>
        {locateError && <p className="mt-1.5 text-[11px] text-red-600">{locateError}</p>}
        {!window.isSecureContext && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-amber-700">
            Akses lokasi browser hanya aktif lewat HTTPS atau localhost. Di koneksi HTTP/LAN, gunakan kolom pencarian
            alamat atau pasang pin manual.
          </p>
        )}
      </div>

      <div className="relative z-0">
        <div ref={containerRef} style={{ height }} className="w-full" aria-label="Peta pemilih alamat" />
      </div>

      <div className="space-y-2 border-t border-ink-100 p-3 text-[11px] text-ink-500 sm:p-4">
        <p className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
          Cari alamat lalu pilih hasilnya, atau klik peta dan geser pin ke titik yang tepat.
        </p>
        {addressText.trim().length > 0 && (
          <p className="line-clamp-2 text-ink-400">Alamat tersimpan: {addressText.trim()}</p>
        )}
        {reverseLoading && (
          <p className="inline-flex items-center gap-1.5 text-brand-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mendeteksi alamat di sekitar pin...
          </p>
        )}
        {suggestion && !reverseLoading && (
          <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-2.5">
            <p className="font-semibold text-ink-700">Alamat terdeteksi</p>
            <p className="mt-0.5 leading-relaxed text-ink-500">{suggestion.displayName}</p>
            <button
              type="button"
              onClick={applySuggestion}
              className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-brand-700 shadow-sm transition hover:bg-brand-50"
            >
              <Check className="h-3 w-3" /> Gunakan alamat ini
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
