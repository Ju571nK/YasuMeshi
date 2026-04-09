'use client';

import { useState, useEffect, useCallback } from 'react';
import { RestaurantCard } from './RestaurantCard';
import type { Restaurant, SearchResponse } from '@/lib/types';
import { DEFAULT_LOCATION } from '@/lib/types';

type Radius = 500 | 800 | 1000;
type PlaceType = 'restaurant' | 'cafe';

interface LocationState {
  lat: number;
  lng: number;
  isDefault: boolean;
}

function useGeolocation() {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ ...DEFAULT_LOCATION, isDefault: true });
      setError('お使いのブラウザは位置情報に対応していません');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          isDefault: false,
        });
        setLoading(false);
      },
      () => {
        setLocation({ ...DEFAULT_LOCATION, isDefault: true });
        setError('位置情報の取得ができませんでした。東京駅周辺の結果を表示します。');
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }, []);

  return { location, error: error, loading };
}

export function SearchPanel() {
  const { location, error: locationError, loading: locationLoading } = useGeolocation();
  const [radius, setRadius] = useState<Radius>(800);
  const [type, setType] = useState<PlaceType>('restaurant');
  const [openNow, setOpenNow] = useState(true);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async () => {
    if (!location) return;
    setSearching(true);
    setSearchError(null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          radius,
          type,
          openNow,
        }),
      });

      if (res.status === 429) {
        setSearchError('リクエストが多すぎます。少し待ってからもう一度お試しください。');
        return;
      }

      if (!res.ok) {
        setSearchError('検索中にエラーが発生しました。もう一度お試しください。');
        return;
      }

      const data: SearchResponse = await res.json();
      setResults(data);
    } catch {
      setSearchError('ネットワークエラーが発生しました。');
    } finally {
      setSearching(false);
    }
  }, [location, radius, type, openNow]);

  useEffect(() => {
    if (location) {
      search();
    }
  }, [location, search]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-1">やすめし</h1>
      <p className="text-sm text-gray-500 mb-4">近くの食堂（価格順）</p>

      {locationError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800">
          {locationError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Radius */}
        <div className="flex gap-1">
          {([500, 800, 1000] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                radius === r
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {r}m
            </button>
          ))}
        </div>

        {/* Type */}
        <div className="flex gap-1">
          <button
            onClick={() => setType('restaurant')}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              type === 'restaurant'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            🍜 食事
          </button>
          <button
            onClick={() => setType('cafe')}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              type === 'cafe'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            ☕ カフェ
          </button>
        </div>

        {/* Open now */}
        <button
          onClick={() => setOpenNow(!openNow)}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            openNow
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}
        >
          {openNow ? '営業中のみ' : '全て表示'}
        </button>
      </div>

      {/* Loading */}
      {(locationLoading || searching) && (
        <div className="text-center py-12 text-gray-500">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full mx-auto mb-3" />
          {locationLoading ? '位置情報を取得中...' : '検索中...'}
        </div>
      )}

      {/* Error */}
      {searchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {searchError}
        </div>
      )}

      {/* Results */}
      {results && !searching && (
        <>
          {/* Coverage indicator */}
          <div className="text-xs text-gray-400 mb-3">
            {results.meta.withPrice}/{results.meta.total}件に価格情報あり
            （{Math.round(results.meta.coverage * 100)}%）
          </div>

          {/* Priced restaurants */}
          {results.restaurants.length > 0 ? (
            <div className="flex flex-col gap-3 mb-6">
              {results.restaurants.map((r) => (
                <RestaurantCard key={r.placeId} restaurant={r} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              価格情報のある店舗が見つかりませんでした
            </div>
          )}

          {/* Unknown price section */}
          {results.unknownPrice.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">
                価格情報なし（{results.unknownPrice.length}件）
              </summary>
              <div className="flex flex-col gap-3 mt-3">
                {results.unknownPrice.map((r) => (
                  <RestaurantCard key={r.placeId} restaurant={r} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
