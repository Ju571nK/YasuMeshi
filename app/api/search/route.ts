import { NextResponse } from 'next/server';
import { searchNearby } from '@/lib/places';
import { VALID_RADII, VALID_TYPES, DEFAULT_RADIUS, DEFAULT_TYPE } from '@/lib/types';
import type { SearchParams, SearchResponse } from '@/lib/types';

function validateParams(body: Record<string, unknown>): SearchParams | { error: string } {
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return { error: 'lat must be a number between -90 and 90' };
  }
  if (isNaN(lng) || lng < -180 || lng > 180) {
    return { error: 'lng must be a number between -180 and 180' };
  }

  const radius = body.radius != null ? Number(body.radius) : DEFAULT_RADIUS;
  if (!VALID_RADII.includes(radius as 500 | 800 | 1000)) {
    return { error: `radius must be one of: ${VALID_RADII.join(', ')}` };
  }

  const type = (body.type as string) ?? DEFAULT_TYPE;
  if (!VALID_TYPES.includes(type as 'restaurant' | 'cafe')) {
    return { error: `type must be one of: ${VALID_TYPES.join(', ')}` };
  }

  const openNow = body.openNow !== false;

  return {
    lat,
    lng,
    radius: radius as 500 | 800 | 1000,
    type: type as 'restaurant' | 'cafe',
    openNow,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const params = validateParams(body);
  if ('error' in params) {
    return NextResponse.json({ error: params.error }, { status: 400 });
  }

  try {
    const { restaurants, unknownPrice, total } = await searchNearby(params, apiKey);
    const withPrice = restaurants.length;

    const response: SearchResponse = {
      restaurants,
      unknownPrice,
      meta: {
        total,
        withPrice,
        coverage: total > 0 ? Math.round((withPrice / total) * 100) / 100 : 0,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Google Places API error')) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
