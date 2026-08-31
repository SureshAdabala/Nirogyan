'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { type FocusEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type TabDefinition = Readonly<{
  href: string;
  label: string;
}>;

type CursorPosition = Readonly<{
  left: number;
  opacity: number;
  width: number;
}>;

const tabs = [
  { href: '/', label: 'Calculators' },
  { href: '/biomarkers', label: 'Biomarkers' },
] as const satisfies readonly TabDefinition[];

function activeTabIndex(pathname: string): number {
  if (pathname === '/biomarkers' || pathname.startsWith('/biomarkers/')) return 1;
  return 0;
}

export function SlideTabs() {
  const pathname = usePathname();
  const selected = useMemo(() => activeTabIndex(pathname), [pathname]);
  const reduceMotion = useReducedMotion();
  const listRef = useRef<HTMLUListElement | null>(null);
  const tabRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [highlighted, setHighlighted] = useState(selected);
  const [position, setPosition] = useState<CursorPosition>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const moveCursor = useCallback((index: number) => {
    const tab = tabRefs.current[index];
    if (!tab) return;

    const { width } = tab.getBoundingClientRect();
    setPosition({ left: tab.offsetLeft, width, opacity: 1 });
  }, []);

  const restoreSelection = useCallback(() => {
    setHighlighted(selected);
    moveCursor(selected);
  }, [moveCursor, selected]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(restoreSelection);
    return () => window.cancelAnimationFrame(frame);
  }, [restoreSelection]);

  useEffect(() => {
    const refresh = () => moveCursor(highlighted);
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(refresh);

    if (listRef.current) observer?.observe(listRef.current);
    for (const tab of tabRefs.current) {
      if (tab) observer?.observe(tab);
    }
    window.addEventListener('resize', refresh);

    return () => {
      window.removeEventListener('resize', refresh);
      observer?.disconnect();
    };
  }, [highlighted, moveCursor]);

  const highlight = (index: number) => {
    setHighlighted(index);
    moveCursor(index);
  };

  const handleBlur = (event: FocusEvent<HTMLUListElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    restoreSelection();
  };

  const handleMouseLeave = () => {
    restoreSelection();
  };

  return (
    <nav aria-label="Primary navigation" className="max-w-full">
      <ul
        ref={listRef}
        onBlur={handleBlur}
        onMouseLeave={handleMouseLeave}
        className="relative m-0 flex w-fit max-w-full list-none rounded-full border border-slate-300 bg-white p-1 shadow-sm dark:border-slate-600 dark:bg-slate-900"
      >
        {tabs.map((tab, index) => {
          const isCurrent = index === selected;
          const isHighlighted = index === highlighted;

          return (
            <li
              key={tab.href}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              onMouseEnter={() => highlight(index)}
              className="relative z-10"
            >
              <Link
                href={tab.href}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => highlight(index)}
                onFocus={() => highlight(index)}
                className={`relative z-10 flex min-h-11 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold no-underline transition-colors md:px-5 ${
                  isHighlighted
                    ? 'text-white dark:text-slate-950'
                    : 'text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
        <motion.li
          role="presentation"
          aria-hidden="true"
          animate={position}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }
          }
          className="pointer-events-none absolute inset-y-1 z-0 rounded-full bg-slate-950 shadow-sm dark:bg-white"
        />
      </ul>
    </nav>
  );
}
