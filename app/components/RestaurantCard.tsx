'use client';

import { useState } from 'react';
import type { Restaurant } from '@/lib/types';
import { trackCardTap, trackNavigateClick } from '@/lib/analytics';

interface Report {
  menu_name: string;
  price: number;
  tags: string[];
  upvotes: number;
  downvotes: number;
  created_at: string;
}

const TAG_EMOJI: Record<string, string> = {
  'トイレ': '🚻',
  'カード可': '💳',
  '持ち帰り': '📦',
  'カウンター': '🪑',
  'グループ': '👥',
};

function ReportInline({
  restaurant,
  userLat,
  userLng,
}: {
  restaurant: Restaurant;
  userLat?: number;
  userLng?: number;
}) {
  const TAGS = ['トイレ', 'カード可', '持ち帰り', 'カウンター', 'グループ'] as const;
  const [menuName, setMenuName] = useState('');
  const [price, setPrice] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const submit = async () => {
    if (!menuName.trim() || !price.trim()) return;
    const priceNum = parseInt(price, 10);
    if (isNaN(priceNum) || priceNum < 1) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googlePlaceId: restaurant.placeId,
          placeName: restaurant.name,
          placeAddress: restaurant.address,
          menuName: menuName.trim(),
          price: priceNum,
          tags: selectedTags,
          lat: userLat ?? 0,
          lng: userLng ?? 0,
        }),
      });

      if (!res.ok) {
        setError('送信に失敗しました。');
        return;
      }
      setDone(true);
    } catch {
      setError('ネットワークエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-3">
        <p className="text-sm text-green-700 font-medium mb-1">✅ ありがとうございます！</p>
        <p className="text-xs text-gray-500">
          内容を確認後、みんなの情報に反映されます。
        </p>
        <p className="text-xs text-gray-400 mt-1">
          やすめしは、みんなの力で安くておいしいお店を共有するサービスです。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pt-2">
      <input
        type="text"
        value={menuName}
        onChange={(e) => setMenuName(e.target.value)}
        placeholder="代表メニュー（例: 牛めし）"
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="価格（円）"
        min="1"
        max="100000"
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <div className="flex flex-wrap gap-1.5">
        {TAGS.map((tag) => (
          <button
            key={tag}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTag(tag); }}
            className={`px-2 py-1 text-xs rounded-full border transition-colors ${
              selectedTags.includes(tag)
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-500 border-gray-300'
            }`}
          >
            {TAG_EMOJI[tag]} {tag}
          </button>
        ))}
      </div>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); submit(); }}
        disabled={submitting || !menuName.trim() || !price.trim()}
        className="py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
      >
        {submitting ? '送信中...' : '送信'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ReportDetails({ placeId, onReport }: { placeId: string; onReport: () => void }) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googlePlaceId: placeId }),
    })
      .then((res) => res.json())
      .then((data) => setReports(data.reports ?? []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  });

  if (loading) return <p className="text-xs text-gray-400 py-2">読み込み中...</p>;
  if (!reports || reports.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500 mb-2">まだ情報がありません。</p>
        <p className="text-xs text-gray-400 mb-3">あなたの情報が、安くておいしいお店を探しているみんなの助けになります。</p>
        <button
          onClick={(e) => { e.stopPropagation(); onReport(); }}
          className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
        >
          🍜 情報を教える
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pt-2">
      {reports.map((r, i) => (
        <div key={i} className="bg-orange-50 rounded-lg p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{r.menu_name}</span>
            <span className="text-sm font-semibold text-orange-600">¥{r.price.toLocaleString()}</span>
          </div>
          {r.tags.length > 0 && (
            <div className="flex gap-1 mt-1">
              {r.tags.map((tag) => (
                <span key={tag} className="text-xs text-gray-500">
                  {TAG_EMOJI[tag] ?? ''}{tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            <span>👍{r.upvotes} 👎{r.downvotes}</span>
            <span>{new Date(r.created_at).toLocaleDateString('ja-JP')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RestaurantCard({
  restaurant,
  userLat,
  userLng,
}: {
  restaurant: Restaurant;
  userLat?: number;
  userLng?: number;
}) {
  const { name, priceRange, walkMinutes, isOpen, address, mapsUrl, placeId } = restaurant;
  const [showReport, setShowReport] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 transition-all">
      {/* Main card area — clickable to Google Maps */}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          trackCardTap({ placeId, priceStart: priceRange?.start ?? null, walkMinutes });
          trackNavigateClick(placeId);
        }}
        className="block"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base truncate">{name}</h3>
            <p className="text-sm text-gray-500 truncate">{address}</p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {isOpen ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                営業中
              </span>
            ) : (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                営業時間外
              </span>
            )}
            <span className="text-lg" title="地図で見る">📍</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {priceRange ? (
            <span className="font-semibold text-orange-600">
              ¥{priceRange.start.toLocaleString()}〜¥{priceRange.end.toLocaleString()}
            </span>
          ) : (
            <span className="text-gray-400">価格情報なし</span>
          )}
          <span className="text-gray-400">·</span>
          <span className="text-gray-600">約{walkMinutes}分</span>
        </div>
      </a>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => { setShowReport(!showReport); setShowDetails(false); }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            showReport
              ? 'bg-orange-500 text-white border-orange-500'
              : 'text-orange-600 border-orange-300 hover:bg-orange-50'
          }`}
        >
          🍜 教える
        </button>
        <button
          onClick={() => { setShowDetails(!showDetails); setShowReport(false); }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            showDetails
              ? 'bg-gray-900 text-white border-gray-900'
              : 'text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          📋 みんなの情報
        </button>
      </div>

      {/* Expandable sections */}
      {showReport && (
        <ReportInline restaurant={restaurant} userLat={userLat} userLng={userLng} />
      )}
      {showDetails && (
        <ReportDetails placeId={placeId} onReport={() => { setShowReport(true); setShowDetails(false); }} />
      )}
    </div>
  );
}
