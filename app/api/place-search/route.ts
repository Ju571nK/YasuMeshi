import { NextResponse } from 'next/server';

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: { query?: string; lat?: number; lng?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query || query.length === 0 || query.length > 100) {
    return NextResponse.json({ error: 'query is required (max 100 chars)' }, { status: 400 });
  }

  const lat = body.lat;
  const lng = body.lng;

  const searchBody: Record<string, unknown> = {
    textQuery: query,
    languageCode: 'ja',
    maxResultCount: 5,
    includedType: 'restaurant',
  };

  if (lat != null && lng != null) {
    searchBody.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 2000,
      },
    };
  }

  try {
    const res = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Places API error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const places = (data.places ?? []).map((p: {
      id?: string;
      displayName?: { text: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
    }) => ({
      placeId: p.id ?? '',
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? '',
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
    }));

    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
