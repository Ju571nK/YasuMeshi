import { NextResponse } from 'next/server';

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: { station?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const station = body.station?.trim();
  if (!station || station.length === 0 || station.length > 50) {
    return NextResponse.json({ error: 'station is required (max 50 chars)' }, { status: 400 });
  }

  const query = station.endsWith('駅') ? station : `${station}駅`;

  try {
    const res = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.location,places.displayName',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'ja',
        maxResultCount: 1,
        includedType: 'train_station',
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Places API error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const place = data.places?.[0];

    if (!place?.location) {
      return NextResponse.json(
        { error: '駅が見つかりませんでした', query },
        { status: 404 }
      );
    }

    return NextResponse.json({
      name: place.displayName?.text ?? query,
      lat: place.location.latitude,
      lng: place.location.longitude,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
