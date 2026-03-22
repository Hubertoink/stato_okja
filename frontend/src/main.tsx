import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import App from './App';
import './index.css';

import { applyStoredBackground } from './lib/background';

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

applyStoredBackground();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
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
              const k1 = query.queryKey[1];
              if (k1 !== 'paged') return false;
              const page = query.queryKey[3];
              const limit = query.queryKey[4];
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
  </React.StrictMode>,
);
