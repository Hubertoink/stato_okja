import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import App from './App';
import './index.css';
import './styles/themes/amtsstube-1987.css';

import { applyStoredBackground } from './lib/background';
import { attachQueryClientMetrics } from './lib/devMetrics';
import { demoModeEnabled } from './demo/config';

const persister = createSyncStoragePersister({
  storage: window.sessionStorage,
  key: 'stato_rq_cache_session_v1',
  throttleTime: 1000,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // keep cache for 24h (works well with persistence)
      refetchOnWindowFocus: false,
    },
  },
});

attachQueryClientMetrics(queryClient);

applyStoredBackground();

if (demoModeEnabled) {
  document.title = 'Stato - Demo';

  try {
    window.sessionStorage.removeItem('stato_rq_cache_session_v1');
  } catch {
    // ignore
  }
}

const app = demoModeEnabled ? (
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
) : (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 1000 * 60 * 60 * 24,
      buster:
        (import.meta.env.VITE_COMMIT_SHA as string | undefined) ||
        (import.meta.env.VITE_APP_VERSION as string | undefined) ||
        'v1',
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          if (query.state.status !== 'success') return false;
          const k0 = query.queryKey[0];
          // Avoid persisting potentially large lists, except the first paged Activities page.
          if (k0 === 'activities') {
            const k2 = query.queryKey[2];
            if (k2 !== 'paged') return false;
            const page = query.queryKey[4];
            const limit = query.queryKey[5];
            if (page !== 1) return false;
            if (typeof limit !== 'number') return false;
            if (limit > 50) return false;
            return true;
          }
          return true;
        },
      },
    }}
  >
    <App />
  </PersistQueryClientProvider>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {app}
  </React.StrictMode>,
);
