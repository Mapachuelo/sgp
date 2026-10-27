import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './index.css';
import App from './app';
import { I18nProvider } from './i18n/index.jsx';
import { TemaProvider } from './contexto/tema-context.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TemaProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </TemaProvider>
  </StrictMode>
);
