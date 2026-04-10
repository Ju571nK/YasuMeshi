import { POST } from '@/app/api/station/route';

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
  return new Request('http://localhost/api/station', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/station', () => {
  it('returns 400 when station is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when station is empty', async () => {
    const res = await POST(makeRequest({ station: '  ' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when station exceeds 50 chars', async () => {
    const res = await POST(makeRequest({ station: 'a'.repeat(51) }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when no station found', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });

    const res = await POST(makeRequest({ station: 'zzzzz存在しない' }));
    expect(res.status).toBe(404);
  });

  it('returns station coordinates on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{
          displayName: { text: '新宿駅' },
          location: { latitude: 35.6896, longitude: 139.7006 },
        }],
      }),
    });

    const res = await POST(makeRequest({ station: '新宿' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('新宿駅');
    expect(data.lat).toBe(35.6896);
    expect(data.lng).toBe(139.7006);
  });

  it('appends 駅 suffix to query', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{
          displayName: { text: '渋谷駅' },
          location: { latitude: 35.658, longitude: 139.7016 },
        }],
      }),
    });

    await POST(makeRequest({ station: '渋谷' }));
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.textQuery).toBe('渋谷駅');
  });

  it('does not double-append 駅 suffix', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{
          displayName: { text: '池袋駅' },
          location: { latitude: 35.7295, longitude: 139.7109 },
        }],
      }),
    });

    await POST(makeRequest({ station: '池袋駅' }));
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.textQuery).toBe('池袋駅');
  });

  it('returns 502 when Google API fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const res = await POST(makeRequest({ station: '新宿' }));
    expect(res.status).toBe(502);
  });

  it('returns 500 when API key is missing', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const res = await POST(makeRequest({ station: '新宿' }));
    expect(res.status).toBe(500);
  });
});
