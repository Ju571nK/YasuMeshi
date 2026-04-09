#!/bin/bash
# YasuMeshi priceRange 커버리지 테스트
# 도쿄 주요 10개 역세권에서 Google Places API priceRange 보유율 실측
#
# 사용법:
#   export GOOGLE_PLACES_API_KEY="your-key"
#   bash scripts/test-coverage.sh

set -euo pipefail

if [ -z "${GOOGLE_PLACES_API_KEY:-}" ]; then
  echo "ERROR: GOOGLE_PLACES_API_KEY 환경변수를 설정해주세요."
  echo "  export GOOGLE_PLACES_API_KEY=\"your-key\""
  exit 1
fi

# 도쿄 주요 10개 역 좌표
declare -a STATIONS=(
  "신주쿠|35.6896|139.7006"
  "시부야|35.6580|139.7016"
  "이케부쿠로|35.7295|139.7109"
  "도쿄|35.6812|139.7671"
  "시나가와|35.6284|139.7387"
  "우에노|35.7141|139.7774"
  "아키하바라|35.6984|139.7731"
  "신바시|35.6662|139.7583"
  "롯폰기|35.6627|139.7311"
  "나카메구로|35.6441|139.6987"
)

RADIUS=800
TOTAL_STATIONS=0
TOTAL_RESULTS=0
TOTAL_WITH_PRICE=0
PASS_COUNT=0

echo "====================================="
echo "YasuMeshi priceRange Coverage Test"
echo "반경: ${RADIUS}m / 최대 결과: 20개"
echo "====================================="
echo ""

for station in "${STATIONS[@]}"; do
  IFS='|' read -r name lat lng <<< "$station"

  response=$(curl -s -X POST "https://places.googleapis.com/v1/places:searchNearby" \
    -H "Content-Type: application/json" \
    -H "X-Goog-Api-Key: ${GOOGLE_PLACES_API_KEY}" \
    -H "X-Goog-FieldMask: places.displayName,places.priceRange,places.priceLevel,places.formattedAddress,places.types" \
    -d '{
      "includedTypes": ["restaurant"],
      "locationRestriction": {
        "circle": {
          "center": {"latitude": '"${lat}"', "longitude": '"${lng}"'},
          "radius": '"${RADIUS}"'.0
        }
      },
      "maxResultCount": 20,
      "languageCode": "ja"
    }' 2>/dev/null)

  # 에러 체크
  if echo "$response" | grep -q '"error"'; then
    error_msg=$(echo "$response" | grep -o '"message":"[^"]*"' | head -1)
    echo "[$name] ERROR: $error_msg"
    continue
  fi

  total=$(echo "$response" | grep -c '"displayName"' || echo "0")
  with_price=$(echo "$response" | grep -c '"priceRange"' || echo "0")
  with_level=$(echo "$response" | grep -c '"priceLevel"' || echo "0")

  if [ "$total" -gt 0 ]; then
    pct=$((with_price * 100 / total))
  else
    pct=0
  fi

  # 성공/실패 판정
  if [ "$with_price" -ge 5 ]; then
    status="✅ PASS"
    PASS_COUNT=$((PASS_COUNT + 1))
  elif [ "$with_price" -ge 3 ]; then
    status="⚠️  GRAY"
  else
    status="❌ FAIL"
  fi

  TOTAL_STATIONS=$((TOTAL_STATIONS + 1))
  TOTAL_RESULTS=$((TOTAL_RESULTS + total))
  TOTAL_WITH_PRICE=$((TOTAL_WITH_PRICE + with_price))

  printf "%-12s | 결과: %2d개 | priceRange: %2d개 (%3d%%) | priceLevel: %2d개 | %s\n" \
    "$name" "$total" "$with_price" "$pct" "$with_level" "$status"
done

echo ""
echo "====================================="
echo "종합 결과"
echo "====================================="
if [ "$TOTAL_RESULTS" -gt 0 ]; then
  TOTAL_PCT=$((TOTAL_WITH_PRICE * 100 / TOTAL_RESULTS))
else
  TOTAL_PCT=0
fi
echo "테스트 역: ${TOTAL_STATIONS}개"
echo "총 결과: ${TOTAL_RESULTS}개"
echo "priceRange 보유: ${TOTAL_WITH_PRICE}개 (${TOTAL_PCT}%)"
echo "PASS (5개+): ${PASS_COUNT}/${TOTAL_STATIONS}개 역"
echo ""

if [ "$PASS_COUNT" -ge 7 ]; then
  echo "🟢 GO — 대부분의 역에서 충분한 커버리지. MVP 진행 가능."
elif [ "$PASS_COUNT" -ge 4 ]; then
  echo "🟡 CONDITIONAL — 일부 역에서 부족. 보조 데이터 소스 병행 필요."
else
  echo "🔴 NO-GO — 커버리지 부족. 핫페퍼 API 테스트 또는 피벗 검토."
fi
