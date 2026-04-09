import { walkMinutes } from './geo';
import type { Restaurant, SearchParams } from './types';

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';

interface PlacesApiPlace {
  displayName?: { text: string };
  priceRange?: {
    startPrice?: { currencyCode: string; units: string };
    endPrice?: { currencyCode: string; units: string };
  };
  currentOpeningHours?: { openNow: boolean };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  id?: string;
}

interface PlacesApiResponse {
  places?: PlacesApiPlace[];
}

function buildMapsUrl(place: PlacesApiPlace): string {
  if (place.location) {
    const { latitude, longitude } = place.location;
    const name = encodeURIComponent(place.displayName?.text ?? '');
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${place.id ?? ''}&query=${name}`;
  }
  return '';
}

function parsePlace(place: PlacesApiPlace, userLat: number, userLng: number): Restaurant {
  const pr = place.priceRange;
  const priceRange =
    pr?.startPrice?.units != null
      ? {
          start: Number(pr.startPrice.units),
          end: Number(pr.endPrice?.units ?? pr.startPrice.units),
          currency: pr.startPrice.currencyCode ?? 'JPY',
        }
      : null;

  const placeLat = place.location?.latitude ?? 0;
  const placeLng = place.location?.longitude ?? 0;

  return {
    name: place.displayName?.text ?? '名称不明',
    priceRange,
    walkMinutes: walkMinutes(userLat, userLng, placeLat, placeLng),
    isOpen: place.currentOpeningHours?.openNow ?? false,
    address: place.formattedAddress ?? '',
    mapsUrl: buildMapsUrl(place),
    placeId: place.id ?? '',
  };
}

export async function searchNearby(
  params: SearchParams,
  apiKey: string
): Promise<{ restaurants: Restaurant[]; unknownPrice: Restaurant[]; total: number }> {
  const fieldMask = [
    'places.displayName',
    'places.priceRange',
    'places.currentOpeningHours',
    'places.formattedAddress',
    'places.location',
    'places.id',
  ].join(',');

  const body = {
    includedTypes: [params.type],
    locationRestriction: {
      circle: {
        center: { latitude: params.lat, longitude: params.lng },
        radius: params.radius,
      },
    },
    maxResultCount: 20,
    languageCode: 'ja',
    ...(params.openNow ? { openNow: true } : {}),
  };

  const res = await fetch(PLACES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Google Places API error: ${res.status} ${res.statusText}`);
  }

  const data: PlacesApiResponse = await res.json();
  const places = data.places ?? [];

  const restaurants: Restaurant[] = [];
  const unknownPrice: Restaurant[] = [];

  for (const place of places) {
    const parsed = parsePlace(place, params.lat, params.lng);
    if (parsed.priceRange) {
      restaurants.push(parsed);
    } else {
      unknownPrice.push(parsed);
    }
  }

  restaurants.sort((a, b) => (a.priceRange!.start - b.priceRange!.start));

  return { restaurants, unknownPrice, total: places.length };
}
