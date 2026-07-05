import { NextResponse } from 'next/server';
import { searchNearby } from '@/lib/places';
import { searchHotPepper } from '@/lib/hotpepper';
import { mergeResults } from '@/lib/merge';
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
    const googleKey = apiKey;
    const hpKey = process.env.HOTPEPPER_API_KEY;

    const [googleRes, hpRes] = await Promise.allSettled([
      searchNearby(params, googleKey),
      hpKey
        ? searchHotPepper(params, hpKey, { timeoutMs: 2000 })
        : Promise.reject(new Error('HotPepper key not configured')),
    ]);

    if (googleRes.status === 'rejected') {
      const message = googleRes.reason instanceof Error ? googleRes.reason.message : 'Unknown error';
      if (message.includes('Google Places API error')) {
        return NextResponse.json({ error: message }, { status: 502 });
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const google = googleRes.value;
    const hotpepper = hpRes.status === 'fulfilled' ? hpRes.value : null;
    const hotpepperOk = hpRes.status === 'fulfilled';

    let merged: { restaurants: typeof google.restaurants; unknownPrice: typeof google.unknownPrice; total: number };
    try {
      merged = mergeResults(
        { restaurants: google.restaurants, unknownPrice: google.unknownPrice },
        hotpepper,
        params.lat,
        params.lng
      );
    } catch {
      merged = {
        restaurants: google.restaurants,
        unknownPrice: google.unknownPrice,
        total: google.restaurants.length + google.unknownPrice.length,
      };
    }

    const withPrice = merged.restaurants.length;
    const response: SearchResponse = {
      restaurants: merged.restaurants,
      unknownPrice: merged.unknownPrice,
      meta: {
        total: merged.total,
        withPrice,
        coverage: merged.total > 0 ? Math.round((withPrice / merged.total) * 100) / 100 : 0,
        hotpepperOk,
      },
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
