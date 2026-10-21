import { activeCopy } from '../../locales';
import { Button, ErrorState } from './ui';

export function CrashScreen({ error }: { readonly error: Error }) {
  const copy = activeCopy();
  return (
    <main className="app-shell">
      <div className="crash-screen">
        <ErrorState
          title={copy.crashTitle}
          message={copy.crashMessage}
          action={
            <Button icon="refresh" onClick={() => window.location.reload()}>
              {copy.crashReload}
            </Button>
          }
        />
        <details className="crash-details">
          <summary>{copy.crashDetailsLabel}</summary>
          <pre>{error.message}</pre>
        </details>
      </div>
    </main>
  );
}
