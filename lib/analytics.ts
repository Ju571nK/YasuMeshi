import { logEvent } from 'firebase/analytics';
import { getFirebaseAnalytics } from './firebase';

function truncateCoord(value: number): number {
  return Math.round(value * 100) / 100; // ~1km precision
}

export function trackSearch(params: {
  lat: number;
  lng: number;
  radius: number;
  type: string;
  resultCount: number;
  priceCount: number;
}) {
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'search_performed', {
    lat: truncateCoord(params.lat),
    lng: truncateCoord(params.lng),
    radius: params.radius,
    type: params.type,
    result_count: params.resultCount,
    price_count: params.priceCount,
  });
}

export function trackCardTap(params: {
  placeId: string;
  priceStart: number | null;
  walkMinutes: number;
}) {
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'card_tapped', {
    place_id: params.placeId,
    price_start: params.priceStart,
    walk_minutes: params.walkMinutes,
  });
}

export function trackNavigateClick(placeId: string) {
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'navigate_clicked', { place_id: placeId });
}

export function trackFilterChange(filterType: string, value: string | number | boolean) {
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'filter_changed', {
    filter_type: filterType,
    value: String(value),
  });
}

export function trackLocationDenied() {
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'location_denied');
}

export function trackPwaLaunch() {
  const isPwa = window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);
  if (!isPwa) return;
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'pwa_launch');
}
