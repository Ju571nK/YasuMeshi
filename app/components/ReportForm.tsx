'use client';

import { useState } from 'react';

const TAGS = ['トイレ', 'カード可', '持ち帰り', 'カウンター', 'グループ'] as const;
const TAG_EMOJI: Record<string, string> = {
  'トイレ': '🚻',
  'カード可': '💳',
  '持ち帰り': '📦',
  'カウンター': '🪑',
  'グループ': '👥',
};

interface ReportFormProps {
  userLat: number;
  userLng: number;
  onClose: () => void;
}

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export function ReportForm({ userLat, userLng, onClose }: ReportFormProps) {
  const [step, setStep] = useState<'search' | 'form' | 'done'>('search');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [menuName, setMenuName] = useState('');
  const [price, setPrice] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPlaces = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);

    try {
      const res = await fetch('/api/place-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), lat: userLat, lng: userLng }),
      });

      if (!res.ok) {
        setError('検索に失敗しました。');
        return;
      }

      const data = await res.json();
      setPlaces(data.places ?? []);
      if (data.places?.length === 0) {
        setError('店舗が見つかりませんでした。');
      }
    } catch {
      setError('ネットワークエラーが発生しました。');
    } finally {
      setSearching(false);
    }
  };

  const selectPlace = (place: PlaceResult) => {
    setSelectedPlace(place);
    setStep('form');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const submit = async () => {
    if (!selectedPlace || !menuName.trim() || !price.trim()) return;
    const priceNum = parseInt(price, 10);
    if (isNaN(priceNum) || priceNum < 1) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googlePlaceId: selectedPlace.placeId,
          placeName: selectedPlace.name,
          placeAddress: selectedPlace.address,
          menuName: menuName.trim(),
          price: priceNum,
          tags: selectedTags,
          lat: userLat,
          lng: userLng,
          placeLat: selectedPlace.lat,
          placeLng: selectedPlace.lng,
        }),
      });

      if (res.status === 422) {
        setError('現在地から遠すぎます。店舗の近くで制報してください。');
        return;
      }

      if (!res.ok) {
        setError('送信に失敗しました。');
        return;
      }

      setStep('done');
    } catch {
      setError('ネットワークエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-green-800 font-medium mb-2">✅ 制報を受け付けました！</p>
        <p className="text-sm text-green-700 mb-3">確認後に反映されます。ありがとうございます。</p>
        <button
          onClick={onClose}
          className="text-sm text-green-600 underline"
        >
          閉じる
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base">🍜 食堂を教える</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>

      {step === 'search' && (
        <>
          <p className="text-sm text-gray-500 mb-3">
            店名を検索してください
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchPlaces()}
              placeholder="例: 松屋、吉野家、すき家"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={searchPlaces}
              disabled={searching || !query.trim()}
              className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {searching ? '...' : '検索'}
            </button>
          </div>

          {places.length > 0 && (
            <div className="flex flex-col gap-2">
              {places.map((p) => (
                <button
                  key={p.placeId}
                  onClick={() => selectPlace(p)}
                  className="text-left border border-gray-200 rounded-lg p-3 hover:border-orange-400 transition-colors"
                >
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500 truncate">{p.address}</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === 'form' && selectedPlace && (
        <>
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <p className="font-medium text-sm">{selectedPlace.name}</p>
            <p className="text-xs text-gray-500">{selectedPlace.address}</p>
            <button
              onClick={() => { setStep('search'); setSelectedPlace(null); }}
              className="text-xs text-orange-500 mt-1"
            >
              変更する
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">代表メニュー</label>
              <input
                type="text"
                value={menuName}
                onChange={(e) => setMenuName(e.target.value)}
                placeholder="例: 牛めし、カレー"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">価格（円）</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="例: 400"
                min="1"
                max="100000"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">タグ（任意）</label>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
                    }`}
                  >
                    {TAG_EMOJI[tag]} {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={submit}
              disabled={submitting || !menuName.trim() || !price.trim()}
              className="w-full py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {submitting ? '送信中...' : '教える →'}
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}

      <p className="text-xs text-gray-400 mt-3">
        ⚠️ 位置情報が必要です ・ 確認後に反映されます
      </p>
    </div>
  );
}
