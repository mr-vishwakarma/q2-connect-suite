import { useState, useEffect, useMemo, RefObject } from 'react';

export interface UseVirtualListOptions {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
}

export interface VirtualItem {
  index: number;
  offsetTop: number;
}

/**
 * useVirtualList - Lightweight, dependency-free React list virtualization.
 * Computes which items are currently within the scroll viewport (+ overscan buffer)
 * so only visible elements are mounted in the DOM.
 */
export function useVirtualList<T extends HTMLElement>(
  containerRef: RefObject<T>,
  options: UseVirtualListOptions
) {
  const { itemCount, itemHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(500);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setContainerHeight(el.clientHeight);
      }
    };

    updateHeight();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateHeight);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateHeight);
    };
  }, [containerRef]);

  const { startIndex, endIndex, virtualItems, totalHeight } = useMemo(() => {
    const totalHeight = itemCount * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(itemCount - 1, startIndex + visibleCount + overscan * 2);

    const items: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= 0 && i < itemCount) {
        items.push({
          index: i,
          offsetTop: i * itemHeight,
        });
      }
    }

    return {
      startIndex,
      endIndex,
      virtualItems: items,
      totalHeight,
    };
  }, [itemCount, itemHeight, scrollTop, containerHeight, overscan]);

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
  };
}
