import { budgetToRange } from './budget';
import type { SearchParams } from './types';

const HOTPEPPER_URL = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/';

export interface HotPepperShop {
  name: string;
  lat: number;
  lng: number;
  budget: { start: number; end: number } | null;
  address: string;
  url: string;
}

interface RawShop {
  name?: string;
  lat?: string | number;
  lng?: string | number;
  budget?: { code?: string };
  address?: string;
  urls?: { pc?: string };
}

/** HotPepper range code: 1=300m 2=500m 3=1000m 4=2000m 5=3000m */
function radiusToRange(radius: number): number {
  if (radius <= 500) return 2;
  return 3;
}

function normalizeShop(s: RawShop): HotPepperShop {
  return {
    name: s.name ?? '',
    lat: Number(s.lat),
    lng: Number(s.lng),
    budget: budgetToRange(s.budget?.code),
    address: s.address ?? '',
    url: s.urls?.pc ?? '',
  };
}

export async function searchHotPepper(
  params: SearchParams,
  apiKey: string,
  opts: { timeoutMs: number }
): Promise<HotPepperShop[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const url = new URL(HOTPEPPER_URL);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('lat', String(params.lat));
    url.searchParams.set('lng', String(params.lng));
    url.searchParams.set('range', String(radiusToRange(params.radius)));
    url.searchParams.set('count', '50');
    url.searchParams.set('format', 'json');
    url.searchParams.set('datum', 'world');
    if (params.type === 'cafe') url.searchParams.set('genre', 'G014');

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HotPepper API error: ${res.status}`);
    }
    const data = await res.json();
    const shops: RawShop[] = data?.results?.shop ?? [];
    return shops.map(normalizeShop);
  } finally {
    clearTimeout(timer);
  }
}
