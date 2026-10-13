import { useCallback, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { useOnVisible } from '../lazy/useOnVisible.ts';
import styles from './Footer.module.scss';

/**
 * Client-only lazy footer: the server renders an empty placeholder (reserved height, no links in
 * the HTML); the footer chunk is requested when the placeholder gets near the viewport.
 */
export function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  const [Content, setContent] = useState<ComponentType | null>(null);

  const load = useCallback(() => {
    void import(/* webpackChunkName: "footer" */ './FooterContent.tsx').then((module) =>
      setContent(() => module.FooterContent),
    );
  }, []);
  useOnVisible(ref, load);

  if (Content) return <Content />;
  return <div ref={ref} className={styles['placeholder']} data-footer="placeholder" aria-hidden="true" />;
}
