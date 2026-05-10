import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-condensed/latin-500.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600.css';
import '@fontsource/ibm-plex-sans-condensed/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './i18n';
import App from './App';
import { applyTheme, resolveStoredTheme } from './lib/theme';
import './styles.css';

applyTheme(resolveStoredTheme(window.localStorage));

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<React.StrictMode><App /></React.StrictMode>);

