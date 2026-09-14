import { useState, useEffect, useCallback } from 'react';
import { GalleryItem } from '../types';
import { api } from '../lib/api';

export function useGallery(activeFilter: 'all' | 'today' | 'favorites' = 'all') {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<string | null>(null);

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
      setItems((prev) => [...prev, ...res.items]);
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
    try {
      const res = await api.toggleFavorite(id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, favorite: res.favorite } : item))
      );
    } catch (e) {
      console.error('Failed to toggle favorite', e);
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
  const filteredItems = items.filter((item) => {
    if (accountFilter && item.account_used !== accountFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const promptMatch = item.prompt?.toLowerCase().includes(q);
      const idMatch = item.conversation_id?.toLowerCase().includes(q) || item.id.includes(q);
      return promptMatch || idMatch;
    }
    return true;
  });

  return {
    items: filteredItems,
    rawItems: items,
    total,
    isLoading,
    hasMore: Boolean(cursor),
    searchQuery,
    setSearchQuery,
    accountFilter,
    setAccountFilter,
    loadMore,
    refresh: loadInitial,
    toggleFavorite,
    deleteItem,
  };
}
