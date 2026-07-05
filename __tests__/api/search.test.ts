import { POST } from '@/app/api/search/route';

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, GOOGLE_PLACES_API_KEY: 'test-key' };
  global.fetch = jest.fn();
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/search', () => {
  it('returns 400 when lat is missing', async () => {
    const res = await POST(makeRequest({ lng: 139.7006 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('lat');
  });

  it('returns 400 when lng is missing', async () => {
    const res = await POST(makeRequest({ lat: 35.6896 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('lng');
  });

  it('returns 400 when lat is out of range', async () => {
    const res = await POST(makeRequest({ lat: 999, lng: 139.7006 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid radius', async () => {
    const res = await POST(makeRequest({ lat: 35.6896, lng: 139.7006, radius: 999 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('radius');
  });

  it('returns 200 with valid params', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            displayName: { text: 'Test Restaurant' },
            priceRange: {
              startPrice: { currencyCode: 'JPY', units: '500' },
              endPrice: { currencyCode: 'JPY', units: '1000' },
            },
            currentOpeningHours: { openNow: true },
            formattedAddress: 'Tokyo',
            location: { latitude: 35.69, longitude: 139.70 },
            id: 'test-1',
          },
        ],
      }),
    });

    const res = await POST(makeRequest({ lat: 35.6896, lng: 139.7006 }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.restaurants).toHaveLength(1);
    expect(data.meta.total).toBe(1);
    expect(data.meta.withPrice).toBe(1);
    expect(data.meta.coverage).toBe(1);
  });

  it('returns 502 when Google API fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const res = await POST(makeRequest({ lat: 35.6896, lng: 139.7006 }));
    expect(res.status).toBe(502);
  });

  it('returns 500 when API key is missing', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const res = await POST(makeRequest({ lat: 35.6896, lng: 139.7006 }));
    expect(res.status).toBe(500);
  });

  it('calculates coverage correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            displayName: { text: 'A' },
            priceRange: { startPrice: { currencyCode: 'JPY', units: '500' } },
            currentOpeningHours: { openNow: true },
            location: { latitude: 35.69, longitude: 139.70 },
            id: 'a',
          },
          {
            displayName: { text: 'B' },
            currentOpeningHours: { openNow: true },
            location: { latitude: 35.69, longitude: 139.70 },
            id: 'b',
          },
        ],
      }),
    });

    const res = await POST(makeRequest({ lat: 35.6896, lng: 139.7006 }));
    const data = await res.json();

    expect(data.meta.total).toBe(2);
    expect(data.meta.withPrice).toBe(1);
    expect(data.meta.coverage).toBe(0.5);
  });

  it('merges hotpepper price and sets hotpepperOk', async () => {
    process.env.HOTPEPPER_API_KEY = 'hp-key';
    (global.fetch as jest.Mock).mockImplementation((input: unknown) => {
      const u = String(input);
      if (u.includes('googleapis')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ places: [
            { displayName: { text: '牛丼太郎' }, currentOpeningHours: { openNow: true }, location: { latitude: 35.69, longitude: 139.70 }, id: 'u1' },
          ] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ results: { shop: [
          { name: '牛丼 太郎', lat: '35.69001', lng: '139.70001', budget: { code: 'B010' }, address: 'x', urls: { pc: 'http://hp' } },
        ] } }),
      });
    });

    const res = await POST(makeRequest({ lat: 35.6896, lng: 139.7006 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.meta.hotpepperOk).toBe(true);
    expect(data.restaurants).toHaveLength(1);
    expect(data.restaurants[0].priceSource).toBe('hotpepper');
  });

  it('reports hotpepperOk false when merge fails after successful fetch', async () => {
    process.env.HOTPEPPER_API_KEY = 'hp-key';
    const spy = jest.spyOn(require('@/lib/merge'), 'mergeResults').mockImplementation(() => { throw new Error('merge boom'); });
    (global.fetch as jest.Mock).mockImplementation((input: unknown) => {
      const u = String(input);
      if (u.includes('googleapis')) {
        return Promise.resolve({ ok: true, json: async () => ({ places: [ { displayName: { text: 'A' }, priceRange: { startPrice: { currencyCode: 'JPY', units: '500' } }, currentOpeningHours: { openNow: true }, location: { latitude: 35.69, longitude: 139.70 }, id: 'a' } ] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ results: { shop: [] } }) });
    });
    const res = await POST(makeRequest({ lat: 35.6896, lng: 139.7006 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.meta.hotpepperOk).toBe(false);
    expect(data.restaurants).toHaveLength(1);
    spy.mockRestore();
  });

  it('falls back to google-only when hotpepper fails', async () => {
    process.env.HOTPEPPER_API_KEY = 'hp-key';
    (global.fetch as jest.Mock).mockImplementation((input: unknown) => {
      const u = String(input);
      if (u.includes('googleapis')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ places: [
            { displayName: { text: 'A' }, priceRange: { startPrice: { currencyCode: 'JPY', units: '500' } }, currentOpeningHours: { openNow: true }, location: { latitude: 35.69, longitude: 139.70 }, id: 'a' },
          ] }),
        });
      }
      return Promise.resolve({ ok: false, status: 500 });
    });

    const res = await POST(makeRequest({ lat: 35.6896, lng: 139.7006 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.meta.hotpepperOk).toBe(false);
    expect(data.restaurants).toHaveLength(1);
  });
});
