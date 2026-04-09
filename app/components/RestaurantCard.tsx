import type { Restaurant } from '@/lib/types';

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const { name, priceRange, walkMinutes, isOpen, address, mapsUrl } = restaurant;

  return (
    <div className="border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate">{name}</h3>
          <p className="text-sm text-gray-500 truncate">{address}</p>
        </div>
        {isOpen ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
            営業中
          </span>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
            営業時間外
          </span>
        )}
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

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center justify-center gap-1 bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
      >
        地図で見る →
      </a>
    </div>
  );
}
