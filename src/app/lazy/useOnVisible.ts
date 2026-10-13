import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Calls `onVisible` once, when the element gets within `rootMargin` of the viewport.
 * Without IntersectionObserver it fires right away (progressive enhancement, no broken lazy part).
 */
export function useOnVisible(ref: RefObject<Element | null>, onVisible: () => void, rootMargin = '300px') {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      onVisible();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          onVisible();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, onVisible, rootMargin]);
}
