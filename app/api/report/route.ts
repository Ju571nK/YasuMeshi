import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { haversineDistance } from '@/lib/geo';

const MAX_DISTANCE_KM = 2;
const VALID_TAGS = ['トイレ', 'カード可', '持ち帰り', 'カウンター', 'グループ'] as const;

interface ReportBody {
  placeId?: string;
  placeName?: string;
  menuName?: string;
  price?: number;
  tags?: string[];
  lat?: number;
  lng?: number;
  placeLat?: number;
  placeLng?: number;
}

export async function POST(request: Request) {
  let body: ReportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { placeId, placeName, menuName, price, tags, lat, lng, placeLat, placeLng } = body;

  // Validation
  if (!placeId || !placeName || !menuName || price == null || lat == null || lng == null) {
    return NextResponse.json(
      { error: 'placeId, placeName, menuName, price, lat, lng are required' },
      { status: 400 }
    );
  }

  if (typeof price !== 'number' || price < 1 || price > 100000) {
    return NextResponse.json({ error: 'price must be 1-100000' }, { status: 400 });
  }

  if (placeName.length > 100 || menuName.length > 100) {
    return NextResponse.json({ error: 'placeName and menuName max 100 chars' }, { status: 400 });
  }

  // Validate tags
  const validatedTags = (tags ?? []).filter((t): t is string =>
    VALID_TAGS.includes(t as typeof VALID_TAGS[number])
  );

  // Location verification: reporter must be within 2km of the place
  if (placeLat != null && placeLng != null) {
    const distance = haversineDistance(lat, lng, placeLat, placeLng);
    if (distance > MAX_DISTANCE_KM) {
      return NextResponse.json(
        { error: '現在地から遠すぎます。店舗の近くで制報してください。' },
        { status: 422 }
      );
    }
  }

  // Save to Supabase
  const { error } = await supabase.from('reports').insert({
    place_id: placeId,
    place_name: placeName,
    menu_name: menuName,
    price,
    tags: validatedTags,
    reporter_lat: lat,
    reporter_lng: lng,
    status: 'pending',
  });

  if (error) {
    console.error('Supabase insert error:', error);
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
  }

  return NextResponse.json({ message: '制報を受け付けました。確認後に反映されます。' }, { status: 202 });
}
