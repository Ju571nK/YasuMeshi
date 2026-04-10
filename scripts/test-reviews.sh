#!/bin/bash
# YasuMeshi 리뷰 데이터 품질 테스트
set -euo pipefail

if [ -z "${GOOGLE_PLACES_API_KEY:-}" ]; then
  echo "ERROR: GOOGLE_PLACES_API_KEY 환경변수를 설정해주세요."
  exit 1
fi

TMPDIR_REVIEWS=$(mktemp -d)
trap 'rm -rf "$TMPDIR_REVIEWS"' EXIT

echo "====================================="
echo "YasuMeshi 리뷰 데이터 품질 테스트"
echo "====================================="
echo ""

echo "[1/2] 신주쿠역 근처 식당 검색 중..."
curl -s -X POST "https://places.googleapis.com/v1/places:searchNearby" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: ${GOOGLE_PLACES_API_KEY}" \
  -H "X-Goog-FieldMask: places.id,places.displayName" \
  -d '{
    "includedTypes": ["restaurant"],
    "locationRestriction": {
      "circle": {
        "center": {"latitude": 35.6896, "longitude": 139.7006},
        "radius": 800.0
      }
    },
    "maxResultCount": 5,
    "languageCode": "ja"
  }' > "$TMPDIR_REVIEWS/search.json"

PLACE_IDS=$(python3 -c "
import json
with open('$TMPDIR_REVIEWS/search.json') as f:
    data = json.load(f)
for p in data.get('places', []):
    print(p.get('id', ''))
")

if [ -z "$PLACE_IDS" ]; then
  echo "ERROR: 식당을 찾을 수 없습니다."
  exit 1
fi

COUNT=$(echo "$PLACE_IDS" | wc -l | tr -d ' ')
echo "식당 ${COUNT}개 발견"
echo ""
echo "[2/2] 리뷰 원문 수집 중..."
echo ""

TOTAL_REVIEWS=0
IDX=0

while IFS= read -r PLACE_ID; do
  [ -z "$PLACE_ID" ] && continue
  IDX=$((IDX + 1))
  OUTFILE="$TMPDIR_REVIEWS/place_${IDX}.json"

  curl -s -X GET "https://places.googleapis.com/v1/places/${PLACE_ID}" \
    -H "X-Goog-Api-Key: ${GOOGLE_PLACES_API_KEY}" \
    -H "X-Goog-FieldMask: displayName,rating,userRatingCount,reviews,reviewSummary" \
    -H "X-Goog-Api-Language-Code: ja" > "$OUTFILE"

  python3 - "$OUTFILE" << 'PYEOF'
import json, sys

with open(sys.argv[1]) as f:
    data = json.load(f)

name = data.get('displayName', {}).get('text', '불명')
rating = data.get('rating', 'N/A')
count = data.get('userRatingCount', 0)
summary = data.get('reviewSummary', {}).get('text', {}).get('text', '')

print('━' * 50)
print(f'🏪 {name}')
print(f'⭐ {rating} ({count}건)')
if summary:
    print(f'📝 AI 요약: {summary}')
print('━' * 50)

reviews = data.get('reviews', [])
if not reviews:
    print('  (리뷰 없음)')
else:
    for i, r in enumerate(reviews, 1):
        text = r.get('text', {}).get('text', '')
        star = r.get('rating', '?')
        author = r.get('authorAttribution', {}).get('displayName', '익명')
        time_desc = r.get('relativePublishTimeDescription', '')
        print()
        print(f'  [{i}] ⭐{star} {author} ({time_desc})')
        if len(text) <= 200:
            print(f'  {text}')
        else:
            print(f'  {text[:200]}')
            print(f'  ...(총 {len(text)}자)')

print()
print(f'  리뷰 수: {len(reviews)}개')
PYEOF

  RC=$(python3 -c "import json; print(len(json.load(open('$OUTFILE')).get('reviews',[])))")
  TOTAL_REVIEWS=$((TOTAL_REVIEWS + RC))
  echo ""

done <<< "$PLACE_IDS"

echo "====================================="
echo "종합: 식당 ${COUNT}개에서 리뷰 총 ${TOTAL_REVIEWS}개 수집"
echo "====================================="
echo ""
echo "위 리뷰 원문을 보고 판단하세요:"
echo "  - 리뷰에 가게를 판단할 수 있는 정보가 충분한가?"
echo "  - AI가 제보 내용을 교차 검증할 근거가 되는가?"
echo "  - reviewSummary (AI 요약)가 유용한가?"
