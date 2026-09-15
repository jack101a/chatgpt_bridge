import { GalleryItem, GallerySortBy, GalleryGroupBy, TimelineSection } from '../types';

/**
 * Sorts gallery items based on the selected sort criteria.
 */
export function sortGalleryItems(items: GalleryItem[], sortBy: GallerySortBy): GalleryItem[] {
  const sorted = [...items];

  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id));
    case 'oldest':
      return sorted.sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id));
    case 'duration':
      return sorted.sort((a, b) => {
        const da = a.duration_s ?? 999999;
        const db = b.duration_s ?? 999999;
        return da - db;
      });
    case 'size':
      return sorted.sort((a, b) => {
        const sa = a.size_bytes ?? 0;
        const sb = b.size_bytes ?? 0;
        return sb - sa;
      });
    case 'retries':
      return sorted.sort((a, b) => {
        const ra = (a.tweaked_prompt ? 1 : 0) + (a.tweaked_prompt_2 ? 1 : 0);
        const rb = (b.tweaked_prompt ? 1 : 0) + (b.tweaked_prompt_2 ? 1 : 0);
        return rb - ra || b.created_at - a.created_at;
      });
    default:
      return sorted;
  }
}

function getDayBucket(date: Date, now: Date): { key: string; label: string } {
  const isSameCalendarDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  if (isSameCalendarDay(date, now)) {
    return {
      key,
      label: `Today · ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    };
  }
  if (isSameCalendarDay(date, yesterday)) {
    return {
      key,
      label: `Yesterday · ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    };
  }

  const isCurrentYear = date.getFullYear() === now.getFullYear();
  const label = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  });

  return { key, label };
}

function getWeekBucket(date: Date, now: Date): { key: string; label: string } {
  const d = new Date(date);
  const day = d.getDay();
  // Set to Monday
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const nowDay = now.getDay();
  const nowDiffToMonday = now.getDate() - nowDay + (nowDay === 0 ? -6 : 1);
  const currentWeekMonday = new Date(now.getFullYear(), now.getMonth(), nowDiffToMonday);
  currentWeekMonday.setHours(0, 0, 0, 0);

  const lastWeekMonday = new Date(currentWeekMonday);
  lastWeekMonday.setDate(currentWeekMonday.getDate() - 7);

  const key = `${monday.getFullYear()}-W${Math.ceil((monday.getDate() + monday.getMonth() * 31) / 7)}`;

  if (monday.getTime() === currentWeekMonday.getTime()) {
    return {
      key,
      label: `This Week · ${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    };
  }
  if (monday.getTime() === lastWeekMonday.getTime()) {
    return {
      key,
      label: `Last Week · ${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    };
  }

  const showYear = monday.getFullYear() !== now.getFullYear();
  return {
    key,
    label: `Week of ${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(showYear ? { year: 'numeric' } : {}) })}`,
  };
}

function getMonthBucket(date: Date): { key: string; label: string } {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const label = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return { key, label };
}

function getYearBucket(date: Date): { key: string; label: string } {
  const key = String(date.getFullYear());
  const label = String(date.getFullYear());
  return { key, label };
}

/**
 * Partitions sorted gallery items into timeline sections according to the groupBy mode.
 */
export function groupGalleryItems(items: GalleryItem[], groupBy: GalleryGroupBy): TimelineSection[] {
  if (items.length === 0) return [];

  if (groupBy === 'all') {
    return [
      {
        key: 'all-stream',
        label: 'Continuous Feed',
        items,
      },
    ];
  }

  const now = new Date();
  const map = new Map<string, { label: string; items: GalleryItem[] }>();

  for (const item of items) {
    const date = new Date(item.created_at * 1000);
    let bucket: { key: string; label: string };

    switch (groupBy) {
      case 'day':
        bucket = getDayBucket(date, now);
        break;
      case 'week':
        bucket = getWeekBucket(date, now);
        break;
      case 'month':
        bucket = getMonthBucket(date);
        break;
      case 'year':
        bucket = getYearBucket(date);
        break;
    }

    if (!map.has(bucket.key)) {
      map.set(bucket.key, { label: bucket.label, items: [] });
    }
    map.get(bucket.key)!.items.push(item);
  }

  return Array.from(map.entries()).map(([key, val]) => ({
    key,
    label: val.label,
    items: val.items,
  }));
}
