# HotPepper 하이브리드 가격 보강 — 설계 문서

- **작성일**: 2026-07-04
- **상태**: 승인됨 (구현 대기)
- **관련**: `CLAUDE.md` — "Google Places API is the only data source" 결정을 **완화**한다. HotPepper를 **가격 보강 + 결과 확장용 2차 소스**로 추가한다.

## 배경 / 문제

やすめし의 핵심 차별점은 **가격 오름차순 정렬**이다. 그러나 Google Places API (New)의 `priceRange` 필드는 일본에서 커버리지가 희박해, 많은 식당이 "가격 미상"(`unknownPrice`)으로 빠진다. 이는 핵심 UX를 약화시킨다.

HotPepper Gourmet Search API(리크루트, 무료)는 가맹점에 대해 명시적 `budget`(1인 저녁 예산 구간) 필드를 제공하며 일본 내 채움률이 높다. 이를 Google 결과에 병합해 가격 채움률을 높이고, HotPepper 전용 가게를 추가해 결과 폭을 넓힌다.

## 결정 사항 (확정)

| 항목 | 결정 | 근거 |
|------|------|------|
| **역할** | 합집합 확장 — 가격 채움 + HotPepper 전용 가게 추가 | 채움률과 결과 수 동시 개선 |
| **매칭** | 위치(≤50m) + 이름 유사도 **이중 신호** | 도쿄 도심 밀집 → 위치만은 옆가게 오매칭, 이름만은 체인 다지점 뭉갬 |
| **가격 화해** | `priceSource` 태그 + UI 배지, 같은 척도로 정렬 | 계수 보정은 근거 없음, 섹션 분리는 핵심 UX 훼손. 투명 표시 후 analytics 실측 |
| **안전장치** | 병렬 호출 + 2초 타임아웃 후 Google-only 폴백 | HotPepper 장애·지연이 앱 핵심을 죽이면 안 됨 |

### 알려진 트레이드오프 (의도적 감수)

- Google `priceRange`(메뉴 가격대)와 HotPepper `budget`(1인 예산)은 **의미가 다르며 예산이 보통 2~3배 크다**. 같은 척도로 섞어 정렬하면 HotPepper로 채운 가게가 실제보다 비싸 보여 뒤로 밀릴 수 있다. MVP에서는 `priceSource` 배지로 투명하게 노출하고, analytics로 영향도를 실측한 뒤 후속 조정한다.
- `meta.coverage`는 HotPepper로 가격이 채워진 가게 및 HotPepper 전용 가게를 포함한 **병합 후** 커버리지이므로, 프로토타입 단계의 "Google priceRange 순수 커버리지" 지표로 읽으면 안 된다.

## 아키텍처

### 모듈 구조

```
lib/hotpepper.ts   ← HotPepper Gourmet Search API 호출 + 응답 정규화
lib/merge.ts       ← Google ↔ HotPepper 병합·중복제거 (순수 함수)
lib/budget.ts      ← HotPepper budget 코드 → {start,end}엔 매핑 테이블
lib/types.ts       ← Restaurant.priceSource, meta.hotpepperOk 추가 (수정)
app/api/search/route.ts  ← 병렬 오케스트레이션 (수정)
app/components/...  ← 가격 배지 표시 (수정)
```

`merge.ts`는 **부수효과 없는 순수 함수**로 둔다. 매칭 로직이 이 기능의 심장이므로 네트워크·환경 의존 없이 독립적으로 유닛 테스트 가능해야 한다.

### 데이터 흐름

```
POST /api/search
  ├─ Promise.allSettled([
  │     searchNearby(params, googleKey)                 ← 기존 그대로
  │     searchHotPepper(params, hpKey, {timeoutMs:2000}) ← 신규, AbortController
  │  ])
  ├─ mergeResults(googleResult, hotpepperShops | null, userLat, userLng)
  │     (HotPepper rejected/timeout → null 전달 → Google 결과 그대로 통과)
  └─ SearchResponse { restaurants[], unknownPrice[], meta{ …, hotpepperOk } }
```

## 컴포넌트 상세

### `lib/hotpepper.ts`

- `searchHotPepper(params: SearchParams, apiKey: string, opts: { timeoutMs: number }): Promise<HotPepperShop[]>`
- HotPepper Gourmet Search API 호출. `AbortController`로 `timeoutMs` 초과 시 abort → throw (호출부에서 폴백).
- 파라미터 매핑:
  - `lat`/`lng` = `params.lat`/`params.lng`
  - `range` = Google `radius` 근사: 500→500m, 800→1000m, 1000→1000m
  - `count` = 50
  - cafe 탭 → `genre=G014`(カフェ・スイーツ); restaurant 탭 → 장르 무필터
  - `format=json`
- 응답을 `HotPepperShop`으로 정규화:
  ```ts
  interface HotPepperShop {
    name: string;
    lat: number;
    lng: number;
    budget: { start: number; end: number } | null;  // budget.code → lib/budget 매핑
    address: string;
    url: string;   // 매칭 실패 시 mapsUrl 대체 생성에 사용
  }
  ```

### `lib/budget.ts`

- HotPepper `budget.code`(예: `B002`)를 `{ start, end }`엔으로 매핑하는 정적 테이블.
- 매핑 불가 코드는 `null` 반환.
- **⚠️ 코드값은 구현 착수 시 공식 API 문서로 검증** (코드/버킷은 변경될 수 있음).

