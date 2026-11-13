import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GeocodeResultDto } from './geocoding.dto.js';

const DEFAULT_GEOCODER_URL = 'https://nominatim.openstreetmap.org';
/** The public Nominatim policy allows at most one request per second. */
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 5000;
const CACHE_LIMIT = 200;
const RESULT_LIMIT = 5;

interface NominatimPlace {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
  address?: Record<string, unknown>;
}

/**
 * Address search through OpenStreetMap Nominatim. Requests go from the API,
 * never the browser, with a generic client name, one request per second and
 * a small in-memory cache, following the public usage policy.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly baseUrl: string;
  private readonly cache = new Map<string, GeocodeResultDto[]>();
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('GEOCODER_URL') || DEFAULT_GEOCODER_URL
    ).replace(/\/$/, '');
  }

  async search(query: string): Promise<GeocodeResultDto[]> {
    const key = query.toLowerCase().replace(/\s+/g, ' ');
    const cached = this.cache.get(key);
    if (cached) return cached;
    const run = this.queue.then(() => this.fetchPlaces(query));
    // Keep the queue alive even when one lookup fails.
    this.queue = run.catch(() => undefined);
    const results = await run;
    if (this.cache.size >= CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, results);
    return results;
  }

  private async fetchPlaces(query: string): Promise<GeocodeResultDto[]> {
    const wait = this.lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(RESULT_LIMIT));
    url.searchParams.set('q', query);
    let places: unknown;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'FromFarmToTable-local/0.1',
          'Accept-Language': 'en',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      places = await response.json();
    } catch (error) {
      this.logger.warn(
        `Address search failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      );
      throw new ServiceUnavailableException(
        'Address search is currently unavailable. Try again shortly.',
      );
    }
    if (!Array.isArray(places)) return [];
    return places.flatMap((place: NominatimPlace) => {
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      if (
        typeof place.display_name !== 'string' ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      )
        return [];
      const address = place.address ?? {};
      const city = ['city', 'town', 'village', 'municipality', 'county']
        .map((field) => address[field])
        .find((value): value is string => typeof value === 'string');
      return [
        {
          label: place.display_name.slice(0, 240),
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          city: city?.slice(0, 120) ?? null,
        },
      ];
    });
  }
}
