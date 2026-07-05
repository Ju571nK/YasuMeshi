import { searchHotPepper } from '@/lib/hotpepper';
import type { SearchParams } from '@/lib/types';

const params: SearchParams = { lat: 35.6896, lng: 139.7006, radius: 800, type: 'restaurant', openNow: true };

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); });

describe('searchHotPepper', () => {
  it('normalizes shops and maps budget', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: { shop: [
          { name: '牛丼 太郎', lat: '35.6900', lng: '139.7010', budget: { code: 'B010' }, address: '東京', urls: { pc: 'http://hp/1' } },
          { name: 'No Budget', lat: '35.69', lng: '139.70', budget: {}, address: 'X', urls: { pc: 'http://hp/2' } },
        ] },
      }),
    });
    const shops = await searchHotPepper(params, 'k', { timeoutMs: 2000 });
    expect(shops).toHaveLength(2);
    expect(shops[0]).toMatchObject({ name: '牛丼 太郎', lat: 35.69, budget: { start: 501, end: 1000 } });
    expect(shops[1].budget).toBeNull();
  });

  it('returns empty array when no shops', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: {} }) });
    expect(await searchHotPepper(params, 'k', { timeoutMs: 2000 })).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    await expect(searchHotPepper(params, 'k', { timeoutMs: 2000 })).rejects.toThrow('HotPepper');
  });

  it('sends cafe genre and world datum', async () => {
    const mock = (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: { shop: [] } }) });
    await searchHotPepper({ ...params, type: 'cafe' }, 'mykey', { timeoutMs: 2000 });
    const calledUrl = String(mock.mock.calls[0][0]);
    expect(calledUrl).toContain('genre=G014');
    expect(calledUrl).toContain('datum=world');
    expect(calledUrl).toContain('key=mykey');
  });
});
