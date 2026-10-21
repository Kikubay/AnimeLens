export type RadioGroupKey = 'ArrowRight' | 'ArrowDown' | 'ArrowLeft' | 'ArrowUp' | 'Home' | 'End';

export function isRadioGroupKey(key: string): key is RadioGroupKey {
  return (
    key === 'ArrowRight' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowUp' ||
    key === 'Home' ||
    key === 'End'
  );
}

// Home and End only move the focus, while the arrows also select: the WAI-ARIA radio group pattern.
export function radioKeySelects(key: RadioGroupKey): boolean {
  return key !== 'Home' && key !== 'End';
}

export function nextRadioIndex(
  key: RadioGroupKey,
  focusedIndex: number,
  enabledIndexes: readonly number[],
): number | null {
  if (enabledIndexes.length === 0) return null;
  const position = enabledIndexes.indexOf(focusedIndex);
  if (position === -1) return null;
  if (key === 'Home') return enabledIndexes[0] ?? null;
  if (key === 'End') return enabledIndexes[enabledIndexes.length - 1] ?? null;
  const offset = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
  const nextPosition = (position + offset + enabledIndexes.length) % enabledIndexes.length;
  return enabledIndexes[nextPosition] ?? null;
}

export function radioTabStopIndex(
  selectedIndex: number,
  enabledIndexes: readonly number[],
): number {
  if (selectedIndex !== -1 && enabledIndexes.includes(selectedIndex)) return selectedIndex;
  return enabledIndexes[0] ?? -1;
}
