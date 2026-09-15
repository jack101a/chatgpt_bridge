import { useState, useEffect, useCallback, useMemo } from 'react';
import { GalleryItem, GalleryTimeFilter, GallerySortBy, GalleryGroupBy, GalleryLayoutMode, TimelineSection } from '../types';
import { api } from '../lib/api';
import { sortGalleryItems, groupGalleryItems } from '../lib/timeline';

export function useGallery(initialFilter: GalleryTimeFilter = 'all') {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<GalleryTimeFilter>(initialFilter);
  const [sortBy, setSortBy] = useState<GallerySortBy>('newest');
  const [groupBy, setGroupBy] = useState<GalleryGroupBy>('day');
  const [layoutMode, setLayoutMode] = useState<GalleryLayoutMode>('feed');

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getGallery({ filter: activeFilter, limit: 40 });
      setItems(res.items);
      setCursor(res.next_cursor);
      setTotal(res.total);
    } catch (e) {
      console.error('Failed to load gallery', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter]);

  const loadMore = useCallback(async () => {
    if (!cursor || isLoading) return;
    setIsLoading(true);
    try {
      const res = await api.getGallery({ filter: activeFilter, limit: 40, cursor });
      setItems((prev) => {
        // Prevent duplicate IDs when paginating
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = res.items.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
      setCursor(res.next_cursor);
      setTotal(res.total);
    } catch (e) {
      console.error('Failed to load more gallery items', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, cursor, isLoading]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const toggleFavorite = useCallback(async (id: string) => {
    // 1. Instant optimistic update for zero-latency UI response
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item))
    );
    try {
      const res = await api.toggleFavorite(id);
      // Ensure state matches server response
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, favorite: res.favorite } : item))
      );
    } catch (e) {
      console.error('Failed to toggle favorite, reverting', e);
      // Revert optimistic update on failure
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item))
      );
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await api.deleteImage(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to delete image', e);
    }
  }, []);

  // Filtered in memory for instant responsiveness
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (accountFilter && item.account_used !== accountFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const promptMatch = item.prompt?.toLowerCase().includes(q);
        const idMatch = item.conversation_id?.toLowerCase().includes(q) || item.id.includes(q);
        return promptMatch || idMatch;
      }
      return true;
    });
  }, [items, accountFilter, searchQuery]);

  // Sorted items based on active criteria
  const sortedItems = useMemo(() => {
    return sortGalleryItems(filteredItems, sortBy);
  }, [filteredItems, sortBy]);

  // Grouped into timeline sections based on groupBy
  const sections: TimelineSection[] = useMemo(() => {
    return groupGalleryItems(sortedItems, groupBy);
  }, [sortedItems, groupBy]);

  return {
    items: sortedItems,
    sections,
    rawItems: items,
    total,
    isLoading,
    hasMore: Boolean(cursor),
    searchQuery,
    setSearchQuery,
    accountFilter,
    setAccountFilter,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    groupBy,
    setGroupBy,
    layoutMode,
    setLayoutMode,
    loadMore,
    refresh: loadInitial,
    toggleFavorite,
    deleteItem,
  };
}
