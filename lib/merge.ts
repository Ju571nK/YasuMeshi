import { haversineDistance, walkMinutes } from './geo';
import type { Restaurant } from './types';
import type { HotPepperShop } from './hotpepper';

const MATCH_DISTANCE_M = 50;
const NAME_SIMILARITY_THRESHOLD = 0.6;

const COMPANY_RE = /株式会社|有限会社|（株）|\(株\)|（有）|\(有\)/g;
const SYMBOL_RE = /[!-/:-@[-`{-~、。・「」『』（）【】〜～]/g;
const SPACE_RE = /[\s　]+/g;

export function normalizeName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(COMPANY_RE, '')
    .replace(SYMBOL_RE, '')
    .replace(SPACE_RE, '')
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function hotpepperToRestaurant(shop: HotPepperShop, userLat: number, userLng: number): Restaurant {
  const priceRange = shop.budget
    ? { start: shop.budget.start, end: shop.budget.end, currency: 'JPY' }
    : null;
  return {
    name: shop.name,
    priceRange,
    walkMinutes: walkMinutes(userLat, userLng, shop.lat, shop.lng),
    isOpen: true, // HotPepper 검색은 실시간 영업정보를 주지 않음 (알려진 한계)
    address: shop.address,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`,
    placeId: shop.id ? `hp:${shop.id}` : '',
    lat: shop.lat,
    lng: shop.lng,
    priceSource: priceRange ? 'hotpepper' : null,
  };
}

export function mergeResults(
  google: { restaurants: Restaurant[]; unknownPrice: Restaurant[] },
  hotpepper: HotPepperShop[] | null,
  userLat: number,
  userLng: number
): { restaurants: Restaurant[]; unknownPrice: Restaurant[]; total: number } {
  // google 항목만으로 candidate 집합 구성 (priceSource는 parsePlace가 이미 세팅).
  const merged: Restaurant[] = [...google.restaurants, ...google.unknownPrice];

  if (hotpepper && hotpepper.length > 0) {
    const norms = merged.map((r) => normalizeName(r.name)); // google 후보에만 정렬 대응
    const extras: Restaurant[] = [];

    for (const shop of hotpepper) {
      const shopNorm = normalizeName(shop.name);
      let matchIdx = -1;
      for (let i = 0; i < norms.length; i++) {
        const r = merged[i];
        const dist = haversineDistance(shop.lat, shop.lng, r.lat, r.lng);
        if (dist <= MATCH_DISTANCE_M && similarity(shopNorm, norms[i]) >= NAME_SIMILARITY_THRESHOLD) {
          matchIdx = i;
          break;
        }
      }
      if (matchIdx >= 0) {
        const r = merged[matchIdx];
        if (r.priceRange == null && shop.budget != null) {
          merged[matchIdx] = {
            ...r,
            priceRange: { start: shop.budget.start, end: shop.budget.end, currency: 'JPY' },
            priceSource: 'hotpepper',
          };
        }
        // Google 가격이 이미 있으면 유지 (dedup만). 두 번째 HotPepper 매치는 의도적으로 무시 (50m 이내 동일 후보는 물리적으로 불가능하므로 중복 근사로 간주).
      } else {
        extras.push(hotpepperToRestaurant(shop, userLat, userLng));
      }
    }
    merged.push(...extras);
  }

  const restaurants = merged.filter((r) => r.priceRange != null);
  const unknownPrice = merged.filter((r) => r.priceRange == null);
  restaurants.sort((a, b) => a.priceRange!.start - b.priceRange!.start);

  return { restaurants, unknownPrice, total: merged.length };
}
