import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isRadioGroupKey,
  nextRadioIndex,
  radioKeySelects,
  radioTabStopIndex,
} from '../src/popup/radio-group-navigation';

const ALL_ENABLED: readonly number[] = [0, 1, 2];

describe('radio group keyboard navigation', () => {
  it('recognizes only the keys the radio group pattern uses', () => {
    expect(isRadioGroupKey('ArrowRight')).toBe(true);
    expect(isRadioGroupKey('ArrowDown')).toBe(true);
    expect(isRadioGroupKey('ArrowLeft')).toBe(true);
    expect(isRadioGroupKey('ArrowUp')).toBe(true);
    expect(isRadioGroupKey('Home')).toBe(true);
    expect(isRadioGroupKey('End')).toBe(true);
    expect(isRadioGroupKey('Enter')).toBe(false);
    expect(isRadioGroupKey('Tab')).toBe(false);
    expect(isRadioGroupKey('a')).toBe(false);
  });

  it('selects with the arrows but only moves the focus with Home and End', () => {
    expect(radioKeySelects('ArrowRight')).toBe(true);
    expect(radioKeySelects('ArrowDown')).toBe(true);
    expect(radioKeySelects('ArrowLeft')).toBe(true);
    expect(radioKeySelects('ArrowUp')).toBe(true);
    expect(radioKeySelects('Home')).toBe(false);
    expect(radioKeySelects('End')).toBe(false);
  });

  it('moves to the next and previous option', () => {
    expect(nextRadioIndex('ArrowRight', 0, ALL_ENABLED)).toBe(1);
    expect(nextRadioIndex('ArrowDown', 0, ALL_ENABLED)).toBe(1);
    expect(nextRadioIndex('ArrowLeft', 1, ALL_ENABLED)).toBe(0);
    expect(nextRadioIndex('ArrowUp', 1, ALL_ENABLED)).toBe(0);
  });

  it('wraps around at both ends', () => {
    expect(nextRadioIndex('ArrowRight', 2, ALL_ENABLED)).toBe(0);
    expect(nextRadioIndex('ArrowLeft', 0, ALL_ENABLED)).toBe(2);
  });

  it('skips the disabled options', () => {
    expect(nextRadioIndex('ArrowRight', 0, [0, 2])).toBe(2);
    expect(nextRadioIndex('ArrowRight', 2, [0, 2])).toBe(0);
    expect(nextRadioIndex('ArrowLeft', 2, [0, 2])).toBe(0);
  });

  it('jumps to the first and last enabled option', () => {
    expect(nextRadioIndex('Home', 2, ALL_ENABLED)).toBe(0);
    expect(nextRadioIndex('End', 0, ALL_ENABLED)).toBe(2);
    expect(nextRadioIndex('Home', 2, [1, 2])).toBe(1);
    expect(nextRadioIndex('End', 0, [0, 1])).toBe(1);
  });

  it('stays put when the focused option is not part of the group', () => {
    expect(nextRadioIndex('ArrowRight', 7, ALL_ENABLED)).toBeNull();
    expect(nextRadioIndex('Home', 7, ALL_ENABLED)).toBeNull();
  });

  it('stays put when every option is disabled', () => {
    expect(nextRadioIndex('ArrowRight', 0, [])).toBeNull();
    expect(nextRadioIndex('End', 0, [])).toBeNull();
  });
});

describe('radio group tab stop', () => {
  it('lands on the selected option', () => {
    expect(radioTabStopIndex(1, ALL_ENABLED)).toBe(1);
  });

  it('falls back to the first enabled option when the selection is disabled', () => {
    expect(radioTabStopIndex(1, [0, 2])).toBe(0);
  });

  it('falls back to the first enabled option when nothing is selected', () => {
    expect(radioTabStopIndex(-1, ALL_ENABLED)).toBe(0);
  });

  it('has no tab stop when every option is disabled', () => {
    expect(radioTabStopIndex(-1, [])).toBe(-1);
    expect(radioTabStopIndex(1, [])).toBe(-1);
  });
});

function sourceFiles(directory: string): readonly string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('radio group usage', () => {
  const files = sourceFiles(resolve(__dirname, '../src'));

  it('leaves no hand-rolled radiogroup behind', () => {
    const offenders = files.filter((file) => {
      if (file.endsWith('radio-group.tsx')) return false;
      return readFileSync(file, 'utf8').includes('role="radiogroup"');
    });
    expect(offenders.map((file) => file.replace(resolve(__dirname, '../'), ''))).toEqual([]);
  });

  it('owns the radio semantics in a single primitive', () => {
    const primitive = readFileSync(
      resolve(__dirname, '../src/popup/components/radio-group.tsx'),
      'utf8',
    );
    expect(primitive).toContain('role="radiogroup"');
    expect(primitive).toContain('role="radio"');
    expect(primitive).toContain('aria-checked={selected}');
    expect(primitive).toContain('tabIndex={index === tabStopIndex ? 0 : -1}');
  });

  it('routes every former radiogroup through the primitive', () => {
    const pages = readFileSync(resolve(__dirname, '../src/popup/pages.tsx'), 'utf8');
    const tasteCard = readFileSync(
      resolve(__dirname, '../src/popup/components/taste-card-modal.tsx'),
      'utf8',
    );
    expect(pages.split('<RadioGroup').length - 1).toBe(5);
    expect(tasteCard.split('<RadioGroup').length - 1).toBe(3);
  });
});
