import { installDemoChromeShim } from './chrome-shim';
import { mountDemoBanner } from './banner';
import './demo.css';

// The shim must be in place before `src/popup/main.tsx` evaluates: `installDesktopBridge`
// picks its host by looking for `chrome.runtime.sendMessage` and throws when neither the
// extension nor the Electron bridge is present. A dynamic import keeps that ordering explicit
// instead of relying on the bundler to preserve it across a static import.
installDemoChromeShim();
mountDemoBanner();

void import('../popup/main');
