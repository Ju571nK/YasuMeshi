# HotPepper 하이브리드 가격 보강 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Places 결과에 HotPepper Gourmet API의 `budget`을 병합해 가격 채움률을 높이고, HotPepper 전용 가게를 합집합으로 추가한다.

**Architecture:** Vercel Route Handler(`/api/search`)에서 Google과 HotPepper를 `Promise.allSettled`로 병렬 호출하고, 순수 함수 `mergeResults`가 위치(≤50m)+이름 유사도 이중 신호로 중복을 제거·병합한다. HotPepper 실패/타임아웃 시 Google-only로 폴백한다.

**Tech Stack:** Next.js (App Router, Route Handler), TypeScript, Jest + ts-jest (testEnvironment: node), HotPepper Gourmet Search API v1.

## Global Constraints

- HotPepper 키는 **서버 전용** — 환경변수명 `HOTPEPPER_API_KEY`, `NEXT_PUBLIC_` 접두사 금지.
- `merge.ts`는 **부수효과 없는 순수 함수** (네트워크·env 의존 없음).
- 기존 테스트(`__tests__/api/search.test.ts`, `__tests__/lib/places.test.ts`)는 깨지면 안 된다. 기존 테스트는 `HOTPEPPER_API_KEY`를 설정하지 않으므로 라우트가 HotPepper를 스킵 → Google-only 경로로 통과해야 한다.
- 테스트 파일은 `__tests__/**/*.test.ts` 패턴, `@/` alias는 리포 루트 매핑.
- 거리 임계값 `50m`, 이름 유사도 `0.6`, HotPepper `count=50`, 타임아웃 `2000ms`, cafe 장르 `G014`, HotPepper `datum=world`(WGS84, Google 좌표와 정합).
- 커밋은 각 태스크 끝에서. 커밋 메시지 말미에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## 파일 구조

- `lib/budget.ts` (신규) — HotPepper `budget.code` → `{start,end}`엔 매핑.
- `lib/types.ts` (수정) — `Restaurant`에 `priceSource`, `lat`, `lng` 추가; `meta`에 `hotpepperOk`.
- `lib/places.ts` (수정) — `parsePlace`에서 `priceSource`/`lat`/`lng` 설정.
- `lib/hotpepper.ts` (신규) — `HotPepperShop` + `searchHotPepper`(타임아웃 포함).
- `lib/merge.ts` (신규) — `normalizeName` + `mergeResults` (병합의 심장, 순수 함수).
- `app/api/search/route.ts` (수정) — 병렬 오케스트레이션 + 폴백.
- `app/components/RestaurantCard.tsx` (수정) — 가격 출처 배지.

---

### Task 1: budget 코드 매핑 (`lib/budget.ts`)

**Files:**
- Create: `lib/budget.ts`
- Test: `__tests__/lib/budget.test.ts`

**Interfaces:**
- Produces: `budgetToRange(code: string | undefined): { start: number; end: number } | null`

> ⚠️ 코드→버킷 값은 HotPepper 공식 문서 기준 초안이다. 구현 시 `https://webservice.recruit.co.jp/doc/hotpepper/reference.html`의 budget master로 검증하고, 다르면 표만 수정한다(시그니처·로직 불변).

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/lib/budget.test.ts`:
```ts
import { budgetToRange } from '@/lib/budget';

