import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { ErrorBoundary } from '../src/popup/components/error-boundary';
import { CrashScreen } from '../src/popup/components/crash-screen';
import { activeCopy, getCopy, setActiveLanguage } from '../src/locales';

describe('error boundary', () => {
  it('renders its children until something throws', () => {
    const boundary = new ErrorBoundary({ children: 'the dashboard' });
    expect(boundary.render()).toBe('the dashboard');
  });

  it('captures the error that was thrown', () => {
    const failure = new Error('render exploded');
    const state = ErrorBoundary.getDerivedStateFromError(failure);
    expect(state.error).toBe(failure);
  });

  it('replaces the crashed tree with the crash screen', () => {
    const boundary = new ErrorBoundary({ children: 'the dashboard' });
    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('render exploded'));
    const rendered = boundary.render();
    expect(isValidElement(rendered)).toBe(true);
    expect(rendered).toHaveProperty('type', CrashScreen);
  });

  it('shows the crash screen with the error that stopped it', () => {
    const rendered = CrashScreen({ error: new Error('render exploded') });
    expect(isValidElement(rendered)).toBe(true);
    expect(rendered).toHaveProperty('type', 'main');
  });
});

describe('active language', () => {
  it('follows the language the interface is running in', () => {
    setActiveLanguage('fr');
    expect(activeCopy().settings).toBe(getCopy('fr').settings);
    setActiveLanguage('es');
    expect(activeCopy().settings).toBe(getCopy('es').settings);
    setActiveLanguage('en');
    expect(activeCopy().settings).toBe(getCopy('en').settings);
  });

  it('never leaves the crash screen without a translated message', () => {
    for (const language of ['en', 'fr', 'es'] as const) {
      setActiveLanguage(language);
      const copy = activeCopy();
      expect(copy.crashTitle.length).toBeGreaterThan(0);
      expect(copy.crashMessage.length).toBeGreaterThan(0);
      expect(copy.crashReload.length).toBeGreaterThan(0);
      expect(copy.crashDetailsLabel.length).toBeGreaterThan(0);
    }
  });
});

describe('error boundary wiring', () => {
  it('wraps the application so a render crash cannot blank the popup', () => {
    const entry = readFileSync(resolve(__dirname, '../src/popup/main.tsx'), 'utf8');
    expect(entry).toContain('<ErrorBoundary>');
    expect(entry).toContain('</ErrorBoundary>');
  });

  it('styles the crash screen', () => {
    const styles = readFileSync(resolve(__dirname, '../src/popup/styles.css'), 'utf8');
    expect(styles).toContain('.crash-screen');
    expect(styles).toContain('.crash-details');
  });
});
