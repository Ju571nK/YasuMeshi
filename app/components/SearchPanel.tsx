'use client';

import { useState, useEffect, useCallback } from 'react';
import { RestaurantCard } from './RestaurantCard';
import type { SearchResponse } from '@/lib/types';
import { DEFAULT_LOCATION } from '@/lib/types';
import { trackSearch, trackFilterChange, trackLocationDenied, trackPwaLaunch } from '@/lib/analytics';

type Radius = 500 | 800 | 1000;
type PlaceType = 'restaurant' | 'cafe';

interface LocationState {
  lat: number;
  lng: number;
  isDefault: boolean;
  stationName?: string;
}

function useGeolocation() {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setDenied(true);
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
        setDenied(true);
        setLoading(false);
        trackLocationDenied();
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }, []);

  const setStationLocation = (lat: number, lng: number, name: string) => {
    setLocation({ lat, lng, isDefault: false, stationName: name });
    setDenied(false);
  };

  return { location, denied, loading, setStationLocation };
}

function StationSearch({ onFound }: { onFound: (lat: number, lng: number, name: string) => void }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);

    try {
      const res = await fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station: query.trim() }),
      });

      if (res.status === 404) {
        setError('駅が見つかりませんでした。別の駅名をお試しください。');
        return;
      }

      if (!res.ok) {
        setError('検索中にエラーが発生しました。');
        return;
      }

      const data = await res.json();
      onFound(data.lat, data.lng, data.name);
    } catch {
      setError('ネットワークエラーが発生しました。');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <p className="text-sm text-blue-800 mb-3">
        位置情報が取得できませんでした。駅名で検索できます。
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="例: 新宿、渋谷、池袋"
          className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {searching ? '...' : '検索'}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </div>
  );
}

export function SearchPanel() {
  const { location, denied, loading: locationLoading, setStationLocation } = useGeolocation();
  const [radius, setRadius] = useState<Radius>(800);
  const [type, setType] = useState<PlaceType>('restaurant');
  const [openNow, setOpenNow] = useState(true);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => { trackPwaLaunch(); }, []);

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
      trackSearch({
        lat: location.lat,
        lng: location.lng,
        radius,
        type,
        resultCount: data.meta.total,
        priceCount: data.meta.withPrice,
      });
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
      <p className="text-sm text-gray-500 mb-4">
        {location?.stationName
          ? `${location.stationName}周辺の食堂（価格順）`
          : '近くの食堂（価格順）'}
      </p>

      {/* Station search (when location denied) */}
      {denied && !location && (
        <StationSearch onFound={setStationLocation} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1">
          {([500, 800, 1000] as const).map((r) => (
            <button
              key={r}
              onClick={() => { setRadius(r); trackFilterChange('radius', r); }}
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

        <div className="flex gap-1">
          <button
            onClick={() => { setType('restaurant'); trackFilterChange('type', 'restaurant'); }}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              type === 'restaurant'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            🍜 食事
          </button>
          <button
            onClick={() => { setType('cafe'); trackFilterChange('type', 'cafe'); }}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              type === 'cafe'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            ☕ カフェ
          </button>
        </div>

        <button
          onClick={() => { setOpenNow(!openNow); trackFilterChange('openNow', !openNow); }}
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
          <div className="text-xs text-gray-400 mb-3">
            {results.meta.withPrice}/{results.meta.total}件に価格情報あり
            （{Math.round(results.meta.coverage * 100)}%）
          </div>

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
