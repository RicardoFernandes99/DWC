import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { Input } from '@/components/ui/input';
import { authenticatedRequest } from '@/lib/session';
import { cn } from '@/lib/utils';

type GeocodeResult = components['schemas']['GeocodeResultDto'];
type GeocodeResponse = components['schemas']['GeocodeSearchResponseDto'];

const MIN_QUERY = 3;

/**
 * Producer address lookup: searches through the API (which calls
 * OpenStreetMap), lets the producer pick a match and previews the pin on a
 * map. Coordinates come from the chosen match instead of manual typing.
 */
export function AddressSearch({
  id,
  initialQuery,
  latitude,
  longitude,
  onPick,
  error,
}: {
  id: string;
  initialQuery: string;
  latitude: number | null;
  longitude: number | null;
  onPick: (result: GeocodeResult) => void;
  error?: string;
}) {
  const listId = useId();
  const [draft, setDraft] = useState(initialQuery);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(draft.trim()), 500);
    return () => window.clearTimeout(timer);
  }, [draft]);
  const search = useQuery({
    queryKey: ['geocode', query],
    queryFn: () =>
      authenticatedRequest<GeocodeResponse>(
        `geocode/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: open && query.length >= MIN_QUERY,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const hasPin =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  const delta = 0.006;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
        />
        <Input
          id={id}
          role="combobox"
          aria-expanded={open && Boolean(search.data?.items.length)}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={Boolean(error)}
          value={draft}
          placeholder="Search your farm or collection address"
          className="pl-9"
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        />
        {open && query.length >= MIN_QUERY && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
            {search.isPending && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Searching…
              </p>
            )}
            {search.isError && (
              <p role="alert" className="px-3 py-2 text-sm text-destructive">
                Address search is unavailable right now. Try again shortly.
              </p>
            )}
            {search.data && search.data.items.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No matches. Try adding a town or postcode.
              </p>
            )}
            {search.data && search.data.items.length > 0 && (
              <ul id={listId} role="listbox" aria-label="Address matches">
                {search.data.items.map((item) => (
                  <li key={`${item.latitude},${item.longitude},${item.label}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      onClick={() => {
                        onPick(item);
                        setDraft(item.label);
                        setOpen(false);
                      }}
                    >
                      <MapPin
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-primary"
                      />
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div
        className={cn(
          'overflow-hidden rounded-lg border bg-secondary',
          !hasPin && 'grid h-40 place-items-center',
        )}
      >
        {hasPin ? (
          <iframe
            title="Pinned location"
            className="block h-48 w-full"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
              `${longitude! - delta},${latitude! - delta},${longitude! + delta},${latitude! + delta}`,
            )}&layer=mapnik&marker=${latitude},${longitude}`}
          />
        ) : (
          <p className="px-4 text-center text-sm text-muted-foreground">
            Search and pick your address to place it on the map.
          </p>
        )}
      </div>
      {hasPin && (
        <p className="text-xs text-muted-foreground tabular-nums">
          Pinned at {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
        </p>
      )}
    </div>
  );
}
