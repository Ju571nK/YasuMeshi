export interface Restaurant {
  name: string;
  priceRange: { start: number; end: number; currency: string } | null;
  walkMinutes: number;
  isOpen: boolean;
  address: string;
  mapsUrl: string;
  placeId: string;
}

export interface SearchResponse {
  restaurants: Restaurant[];
  unknownPrice: Restaurant[];
  meta: {
    total: number;
    withPrice: number;
    coverage: number;
  };
}

export interface SearchParams {
  lat: number;
  lng: number;
  radius: 500 | 800 | 1000;
  type: 'restaurant' | 'cafe';
  openNow: boolean;
}

export const VALID_RADII = [500, 800, 1000] as const;
export const VALID_TYPES = ['restaurant', 'cafe'] as const;

export const DEFAULT_LOCATION = { lat: 35.6812, lng: 139.7671 }; // 도쿄역
export const DEFAULT_RADIUS = 800 as const;
export const DEFAULT_TYPE = 'restaurant' as const;
