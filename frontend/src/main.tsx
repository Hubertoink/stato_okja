import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import App from './App';
import './index.css';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'stato_rq_cache_v1',
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
            // Avoid persisting potentially large lists.
            if (k0 === 'activities') return false;
            return true;
          },
        },
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