### `lib/merge.ts` — 매칭 알고리즘

`mergeResults(google: { restaurants, unknownPrice }, hotpepper: HotPepperShop[] | null, userLat, userLng): { restaurants, unknownPrice, total }`

1. `hotpepper == null` → Google 결과를 그대로 재정렬해 반환 (폴백 경로).
2. **이름 정규화** `normalizeName(s)`: 전각↔반각 통일, 공백·기호 제거, `株式会社`/지점 접미사 정리, 소문자화.
3. Google 결과(restaurants + unknownPrice) 전체를 후보로 두고, 각 HotPepper 가게에 대해:
   - **거리 ≤ 50m** (`lib/geo`의 하버사인 재사용) **그리고** **이름 유사도 ≥ 임계** 를 만족하는 Google 가게 탐색.
   - 이름 유사도: 정규화 후 한쪽이 다른 쪽을 포함하거나, 편집거리 비율 ≥ 0.6.
4. **매칭됨**:
   - Google 가게 유지. `priceRange == null`이면 HotPepper budget으로 채우고 `priceSource='hotpepper'`.
   - Google에 가격이 이미 있으면 Google 값 유지, `priceSource='google'`.
   - 해당 HotPepper 가게는 버림(dedup).
5. **매칭 안 됨**: HotPepper 전용 `Restaurant`로 추가.
   - `priceSource='hotpepper'`, `walkMinutes`는 좌표로 계산, `mapsUrl`은 좌표 기반 생성, `placeId`는 빈 문자열 또는 HotPepper id 프리픽스.
6. `priceRange` 유무로 `restaurants`/`unknownPrice` 재분류, 가격 오름차순 정렬.
7. Google 전용(매칭 안 된 Google 가게)의 `priceSource`: 가격 있으면 `'google'`, 없으면 `null`.
8. `total` = 병합 후 `restaurants.length + unknownPrice.length` (dedup 반영된 최종 결과 수). `meta.withPrice` = `restaurants.length`, `coverage` = `withPrice / total`.

### 타입 변경 (`lib/types.ts`)

```ts
interface Restaurant {
  // …기존 필드…
  priceSource: 'google' | 'hotpepper' | null;  // null = 가격 미상
}

interface SearchResponse {
  meta: {
    total: number;
    withPrice: number;
    coverage: number;
    hotpepperOk: boolean;  // HotPepper 호출 성공 여부 (analytics)
  };
}
```

### `app/api/search/route.ts` (수정)

- `HOTPEPPER_API_KEY` 환경변수 읽기 (미설정 시 HotPepper 스킵, Google-only, 로그만).
- `Promise.allSettled`로 Google + HotPepper 병렬 실행.
- Google이 rejected면 기존과 동일하게 502/500 처리.
- HotPepper가 rejected/timeout이면 `mergeResults(google, null, …)`, `hotpepperOk=false`.
- 병합은 try/catch로 격리 — 병합 실패 시에도 Google 결과는 보존.

### UI 배지 (`app/components/...`)

- 식당 카드에 `priceSource` 기반 라벨: `'google'` → **価格**, `'hotpepper'` → **予算**, `null` → 배지 없음.
- 의미 차이를 사용자에게 투명하게 전달.

## 환경 / 배포

- `HOTPEPPER_API_KEY`를 `.env.local`(로컬) 및 Vercel 환경변수(Production/Preview/Development)에 서버 전용으로 저장. `NEXT_PUBLIC_` 접두사 금지.
- 클라이언트는 기존과 동일하게 `/api/search`만 호출. HotPepper 직접 호출 없음(키 노출·CORS 방지).

## 조정 가능한 기본값

| 항목 | 기본값 |
|------|--------|
| 거리 임계값 | 50m |
| 이름 유사도 | 정규화 후 부분일치 또는 편집거리 비율 ≥ 0.6 |
| HotPepper `count` | 50 |
| HotPepper `range` | 500→500m, 800/1000→1000m |
| cafe 탭 장르 | `G014` |
| 타임아웃 | 2000ms |

## 테스트 전략

`__tests__`에 유닛 테스트 (순수 로직 우선):

- **budget 매핑**: 대표 코드 → 올바른 `{start,end}`, 미지 코드 → `null`.
- **이름 정규화**: 전각/반각, 기호, 접미사 케이스.
- **매칭**: 임계 안(같은 가게 병합) / 밖(별개 유지), 체인 다지점 오매칭 방지(같은 이름·먼 좌표는 별개).
- **dedup**: 매칭된 HotPepper 사본이 결과에 중복되지 않음.
- **가격 채움**: Google `null` → HotPepper budget으로 채움 + `priceSource='hotpepper'`; Google 가격 존재 → 유지 + `priceSource='google'`.
- **HotPepper 전용 추가**: 매칭 실패 가게가 결과에 추가됨.
- **폴백**: `hotpepper=null` → Google 결과만, 정렬 유지.
- **정렬**: 병합 후 가격 오름차순 유지.

## 범위 밖 (YAGNI)

- budget 계수 보정(정렬 정규화) — 데이터 실측 후 별도 판단.
- HotPepper 쿠폰·장르·역 정보 활용 — MVP 밖.
- Takeout(🍱) 탭의 HotPepper 매핑 — 현재 코드에 takeout 타입 미구현이므로 범위 밖.
- 캐싱 — 후속 최적화 과제.
