import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  let body: { googlePlaceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const googlePlaceId = body.googlePlaceId?.trim();
  if (!googlePlaceId) {
    return NextResponse.json({ error: 'googlePlaceId is required' }, { status: 400 });
  }

  // Find place by google_place_id
  const { data: place } = await supabase
    .from('places')
    .select('id')
    .eq('google_place_id', googlePlaceId)
    .single();

  if (!place) {
    return NextResponse.json({ reports: [] });
  }

  // Get approved reports for this place
  const { data: reports, error } = await supabase
    .from('reports')
    .select('menu_name, price, tags, upvotes, downvotes, created_at')
    .eq('place_id', place.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Supabase query error:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }

  return NextResponse.json({ reports: reports ?? [] });
}
