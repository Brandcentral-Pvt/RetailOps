import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'rsuite/dist/rsuite-no-reset.min.css';
import './styles/rsuite-overrides.css';
import './index.css'
import './styles/global-overrides.css'
import App from './App.jsx'
import UnderMaintenance from './pages/UnderMaintenance';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { CometChatProvider } from './CometChat/context/CometChatContext';

// Pre-hydrate once QueryClient is fully constructed (async-safe)
hydrateIfPossible(queryClient).catch(console.warn);

/**
 * Pre-hydrate the client so the very first paint uses warmed cache if
 * a prior session persisted values to localStorage.
 */
async function hydrateIfPossible(qc) {
    await requestIdleCallback?.(async () => {
        try {
            await qc.resumePausedMutations?.();
        } catch {
        }
    }, { timeout: 60_000 });
}

// Maintenance mode — when VITE_MAINTENANCE_MODE=true the app renders ONLY
// the Under Maintenance screen (no router, no providers, no API calls).
const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

if (MAINTENANCE_MODE) {
    createRoot(document.getElementById('root')).render(<UnderMaintenance />);
} else {
    createRoot(document.getElementById('root')).render(
        <BrowserRouter>
            <QueryClientProvider client={queryClient}>
                <CometChatProvider>
                    <App />
                </CometChatProvider>
            </QueryClientProvider>
        </BrowserRouter>,
    );
}
