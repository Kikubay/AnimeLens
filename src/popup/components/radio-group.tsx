import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import {
  isRadioGroupKey,
  nextRadioIndex,
  radioKeySelects,
  radioTabStopIndex,
} from '../radio-group-navigation';

export interface RadioGroupOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly content?: ReactNode;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly className?: string;
}

export interface RadioGroupProps<T extends string> {
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly RadioGroupOption<T>[];
  readonly ariaLabel: string;
  readonly className?: string;
  readonly itemClassName?: string;
}

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
  itemClassName = '',
}: RadioGroupProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const enabledIndexes = options.reduce<number[]>((indexes, option, index) => {
    if (option.disabled !== true) indexes.push(index);
    return indexes;
  }, []);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStopIndex = radioTabStopIndex(selectedIndex, enabledIndexes);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!isRadioGroupKey(event.key)) return;
    const radio = event.target instanceof Element ? event.target.closest('[role="radio"]') : null;
    const focusedValue = radio?.getAttribute('data-value');
    if (focusedValue === null || focusedValue === undefined) return;
    const focusedIndex = options.findIndex((option) => option.value === focusedValue);
    if (focusedIndex === -1) return;
    const targetIndex = nextRadioIndex(event.key, focusedIndex, enabledIndexes);
    if (targetIndex === null) return;
    event.preventDefault();

    const radios =
      containerRef.current === null
        ? []
        : Array.from(containerRef.current.querySelectorAll<HTMLElement>('[role="radio"]'));
    radios.at(targetIndex)?.focus();

    const target = options.at(targetIndex);
    if (target === undefined || !radioKeySelects(event.key)) return;
    if (target.value === value) return;
    onChange(target.value);
  };

  return (
    <div
      className={className}
      role="radiogroup"
      aria-label={ariaLabel}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const classNames = [itemClassName, option.className, selected ? 'is-selected' : ''].filter(
          (name) => name !== '',
        );
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === tabStopIndex ? 0 : -1}
            className={classNames.join(' ')}
            disabled={option.disabled === true}
            title={option.title}
            data-value={option.value}
            onClick={() => {
              if (!selected) onChange(option.value);
            }}
          >
            {option.content ?? option.label}
          </button>
        );
      })}
    </div>
  );
}
