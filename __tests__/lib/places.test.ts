import { searchNearby } from '@/lib/places';
import type { SearchParams } from '@/lib/types';

const mockParams: SearchParams = {
  lat: 35.6896,
  lng: 139.7006,
  radius: 800,
  type: 'restaurant',
  openNow: true,
};

const mockPlacesResponse = {
  places: [
    {
      displayName: { text: '松屋 新宿店' },
      priceRange: {
        startPrice: { currencyCode: 'JPY', units: '500' },
        endPrice: { currencyCode: 'JPY', units: '1000' },
      },
      currentOpeningHours: { openNow: true },
      formattedAddress: '東京都新宿区',
      location: { latitude: 35.6900, longitude: 139.7010 },
      id: 'place-1',
    },
    {
      displayName: { text: '吉野家 新宿店' },
      priceRange: {
        startPrice: { currencyCode: 'JPY', units: '400' },
        endPrice: { currencyCode: 'JPY', units: '800' },
      },
      currentOpeningHours: { openNow: true },
      formattedAddress: '東京都新宿区',
      location: { latitude: 35.6905, longitude: 139.7015 },
      id: 'place-2',
    },
    {
      displayName: { text: '名前不明の店' },
      currentOpeningHours: { openNow: false },
      formattedAddress: '東京都新宿区',
      location: { latitude: 35.6910, longitude: 139.7020 },
      id: 'place-3',
    },
  ],
};

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('searchNearby', () => {
  it('parses places with priceRange correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockPlacesResponse,
    });

    const result = await searchNearby(mockParams, 'test-key');

    expect(result.restaurants).toHaveLength(2);
    expect(result.unknownPrice).toHaveLength(1);
    expect(result.total).toBe(3);
  });

  it('sorts restaurants by price ascending', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockPlacesResponse,
    });

    const result = await searchNearby(mockParams, 'test-key');

    expect(result.restaurants[0].name).toBe('吉野家 新宿店'); // ¥400
    expect(result.restaurants[1].name).toBe('松屋 新宿店');   // ¥500
  });

  it('separates unknown price restaurants', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockPlacesResponse,
    });

    const result = await searchNearby(mockParams, 'test-key');

    expect(result.unknownPrice[0].name).toBe('名前不明の店');
    expect(result.unknownPrice[0].priceRange).toBeNull();
  });

  it('handles empty results', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });

    const result = await searchNearby(mockParams, 'test-key');

    expect(result.restaurants).toHaveLength(0);
    expect(result.unknownPrice).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('handles missing places field', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const result = await searchNearby(mockParams, 'test-key');

    expect(result.total).toBe(0);
  });

  it('throws on API error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(searchNearby(mockParams, 'bad-key')).rejects.toThrow(
      'Google Places API error: 401 Unauthorized'
    );
  });

  it('calculates walk minutes for each restaurant', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockPlacesResponse,
    });

    const result = await searchNearby(mockParams, 'test-key');

    for (const r of [...result.restaurants, ...result.unknownPrice]) {
      expect(typeof r.walkMinutes).toBe('number');
      expect(r.walkMinutes).toBeGreaterThanOrEqual(0);
    }
  });
});
