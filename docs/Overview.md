## 📱 앱 개요

일본 내 저렴한 식당의 실제 가격 정보를 지도 기반으로 검색·리스트화할 수 있는 모바일 앱.

**최우선 연결접점: Google Places API 단독** — 가격 정보가 없는 가게는 최하위로 분류.

---

## 🎯 핵심 기능

- 현재 위치 또는 역명 기준 주변 식당 검색
- 가격대 필터링 (¥500 이하 / ¥1000 이하 / ¥1500 이하 등)
- 음식 카테고리별 필터 (라멘, 정식, 이자카야, 카레 등)
- 지도 뷰 + 리스트 뷰 전환
- 런치 / 디너 시간대별 가격 표시

---

## 💰 수익 모델

### 1. 배너 광고

- Google AdMob 기반
- 점심시간대 CTR 높음 → 광고 단가 유리
- 예상 수익: MAU 1만 기준 월 3~10만엔

### 2. 행동 데이터 판매 (부수익)

| 데이터 종류 | 잠재 구매처 |
| --- | --- |
| 지역별 가격대 수요 | 부동산 회사, 상업시설 개발사 |
| 음식 카테고리 인기도 | 식품 제조사, 프랜차이즈 본사 |
| 시간대별 검색 패턴 | 마케팅 회사, 광고대행사 |
| 역세권별 가성비 수요 | 음식점 출점 컨설팅 |

> ⚠️ 데이터는 익명화·집계화 후 제공 → 개인정보보호법 준수 용이
> 

---

## 🔌 데이터 소스 전략

**단독 소스: Google Places API (New)**

- `priceRange` 필드 보유 가게 → 리스트 상위 (가격 낮은 순 정렬)
- `priceRange` 없는 가게 → 리스트 최하위 ("가격 정보 없음" 표시)
- ホットペッパー / 食べログ 등 외부 API는 MVP 단계에서 사용 안 함

> 향후 커버리지 부족 시 보조 소스 추가 검토 (v2 이후)
> 

---

## 🛠 기술 스택

- **Frontend**: React Native (Expo)
- **API**: Google Places API (단독)
- **광고**: Google AdMob
- **분석/수집**: Firebase Analytics
- **데이터**: BigQuery (집계·판매용)

---

## ⚖️ 법적 고려사항

- 위치정보는 個人情報保護法 준수 필요
- 데이터 판매 시 プライバシーポリシーに明示 필수
- 익명화·집계 데이터는 판매 제약 적음

---

## 🚀 다음 단계 (MVP)

- [ ]  Google Places API 키 취득 및 설정
- [ ]  Expo 프로젝트 초기화
- [ ]  위치 기반 식당 검색 기본 화면 구현
- [ ]  가격 필터 UI 구현
- [ ]  AdMob 연동

[🗺️ 유저 시나리오 설계](https://www.notion.so/33ca6fc55ade8139b6f2c70219097254?pvs=21)

[🔌 데이터 소스 방침 — Google Places 단독 / 가격 없으면 미표시](https://www.notion.so/Google-Places-33ca6fc55ade81c1b39ee0ecd641f183?pvs=21)

[🔄 데이터 플라이휠 전략 — Google Maps 생태계 간접 활성화](https://www.notion.so/Google-Maps-33ca6fc55ade811fbe03e588bc47456b?pvs=21)

[📋 やすめし — 컨셉 기획서 v1.0](https://www.notion.so/v1-0-33ca6fc55ade814bbb53d5c398f8fcb6?pvs=21)

[🔑 Google Places API 키 취득 가이드 (2026 최신)](https://www.notion.so/Google-Places-API-2026-33ca6fc55ade8123ac9affb32daeb06a?pvs=21)

[📊 데이터 판매 프레임 — MAU 5,000 이전 준비 로드맵](https://www.notion.so/MAU-5-000-33ca6fc55ade8146a94afbdc10c9b5d8?pvs=21)