import type { Request, Response } from 'express';
import { env } from '../config/env';
import { ok } from '../utils/http';
import { AppError } from '../utils/errors';

interface NominatimPlace {
  place_id?: number | string;
  lat: string;
  lon: string;
  display_name: string;
  type?: string | null;
  category?: string | null;
}

export interface GeocodePlaceDto {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  type: string | null;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 300;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

function placeDto(place: NominatimPlace): GeocodePlaceDto | null {
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !place.display_name) return null;
  return {
    id: String(place.place_id ?? `${latitude},${longitude}`),
    displayName: place.display_name,
    latitude,
    longitude,
    type: place.type ?? place.category ?? null,
  };
}

async function fetchNominatim(path: string, timeoutMs = 6000) {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(`${env.NOMINATIM_BASE_URL}${path}`, {
      headers: {
        'User-Agent': env.GEOCODING_USER_AGENT,
        'Accept-Language': 'id',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new AppError(
      502,
      'GEOCODING_UNAVAILABLE',
      'Layanan pencarian lokasi sedang tidak dapat dihubungi. Coba lagi sebentar lagi.',
    );
  }

  if (!response.ok) {
    throw new AppError(502, 'GEOCODING_UNAVAILABLE', 'Layanan pencarian lokasi sedang tidak tersedia');
  }

  const payload = (await response.json()) as unknown;
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(path, { expiresAt: Date.now() + CACHE_TTL_MS, value: payload });
  return payload;
}

function isPlace(value: unknown): value is NominatimPlace {
  return typeof value === 'object' && value !== null && 'lat' in value && 'lon' in value;
}

export async function search(req: Request, res: Response) {
  const { q, limit } = req.query as unknown as { q: string; limit: number };
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: String(limit),
    countrycodes: 'id',
    addressdetails: '1',
    'accept-language': 'id',
  });

  const payload = await fetchNominatim(`/search?${params.toString()}`);
  if (!Array.isArray(payload)) {
    throw new AppError(502, 'GEOCODING_UNAVAILABLE', 'Respons layanan pencarian lokasi tidak valid');
  }

  return ok(
    res,
    payload
      .filter(isPlace)
      .map(placeDto)
      .filter((place): place is GeocodePlaceDto => place !== null),
  );
}

export async function reverse(req: Request, res: Response) {
  const { lat, lng } = req.query as unknown as { lat: number; lng: number };
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'id',
  });

  const payload = await fetchNominatim(`/reverse?${params.toString()}`);
  const place = isPlace(payload) ? placeDto(payload) : null;
  if (!place) {
    throw new AppError(404, 'LOCATION_NOT_FOUND', 'Alamat tidak ditemukan untuk titik tersebut');
  }

  return ok(res, place);
}
