import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

interface PullToRefreshProps {
  id?: string;
  onRefresh?: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

const PULL_THRESHOLD = 65; // px to trigger refresh
const MAX_PULL = 110; // max rubber-band pull px

export const PullToRefresh = React.forwardRef<HTMLDivElement, PullToRefreshProps>(
  ({ id, onRefresh, children, className = '', disabled = false, onScroll }, ref) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const internalRef = useRef<HTMLDivElement>(null);
    const startYRef = useRef<number | null>(null);
    const isPullingRef = useRef(false);

    // Sync external forwarded ref with internal ref
    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref]
    );

    const handleTouchStart = (e: React.TouchEvent) => {
      if (disabled || isRefreshing) return;
      const container = internalRef.current;
      // Only initiate pull-to-refresh if scroll is at the very top
      if (container && container.scrollTop <= 0) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        startYRef.current = null;
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!isPullingRef.current || startYRef.current === null || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      const container = internalRef.current;
      if (container && container.scrollTop > 0) {
        // Scrolled down, cancel pull
        isPullingRef.current = false;
        setPullDistance(0);
        return;
      }

      if (diff > 0) {
        // Rubber-band resistance curve
        const distance = Math.min(MAX_PULL, diff * 0.45);
        setPullDistance(distance);
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = useCallback(async () => {
      if (!isPullingRef.current || isRefreshing) return;
      isPullingRef.current = false;

      if (pullDistance >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(PULL_THRESHOLD * 0.7); // Hold spinner position during refresh
        try {
          if (onRefresh) {
            await Promise.resolve(onRefresh());
          }
        } catch (err) {
          console.error('Pull-to-refresh error', err);
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 300);
        }
      } else {
        setPullDistance(0);
      }
    startYRef.current = null;
  }, [onRefresh, pullDistance, isRefreshing]);

  // Clean up if touch is canceled
  useEffect(() => {
    if (!isRefreshing && pullDistance > 0 && !isPullingRef.current) {
      setPullDistance(0);
    }
  }, [isRefreshing, pullDistance]);

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);

    return (
      <div
        id={id}
        ref={setRefs}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onScroll={onScroll}
        className={`relative flex-1 overflow-y-auto overscroll-y-contain ${className}`}
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Pull indicator spinner container */}
        <div
          className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center pointer-events-none transition-transform duration-200 ease-out"
          style={{
            transform: `translate3d(0, ${pullDistance - 44}px, 0)`,
            opacity: pullDistance > 10 ? 1 : 0,
          }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#202024] border border-[#e5e5e5] dark:border-[#2e2e34] shadow-md text-xs font-medium text-zinc-700 dark:text-zinc-200 backdrop-blur-md">
            {isRefreshing ? (
              <>
                <Loader2 size={15} className="animate-spin text-emerald-500" />
                <span className="text-[11px] font-sans text-emerald-600 dark:text-emerald-400">Refreshing…</span>
              </>
            ) : (
              <>
                <ArrowDown
                  size={14}
                  className="text-zinc-400 transition-transform duration-150"
                  style={{
                    transform: `rotate(${progress >= 1 ? 180 : progress * 180}deg)`,
                    color: progress >= 1 ? '#10a37f' : undefined,
                  }}
                />
                <span className="text-[11px] font-sans">
                  {progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Content wrapper with slight rubber-band pushdown */}
        <div
          style={{
            transform: pullDistance > 0 ? `translate3d(0, ${pullDistance * 0.4}px, 0)` : undefined,
            transition: isPullingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          {children}
        </div>
      </div>
    );
  }
);

PullToRefresh.displayName = 'PullToRefresh';
