import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installDesktopBridge } from '../platform/desktop-bridge';
import { App } from './App';
import './styles.css';

// Must precede the first render: on the desktop build this is where the
// renderer gets its `chrome.*` implementation. No-op in the extension.
installDesktopBridge();

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('AnimeLens root element was not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);