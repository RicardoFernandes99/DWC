import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './index.css';

const root = createRoot(document.getElementById('root')!);

if (
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('style-guide')
) {
  import('./design-system/specimen').then(({ Specimen }) => {
    root.render(
      <StrictMode>
        <Specimen />
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
