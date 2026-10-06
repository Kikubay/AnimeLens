import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import type { AppCopy } from '../../locales';

export type IconName =
  | 'arrow-down'
  | 'arrow-right'
  | 'arrow-up'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'close'
  | 'download'
  | 'filter'
  | 'home'
  | 'info'
  | 'list'
  | 'moon'
  | 'more'
  | 'play'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'sparkles'
  | 'star'
  | 'thumbs-down'
  | 'thumbs-up'
  | 'user';

interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly strokeWidth?: number;
}

export function Icon({ name, size = 18, strokeWidth = 1.8 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  const paths: Record<IconName, ReactNode> = {
    'arrow-down': (
      <>
        <path d="M12 5v14" />
        <path d="m6 13 6 6 6-6" />
      </>
    ),
    'arrow-right': (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    'arrow-up': (
      <>
        <path d="M12 19V5" />
        <path d="m6 11 6-6 6 6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    'chevron-down': <path d="m6 9 6 6 6-6" />,
    'chevron-left': <path d="m15 18-6-6 6-6" />,
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m7 11 5 5 5-5" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </>
    ),
    filter: (
      <>
        <path d="M4 6h16" />
        <path d="M7 12h10" />
        <path d="M10 18h4" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h12" />
        <path d="M8 12h12" />
        <path d="M8 18h12" />
        <path d="M4 6h.01" />
        <path d="M4 12h.01" />
        <path d="M4 18h.01" />
      </>
    ),
    moon: <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    play: <path d="m9 5 10 7-10 7Z" fill="currentColor" stroke="none" />,
    refresh: (
      <>
        <path d="M20 11a8.1 8.1 0 0 0-14-4L4 9" />
        <path d="M4 4v5h5" />
        <path d="M4 13a8.1 8.1 0 0 0 14 4l2-2" />
        <path d="M20 20v-5h-5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.42 1.42-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2v-.48a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.42-1.42.06-.06A1.7 1.7 0 0 0 8.4 15a1.7 1.7 0 0 0-1.56-1.03H6v-2h.84A1.7 1.7 0 0 0 8.4 11a1.7 1.7 0 0 0-.34-1.88L8 9.06l1.42-1.42.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56V6h2v.48a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.42 1.42-.06.06A1.7 1.7 0 0 0 19.4 11a1.7 1.7 0 0 0 1.56 1.03H21v2h-.04A1.7 1.7 0 0 0 19.4 15Z" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3-1.3 4.2L7 8.5l3.7 1.3L12 14l1.3-4.2L17 8.5l-3.7-1.3Z" />
        <path d="m19 14-.7 2.3L16 17l2.3.7L19 20l.7-2.3L22 17l-2.3-.7Z" />
      </>
    ),
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" />,
    'thumbs-down': (
      <path d="M10 15v4a2 2 0 0 0 2 2l4-6V4H7.7a2 2 0 0 0-1.9 1.4l-1.3 6A2 2 0 0 0 6.4 14H10ZM16 4h3v11h-3" />
    ),
    'thumbs-up': (
      <path d="M10 9V5a2 2 0 0 1 2-2l4 6v11H7.7a2 2 0 0 1-1.9-1.4l-1.3-6A2 2 0 0 1 6.4 11H10Zm6 9h3V7h-3" />
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly icon?: IconName;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button className={`button button-${variant} button-${size} ${className}`} {...props}>
      {children}
      {icon !== undefined && <Icon name={icon} size={15} />}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly icon: IconName;
  readonly label: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly active?: boolean;
}

export function IconButton({
  icon,
  label,
  size = 'md',
  active = false,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`icon-button icon-button-${size}${active ? ' is-active' : ''} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name={icon} size={size === 'sm' ? 15 : 17} />
    </button>
  );
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: 'neutral' | 'accent' | 'success' | 'warning';
}

export function Badge({ tone = 'neutral', className = '', children, ...props }: BadgeProps) {
  return (
    <span className={`badge badge-${tone} ${className}`} {...props}>
      {children}
    </span>
  );
}

interface TabItem {
  readonly id: string;
  readonly label: string;
}

interface TabsProps {
  readonly items: readonly TabItem[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
  readonly label: string;
}

export function Tabs({ items, activeId, onChange, label }: TabsProps) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          className={`tab${item.id === activeId ? ' is-active' : ''}`}
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === activeId}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface ModalProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly closeLabel: string;
  readonly className?: string;
}

export function Modal({ open, title, onClose, children, closeLabel, className = '' }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || dialog === null) return;
      const elements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'));
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
      previouslyFocused.current = null;
    };
  }, [open]);

  if (!open) return null;
  // Portalled to <body> because a `fill-mode: both` animation sitting at translateY(0) makes its ancestor the containing block for fixed positioning, which pushed this dialog off-centre.
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal ${className}`}
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon="close" label={closeLabel} size="sm" onClick={onClose} />
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}

interface DropdownProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly onChange: (value: string) => void;
}

export function Dropdown({ label, value, options, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="dropdown" ref={rootRef}>
      <span className="sr-only">{label}</span>
      <button
        className="dropdown-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {value}
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          {options.map((option) => (
            <button
              className={`dropdown-option${option === value ? ' is-selected' : ''}`}
              key={option}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {option}
              {option === value && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TooltipProps {
  readonly label: string;
  readonly children: ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className="tooltip" data-tooltip={label}>
      {children}
    </span>
  );
}

interface ToastProps {
  readonly message: string;
  readonly onClose: () => void;
  readonly dismissLabel: string;
  /** `0` disables auto-dismiss. */
  readonly autoDismissMs?: number;
}

const TOAST_EXIT_ANIMATION_MS = 260;

export function Toast({ message, onClose, dismissLabel, autoDismissMs = 2000 }: ToastProps) {
  // Stays mounted through the exit animation; the parent unmounts only once `onClose` fires.
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const exitTimer = useRef<number | null>(null);

  const beginExit = () => {
    if (exitTimer.current !== null) return;
    setClosing(true);
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = null;
      onClose();
    }, TOAST_EXIT_ANIMATION_MS);
  };

  useEffect(() => {
    if (autoDismissMs <= 0) return undefined;
    closeTimer.current = window.setTimeout(beginExit, autoDismissMs);
    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
    // beginExit is stable enough for this component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDismissMs]);

  // A reused toast with a new message needs a fresh exit timer.
  useEffect(() => {
    setClosing(false);
    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
  }, [message]);

  useEffect(
    () => () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    },
    [],
  );

  return (
    <div className={`toast${closing ? ' is-closing' : ''}`} role="status">
      <span className="toast-icon">
        <Icon name="check" size={14} />
      </span>
      <span>{message}</span>
      <IconButton icon="close" label={dismissLabel} size="sm" onClick={beginExit} />
      {autoDismissMs > 0 && !closing && (
        <span className="toast-progress" style={{ animationDuration: `${autoDismissMs}ms` }} />
      )}
    </div>
  );
}

export function Skeleton({ className = '' }: { readonly className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function Progress({ value, label }: { readonly value: number; readonly label?: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div className="progress-wrap">
      {label !== undefined && <span className="progress-label">{label}</span>}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <span className="progress-value" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function Rating({
  value,
  outOf = 10,
  copy,
}: {
  readonly value: number;
  readonly outOf?: number;
  readonly copy: AppCopy;
}) {
  return (
    <span className="rating" aria-label={copy.ratingAria(value, outOf)}>
      <Icon name="star" size={13} /> {value.toFixed(1)}
    </span>
  );
}

export function CompatibilityScore({
  value,
  compact = false,
  copy,
}: {
  readonly value: number;
  readonly compact?: boolean;
  readonly copy: AppCopy;
}) {
  return (
    <div
      className={`compatibility-score${compact ? ' is-compact' : ''}`}
      aria-label={copy.compatibilityAria(value)}
    >
      <div className="score-ring" style={{ '--score': `${value * 3.6}deg` } as React.CSSProperties}>
        <span>{value}</span>
        <small>%</small>
      </div>
      {!compact && <span className="score-caption">{copy.matchCaption}</span>}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  readonly title: string;
  readonly message: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="state-panel empty-state">
      <span className="state-icon">
        <Icon name="sparkles" size={20} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  action,
}: {
  readonly title: string;
  readonly message: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="state-panel error-state" role="alert">
      <span className="state-icon">
        <Icon name="info" size={20} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}
