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

// Which restaurants appeared in search results
export function trackResultsShown(placeIds: string[], radius: number, type: string) {
  const a = getFirebaseAnalytics();
  if (!a) return;
  const truncated = placeIds.length > 20;
  logEvent(a, 'results_shown', {
    place_ids_sample: placeIds.slice(0, 20).join(','),
    place_ids_truncated: truncated,
    count: placeIds.length,
    radius,
    type,
  });
}

// User opened report form for a restaurant
export function trackReportFormOpened(placeId: string, placeName: string) {
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'report_form_opened', { place_id: placeId, place_name: placeName });
}

// User submitted a report
export function trackReportSubmitted(params: {
  placeId: string;
  price: number;
}) {
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'report_submitted', {
    place_id: params.placeId,
    price: params.price,
  });
}

// User opened details section for a restaurant
export function trackDetailsOpened(placeId: string, placeName: string) {
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'details_opened', { place_id: placeId, place_name: placeName });
}

// User used station search
export function trackStationSearch(resolvedName: string | null, found: boolean) {
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'station_search', {
    station_name: found ? resolvedName : null,
    found: String(found),
  });
}

// Session start with context
export function trackSessionStart() {
  const a = getFirebaseAnalytics();
  if (!a) return;
  const now = new Date();
  const dayOfWeek = now.getDay();
  logEvent(a, 'session_start_context', {
    hour: now.getHours(),
    day_of_week: dayOfWeek,
    is_weekend: [0, 6].includes(dayOfWeek),
  });
}

export function trackPwaLaunch() {
  const isPwa = window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);
  if (!isPwa) return;
  const a = getFirebaseAnalytics();
  if (!a) return;
  logEvent(a, 'pwa_launch');
}
