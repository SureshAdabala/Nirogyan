// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React, { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SlideTabs } from './slide-tabs';

let pathname = '/';
let resizeCallback: (() => void) | undefined;

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

type MotionListItemProps = ComponentPropsWithoutRef<'li'> &
  Readonly<{
    animate?: Readonly<{ left?: number; opacity?: number; width?: number }>;
    transition?: unknown;
  }>;

vi.mock('framer-motion', () => ({
  useReducedMotion: () => false,
  motion: {
    li: ({ animate, transition, ...props }: MotionListItemProps) => {
      void transition;
      return (
        <li
          {...props}
          data-left={animate?.left}
          data-opacity={animate?.opacity}
          data-width={animate?.width}
        />
      );
    },
  },
}));

class ResizeObserverStub {
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(callback: () => void) {
    resizeCallback = callback;
  }
}

function setTabGeometry(label: string, left: number, width: number) {
  const tab = screen.getByRole('link', { name: label }).closest('li');
  if (!tab) throw new Error(`Missing tab: ${label}`);

  Object.defineProperty(tab, 'offsetLeft', { configurable: true, value: left });
  vi.spyOn(tab, 'getBoundingClientRect').mockReturnValue({
    x: left,
    y: 0,
    top: 0,
    right: left + width,
    bottom: 44,
    left,
    width,
    height: 44,
    toJSON: () => ({}),
  });
  return tab;
}

function indicator(container: HTMLElement) {
  const element = container.querySelector<HTMLElement>('li[aria-hidden="true"]');
  if (!element) throw new Error('Missing slide-tabs indicator.');
  return element;
}

beforeEach(() => {
  pathname = '/';
  resizeCallback = undefined;
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SlideTabs', () => {
  it('renders only real public routes with accessible navigation semantics', () => {
    render(<SlideTabs />);

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(navigation).toBeVisible();
    expect(screen.getByRole('list')).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Calculators' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Biomarkers' })).toHaveAttribute('href', '/biomarkers');
    expect(screen.queryByText(/Pricing|Features|Docs|Blog/u)).not.toBeInTheDocument();
  });

  it.each([
    ['/', 'Calculators'],
    ['/c/heart-risk', 'Calculators'],
    ['/results/private-capability', 'Calculators'],
    ['/biomarkers', 'Biomarkers'],
    ['/biomarkers/hba1c', 'Biomarkers'],
  ])('maps %s to the %s tab', (route, currentLabel) => {
    pathname = route;
    render(<SlideTabs />);

    expect(screen.getByRole('link', { name: currentLabel })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const otherLabel = currentLabel === 'Calculators' ? 'Biomarkers' : 'Calculators';
    expect(screen.getByRole('link', { name: otherLabel })).not.toHaveAttribute('aria-current');
  });

  it('moves on hover and focus, then restores the current route on mouse leave and blur', () => {
    const { container } = render(<SlideTabs />);
    const calculators = setTabGeometry('Calculators', 4, 112);
    const biomarkers = setTabGeometry('Biomarkers', 116, 108);

    act(() => window.dispatchEvent(new Event('resize')));
    expect(indicator(container)).toHaveAttribute('data-left', '4');
    expect(indicator(container)).toHaveAttribute('data-width', '112');

    fireEvent.mouseEnter(biomarkers);
    expect(indicator(container)).toHaveAttribute('data-left', '116');
    expect(screen.getByRole('link', { name: 'Biomarkers' })).toHaveClass('text-white');

    fireEvent.mouseLeave(screen.getByRole('list'));
    expect(indicator(container)).toHaveAttribute('data-left', '4');

    fireEvent.focus(screen.getByRole('link', { name: 'Biomarkers' }));
    expect(indicator(container)).toHaveAttribute('data-left', '116');
    fireEvent.blur(screen.getByRole('list'), { relatedTarget: document.body });
    expect(indicator(container)).toHaveAttribute('data-left', '4');
    expect(calculators).toBeVisible();
  });

  it('remeasures the highlighted tab for ResizeObserver and window resize events', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const { container, unmount } = render(<SlideTabs />);
    const calculators = setTabGeometry('Calculators', 8, 120);
    setTabGeometry('Biomarkers', 128, 110);

    act(() => resizeCallback?.());
    expect(indicator(container)).toHaveAttribute('data-left', '8');
    expect(indicator(container)).toHaveAttribute('data-width', '120');

    Object.defineProperty(calculators, 'offsetLeft', { configurable: true, value: 12 });
    vi.mocked(calculators.getBoundingClientRect).mockReturnValue({
      x: 12,
      y: 0,
      top: 0,
      right: 144,
      bottom: 44,
      left: 12,
      width: 132,
      height: 44,
      toJSON: () => ({}),
    });
    act(() => window.dispatchEvent(new Event('resize')));
    expect(indicator(container)).toHaveAttribute('data-left', '12');
    expect(indicator(container)).toHaveAttribute('data-width', '132');
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