describe('budgetToRange', () => {
  it('maps a low bucket to a yen range', () => {
    expect(budgetToRange('B010')).toEqual({ start: 501, end: 1000 });
  });

  it('maps the lowest bucket starting at 0', () => {
    expect(budgetToRange('B009')).toEqual({ start: 0, end: 500 });
  });

  it('maps an open-ended top bucket', () => {
    const r = budgetToRange('B014');
    expect(r?.start).toBe(30001);
    expect(r?.end).toBeGreaterThanOrEqual(30001);
  });

  it('returns null for unknown code', () => {
    expect(budgetToRange('ZZZZ')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(budgetToRange(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest __tests__/lib/budget.test.ts`
Expected: FAIL — `Cannot find module '@/lib/budget'`.

- [ ] **Step 3: 최소 구현**

`lib/budget.ts`:
```ts
/** HotPepper budget master code → yen range. Verify codes against official docs. */
const BUDGET_MAP: Record<string, { start: number; end: number }> = {
  B009: { start: 0, end: 500 },
  B010: { start: 501, end: 1000 },
  B011: { start: 1001, end: 1500 },
  B001: { start: 1501, end: 2000 },
  B002: { start: 2001, end: 3000 },
  B003: { start: 3001, end: 4000 },
  B008: { start: 4001, end: 5000 },
  B004: { start: 5001, end: 7000 },
  B005: { start: 7001, end: 10000 },
  B006: { start: 10001, end: 15000 },
  B012: { start: 15001, end: 20000 },
  B013: { start: 20001, end: 30000 },
  B014: { start: 30001, end: 40000 }, // open-ended; sentinel upper bound
};

export function budgetToRange(
  code: string | undefined
): { start: number; end: number } | null {
  if (!code) return null;
  return BUDGET_MAP[code] ?? null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest __tests__/lib/budget.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/budget.ts __tests__/lib/budget.test.ts
git commit -m "feat: HotPepper budget code to yen range mapping"
```

---

### Task 2: 타입 확장 + Google 파서 (`lib/types.ts`, `lib/places.ts`)

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/places.ts` (`parsePlace`, 그리고 반환 객체)
- Test: `__tests__/lib/places.test.ts` (기존, 필요 시 보강)

**Interfaces:**
- Produces: `Restaurant` = 기존 필드 + `priceSource: 'google' | 'hotpepper' | null`, `lat: number`, `lng: number`.
- Produces: `SearchResponse['meta']` = 기존 + `hotpepperOk: boolean`.
- `searchNearby(params, apiKey)` 반환 타입 불변: `{ restaurants: Restaurant[]; unknownPrice: Restaurant[]; total: number }` — 단, 각 `Restaurant`가 이제 `priceSource`/`lat`/`lng`를 포함.

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/lib/places.test.ts` 하단에 추가:
```ts
describe('parsePlace via searchNearby — priceSource & coords', () => {
  it('tags google price source and carries coordinates', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            displayName: { text: 'Priced' },
            priceRange: { startPrice: { currencyCode: 'JPY', units: '500' }, endPrice: { currencyCode: 'JPY', units: '900' } },
            currentOpeningHours: { openNow: true },
            location: { latitude: 35.69, longitude: 139.70 },
            id: 'p1',
          },
          {
            displayName: { text: 'Unknown' },
            currentOpeningHours: { openNow: true },
            location: { latitude: 35.6901, longitude: 139.7001 },
            id: 'u1',
          },
        ],
      }),
    });
    const { restaurants, unknownPrice } = await searchNearby(mockParams, 'k');
    expect(restaurants[0].priceSource).toBe('google');
    expect(restaurants[0].lat).toBeCloseTo(35.69);
    expect(restaurants[0].lng).toBeCloseTo(139.70);
    expect(unknownPrice[0].priceSource).toBeNull();
  });
});
```
(파일 상단에 `global.fetch = jest.fn()` 설정이 없으면 `beforeEach(() => { global.fetch = jest.fn(); })` 추가.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest __tests__/lib/places.test.ts`
Expected: FAIL — `priceSource` 프로퍼티 없음 / 타입 에러.

- [ ] **Step 3: 타입 수정**

`lib/types.ts`:
```ts
export interface Restaurant {
  name: string;
  priceRange: { start: number; end: number; currency: string } | null;
  walkMinutes: number;
  isOpen: boolean;
  address: string;
  mapsUrl: string;
  placeId: string;
  lat: number;
  lng: number;
  priceSource: 'google' | 'hotpepper' | null;
}

export interface SearchResponse {
  restaurants: Restaurant[];
  unknownPrice: Restaurant[];
  meta: {
    total: number;
    withPrice: number;
    coverage: number;
    hotpepperOk: boolean;
  };
}
```
(`SearchParams`, 상수들은 그대로.)

- [ ] **Step 4: 파서 수정**

`lib/places.ts`의 `parsePlace` 반환 객체를 교체:
```ts
  const placeLat = place.location?.latitude ?? 0;
  const placeLng = place.location?.longitude ?? 0;

  return {
    name: place.displayName?.text ?? '名称不明',
    priceRange,
    walkMinutes: walkMinutes(userLat, userLng, placeLat, placeLng),
    isOpen: place.currentOpeningHours?.openNow ?? false,
    address: place.formattedAddress ?? '',
    mapsUrl: buildMapsUrl(place),
    placeId: place.id ?? '',
    lat: placeLat,
    lng: placeLng,
    priceSource: priceRange ? 'google' : null,
  };
```

- [ ] **Step 5: 테스트 통과 + 전체 스위트 확인**

Run: `npx jest __tests__/lib/places.test.ts && npx tsc --noEmit`
Expected: PASS, 타입 에러 0. (전체: `npx jest` — 기존 테스트 유지 확인.)

- [ ] **Step 6: 커밋**

```bash
git add lib/types.ts lib/places.ts __tests__/lib/places.test.ts
git commit -m "feat: add priceSource and coords to Restaurant, hotpepperOk to meta"
```

---

### Task 3: HotPepper 클라이언트 (`lib/hotpepper.ts`)

**Files:**
- Create: `lib/hotpepper.ts`
- Test: `__tests__/lib/hotpepper.test.ts`

**Interfaces:**
- Consumes: `budgetToRange` (Task 1), `SearchParams` (types).
- Produces:
  ```ts
  interface HotPepperShop { name: string; lat: number; lng: number; budget: { start: number; end: number } | null; address: string; url: string; }
  function searchHotPepper(params: SearchParams, apiKey: string, opts: { timeoutMs: number }): Promise<HotPepperShop[]>
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/lib/hotpepper.test.ts`:
```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest __tests__/lib/hotpepper.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현**

`lib/hotpepper.ts`:
```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest __tests__/lib/hotpepper.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/hotpepper.ts __tests__/lib/hotpepper.test.ts
git commit -m "feat: HotPepper Gourmet Search client with timeout"
```

---

### Task 4: 병합 로직 (`lib/merge.ts`) — 핵심

**Files:**
- Create: `lib/merge.ts`
- Test: `__tests__/lib/merge.test.ts`

**Interfaces:**
- Consumes: `haversineDistance`, `walkMinutes` (`lib/geo`), `Restaurant` (types), `HotPepperShop` (hotpepper).
- Produces:
  ```ts
  function normalizeName(name: string): string
  function mergeResults(
    google: { restaurants: Restaurant[]; unknownPrice: Restaurant[] },
    hotpepper: HotPepperShop[] | null,
    userLat: number,
    userLng: number
  ): { restaurants: Restaurant[]; unknownPrice: Restaurant[]; total: number }
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/lib/merge.test.ts`:
```ts
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

  it('sorts merged results by price ascending', () => {
    const r = mergeResults(
      { restaurants: [g({ name: 'Expensive', priceRange: { start: 2000, end: 3000, currency: 'JPY' }, priceSource: 'google', lat: 35.60, lng: 139.60 })], unknownPrice: [] },
      [shop({ name: 'Cheap', lat: 35.69, lng: 139.70, budget: { start: 0, end: 500 } })],
      35.69, 139.70
    );
    expect(r.restaurants.map((x) => x.name)).toEqual(['Cheap', 'Expensive']);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest __tests__/lib/merge.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`lib/merge.ts`:
```ts
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
    placeId: '',
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
          r.priceRange = { start: shop.budget.start, end: shop.budget.end, currency: 'JPY' };
          r.priceSource = 'hotpepper';
        }
        // Google 가격이 이미 있으면 유지 (dedup만).
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest __tests__/lib/merge.test.ts && npx tsc --noEmit`
Expected: PASS (7 tests), 타입 에러 0.

- [ ] **Step 5: 커밋**

```bash
git add lib/merge.ts __tests__/lib/merge.test.ts
git commit -m "feat: mergeResults — geo+name dual-signal dedup and price fill"
```

---

### Task 5: 라우트 통합 (`app/api/search/route.ts`)

**Files:**
- Modify: `app/api/search/route.ts`
- Test: `__tests__/api/search.test.ts` (기존 유지 + 신규 케이스)

**Interfaces:**
- Consumes: `searchNearby` (places), `searchHotPepper` (hotpepper), `mergeResults` (merge).
- Produces: `SearchResponse` JSON with `meta.hotpepperOk`.

- [ ] **Step 1: 신규 테스트 작성 (기존 파일에 추가)**

`__tests__/api/search.test.ts`의 imports 아래, describe 안에 추가. 이 케이스는 `HOTPEPPER_API_KEY`를 설정하고, fetch를 URL로 분기한다:
```ts
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
```
그리고 `afterEach`가 `process.env`를 복원하므로 `HOTPEPPER_API_KEY` 누수는 없다 (기존 `afterEach(() => { process.env = originalEnv; ... })` 확인).

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest __tests__/api/search.test.ts`
Expected: FAIL — 신규 케이스에서 `hotpepperOk`/`priceSource` undefined.

- [ ] **Step 3: 라우트 구현**

`app/api/search/route.ts`의 import에 추가:
```ts
import { searchHotPepper } from '@/lib/hotpepper';
import { mergeResults } from '@/lib/merge';
```
그리고 `POST` 함수의 `try { ... }` 블록(현재 line 62~83)을 교체:
```ts
  try {
    const googleKey = apiKey;
    const hpKey = process.env.HOTPEPPER_API_KEY;

    const [googleRes, hpRes] = await Promise.allSettled([
      searchNearby(params, googleKey),
      hpKey
        ? searchHotPepper(params, hpKey, { timeoutMs: 2000 })
        : Promise.reject(new Error('HotPepper key not configured')),
    ]);

    if (googleRes.status === 'rejected') {
      const message = googleRes.reason instanceof Error ? googleRes.reason.message : 'Unknown error';
      if (message.includes('Google Places API error')) {
        return NextResponse.json({ error: message }, { status: 502 });
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const google = googleRes.value;
    const hotpepper = hpRes.status === 'fulfilled' ? hpRes.value : null;
    const hotpepperOk = hpRes.status === 'fulfilled';

    let merged: { restaurants: typeof google.restaurants; unknownPrice: typeof google.unknownPrice; total: number };
    try {
      merged = mergeResults(
        { restaurants: google.restaurants, unknownPrice: google.unknownPrice },
        hotpepper,
        params.lat,
        params.lng
      );
    } catch {
      merged = {
        restaurants: google.restaurants,
        unknownPrice: google.unknownPrice,
        total: google.restaurants.length + google.unknownPrice.length,
      };
    }

    const withPrice = merged.restaurants.length;
    const response: SearchResponse = {
      restaurants: merged.restaurants,
      unknownPrice: merged.unknownPrice,
      meta: {
        total: merged.total,
        withPrice,
        coverage: merged.total > 0 ? Math.round((withPrice / merged.total) * 100) / 100 : 0,
        hotpepperOk,
      },
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
```
(`apiKey` 미설정 시 500 반환하는 기존 상단 가드 line 39~45는 그대로 둔다.)

- [ ] **Step 4: 전체 테스트 + 타입 확인**

Run: `npx jest __tests__/api/search.test.ts && npx jest && npx tsc --noEmit`
Expected: 기존 8 케이스 + 신규 2 케이스 PASS, 타입 에러 0.

- [ ] **Step 5: 커밋**

```bash
git add app/api/search/route.ts __tests__/api/search.test.ts
git commit -m "feat: parallel Google+HotPepper search with graceful fallback"
```

---

### Task 6: 가격 출처 배지 (`RestaurantCard.tsx`)

**Files:**
- Modify: `app/components/RestaurantCard.tsx`

**Interfaces:**
- Consumes: `Restaurant.priceSource` (Task 2).

> 컴포넌트 테스트 하네스가 없다(`testMatch`는 `*.test.ts`, env는 node). 이 태스크의 게이트는 타입체크 + lint + 빌드다.

- [ ] **Step 1: 배지 추가**

`app/components/RestaurantCard.tsx`의 가격 표시 블록을 교체. 현재:
```tsx
          {priceRange ? (
            <span className="font-semibold text-orange-600">
              ¥{priceRange.start.toLocaleString()}〜¥{priceRange.end.toLocaleString()}
            </span>
          ) : (
            <span className="text-gray-400">価格情報なし</span>
          )}
```
교체 후:
```tsx
          {priceRange ? (
            <span className="font-semibold text-orange-600 flex items-center gap-1">
              {restaurant.priceSource === 'hotpepper' && (
                <span className="text-[10px] font-normal bg-gray-100 text-gray-500 px-1 py-0.5 rounded">予算</span>
              )}
              {restaurant.priceSource === 'google' && (
                <span className="text-[10px] font-normal bg-gray-100 text-gray-500 px-1 py-0.5 rounded">価格</span>
              )}
              ¥{priceRange.start.toLocaleString()}〜¥{priceRange.end.toLocaleString()}
            </span>
          ) : (
            <span className="text-gray-400">価格情報なし</span>
          )}
```
(`restaurant`는 이미 컴포넌트 프롭으로 존재. `priceSource`는 구조분해에 추가할 필요 없이 `restaurant.priceSource`로 접근.)

- [ ] **Step 2: 타입·린트·빌드 확인**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 에러 0, 빌드 성공.

- [ ] **Step 3: 커밋**

```bash
git add app/components/RestaurantCard.tsx
git commit -m "feat: show price source badge (予算/価格) on restaurant card"
```

---

## 알려진 한계 (구현 후 문서화 대상)

- HotPepper 검색 API는 **실시간 영업 상태**를 주지 않아 HotPepper 전용 가게는 `isOpen=true`로 표시된다. Google `openNow` 필터를 우회하므로 폐점 가게가 노출될 수 있음. 후속: HotPepper 영업시간 파싱 또는 별도 표기.
- budget/genre/range 코드값은 착수 시 공식 문서로 검증 필요.
- 예산(budget) vs 메뉴가격(priceRange) 의미 차이로 정렬이 부정확할 수 있음 — `priceSource` 배지로 투명화, analytics 실측 후 판단.

## Self-Review 결과

- **스펙 커버리지:** 역할(B, 합집합) → Task 4/5; 매칭(A, 위치+이름) → Task 4; 가격 태그(A) → Task 2/6; 폴백(A, 병렬+타임아웃) → Task 3/5. budget 매핑 → Task 1. 전 항목 태스크 존재.
- **정제:** 매칭에 좌표 필요 → `Restaurant`에 `lat`/`lng` 추가(Task 2). 스펙에 없던 구현 세부지만 알고리즘상 필수.
- **타입 일관성:** `Restaurant.priceSource`/`lat`/`lng`, `HotPepperShop`, `mergeResults`/`searchHotPepper`/`budgetToRange` 시그니처가 태스크 간 일치.
- **플레이스홀더:** 없음. 모든 코드 블록 완전.
