import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { queryClient as client } from './lib/session-query';
import './index.css';
const root = createRoot(document.getElementById('root')!);
if (
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('style-guide')
) {
  import('./design-system/specimen').then(({ Specimen }) =>
    root.render(
      <StrictMode>
        <Specimen />
      </StrictMode>,
    ),
  );
} else {
  root.render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
