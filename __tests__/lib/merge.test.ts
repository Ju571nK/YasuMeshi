import { normalizeName, mergeResults } from '@/lib/merge';
import type { Restaurant } from '@/lib/types';
import type { HotPepperShop } from '@/lib/hotpepper';

function g(over: Partial<Restaurant>): Restaurant {
  return {
    name: 'G', priceRange: null, walkMinutes: 1, isOpen: true, address: 'A',
    mapsUrl: '', placeId: 'g', lat: 35.69, lng: 139.70, priceSource: null, ...over,
  };
}
function shop(over: Partial<HotPepperShop>): HotPepperShop {
  return { name: 'S', lat: 35.69, lng: 139.70, budget: { start: 501, end: 1000 }, address: 'A', url: '', ...over };
}

describe('normalizeName', () => {
  it('strips spaces, symbols, company prefixes and lowercases', () => {
    expect(normalizeName('（株）Ａ Ｂ・Ｃ！')).toBe('abc');
  });
});

describe('mergeResults', () => {
  it('passes google through unchanged when hotpepper is null', () => {
    const r = mergeResults({ restaurants: [g({ priceRange: { start: 500, end: 700, currency: 'JPY' }, priceSource: 'google' })], unknownPrice: [] }, null, 35.69, 139.70);
    expect(r.restaurants).toHaveLength(1);
    expect(r.total).toBe(1);
  });

  it('fills price from a matched hotpepper shop', () => {
    const unpriced = g({ name: '牛丼太郎', priceRange: null, lat: 35.6900, lng: 139.7000 });
    const r = mergeResults({ restaurants: [], unknownPrice: [unpriced] }, [shop({ name: '牛丼 太郎', lat: 35.69001, lng: 139.70001 })], 35.69, 139.70);
    expect(r.restaurants).toHaveLength(1);
    expect(r.restaurants[0].priceSource).toBe('hotpepper');
    expect(r.restaurants[0].priceRange).toEqual({ start: 501, end: 1000, currency: 'JPY' });
    expect(r.unknownPrice).toHaveLength(0);
  });

  it('keeps google price when already present (no override)', () => {
    const priced = g({ name: '牛丼太郎', priceRange: { start: 400, end: 600, currency: 'JPY' }, priceSource: 'google', lat: 35.69, lng: 139.70 });
    const r = mergeResults({ restaurants: [priced], unknownPrice: [] }, [shop({ name: '牛丼太郎' })], 35.69, 139.70);
    expect(r.restaurants).toHaveLength(1);
    expect(r.restaurants[0].priceRange).toEqual({ start: 400, end: 600, currency: 'JPY' });
    expect(r.restaurants[0].priceSource).toBe('google');
  });

  it('does NOT match same name far away (chain branch guard)', () => {
    const far = g({ name: 'スターバックス', lat: 35.70, lng: 139.72 }); // ~2km away
    const r = mergeResults({ restaurants: [], unknownPrice: [far] }, [shop({ name: 'スターバックス', lat: 35.69, lng: 139.70, budget: { start: 501, end: 1000 } })], 35.69, 139.70);
    // far google stays unpriced; hotpepper added as its own
    expect(r.unknownPrice.some((x) => x.name === 'スターバックス' && x.priceSource === null)).toBe(true);
    expect(r.restaurants.some((x) => x.priceSource === 'hotpepper')).toBe(true);
    expect(r.total).toBe(2);
  });

  it('adds unmatched hotpepper shop as its own result', () => {
    const r = mergeResults({ restaurants: [], unknownPrice: [] }, [shop({ name: 'Solo', lat: 35.69, lng: 139.70 })], 35.69, 139.70);
    expect(r.restaurants).toHaveLength(1);
    expect(r.restaurants[0].name).toBe('Solo');
    expect(r.restaurants[0].priceSource).toBe('hotpepper');
  });

  it('does not mutate caller input objects', () => {
    const unpriced = g({ name: '牛丼太郎', priceRange: null, priceSource: null, lat: 35.69, lng: 139.70 });
    const input = { restaurants: [], unknownPrice: [unpriced] };
    mergeResults(input, [shop({ name: '牛丼太郎', lat: 35.69, lng: 139.70 })], 35.69, 139.70);
    expect(unpriced.priceRange).toBeNull();
    expect(unpriced.priceSource).toBeNull();
    expect(input.unknownPrice).toHaveLength(1);
  });

  it('sorts merged results by price ascending', () => {
    const r = mergeResults(
      { restaurants: [g({ name: 'Expensive', priceRange: { start: 2000, end: 3000, currency: 'JPY' }, priceSource: 'google', lat: 35.60, lng: 139.60 })], unknownPrice: [] },
      [shop({ name: 'Cheap', lat: 35.69, lng: 139.70, budget: { start: 0, end: 500 } })],
      35.69, 139.70
    );
    expect(r.restaurants.map((x) => x.name)).toEqual(['Cheap', 'Expensive']);
  });
});
