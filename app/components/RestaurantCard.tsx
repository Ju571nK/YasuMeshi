import type { Restaurant } from '@/lib/types';
import { trackCardTap, trackNavigateClick } from '@/lib/analytics';

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const { name, priceRange, walkMinutes, isOpen, address, mapsUrl, placeId } = restaurant;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackCardTap({ placeId, priceStart: priceRange?.start ?? null, walkMinutes });
        trackNavigateClick(placeId);
      }}
      className="block border border-gray-200 rounded-lg p-4 hover:border-gray-400 hover:shadow-sm transition-all active:scale-[0.98]"
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
  );
}
