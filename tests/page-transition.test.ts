import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_ENTER_MS, PAGE_EXIT_MS, transitionDirection } from '../src/popup/page-transition';
import type { PageId } from '../src/popup/pages';

const ORDER: readonly PageId[] = ['dashboard', 'profile', 'settings'];

describe('transitionDirection', () => {
  it('moves forward when going to a later tab', () => {
    expect(transitionDirection('dashboard', 'profile', ORDER)).toBe('forward');
    expect(transitionDirection('profile', 'settings', ORDER)).toBe('forward');
    expect(transitionDirection('dashboard', 'settings', ORDER)).toBe('forward');
  });

  it('moves backward when going to an earlier tab', () => {
    expect(transitionDirection('settings', 'profile', ORDER)).toBe('backward');
    expect(transitionDirection('profile', 'dashboard', ORDER)).toBe('backward');
    expect(transitionDirection('settings', 'dashboard', ORDER)).toBe('backward');
  });

  it('pushes the detail page in from the right', () => {
    for (const from of ORDER) {
      expect(transitionDirection(from, 'detail', ORDER), from).toBe('forward');
    }
  });

  it('pops back out of the detail page to the left', () => {
    expect(transitionDirection('detail', 'dashboard', ORDER)).toBe('backward');
    expect(transitionDirection('detail', 'profile', ORDER)).toBe('backward');
    expect(transitionDirection('detail', 'settings', ORDER)).toBe('backward');
  });

  it('treats any page missing from the order as a push or a pop', () => {
    expect(transitionDirection('dashboard', 'unknown' as PageId, ORDER)).toBe('backward');
    expect(transitionDirection('unknown' as PageId, 'detail', ORDER)).toBe('forward');
  });
});

describe('page transition durations', () => {
  const styles = readFileSync(resolve(__dirname, '../src/popup/styles.css'), 'utf8');

  it('matches the durations declared in the stylesheet', () => {
    expect(styles).toContain(`--page-exit-duration: ${PAGE_EXIT_MS}ms`);
    expect(styles).toContain(`--page-enter-duration: ${PAGE_ENTER_MS}ms`);
  });

  it('stays fast enough not to gate navigation', () => {
    expect(PAGE_EXIT_MS).toBeLessThanOrEqual(150);
    expect(PAGE_ENTER_MS).toBeLessThanOrEqual(220);
    expect(PAGE_EXIT_MS + PAGE_ENTER_MS).toBeLessThanOrEqual(400);
  });

  it('animates the page in and out once per transition', () => {
    for (const direction of ['forward', 'backward']) {
      expect(styles).toContain(
        `.page-transition[data-direction='${direction}'][data-phase='exit'] .page-content`,
      );
      expect(styles).toContain(
        `.page-transition[data-direction='${direction}'][data-phase='enter'] .page-content`,
      );
    }
  });

  it('keeps every directional keyframe defined', () => {
    for (const name of [
      'page-out-forward',
      'page-in-forward',
      'page-out-backward',
      'page-in-backward',
    ]) {
      expect(styles, name).toContain(`@keyframes ${name}`);
    }
  });

  it('never leaves a directional animation permanently translated', () => {
    for (const name of ['page-in-forward', 'page-in-backward']) {
      const block = styles.slice(styles.indexOf(`@keyframes ${name}`));
      const toBlock = block.slice(block.indexOf('to {'));
      const end = toBlock.slice(0, toBlock.indexOf('}'));
      expect(end, name).toContain('opacity: 1');
      expect(end, name).toContain('translateX(0)');
    }
  });

  it('is neutralised for users who ask for reduced motion', () => {
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('animation-duration: 0.01ms !important');
  });
});
